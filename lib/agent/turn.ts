import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { agentModel, anthropic } from "@/lib/anthropic";
import { db, nowIso } from "@/lib/db";
import { appendTranscript, endCall, executeTool } from "@/lib/engine/calls";
import { ledger } from "@/lib/engine/log";
import { upsertHelp } from "@/lib/engine/registry";
import type { CallVars } from "@/lib/types";
import { CALL_CONNECTED, systemPrompt } from "./prompt";
import { TOOL_NAMES, toolDefsFor, type ToolName } from "./tools";

// The browser-transport turn loop (PRD backlog 27): Claude Haiku with the call's tool allowlist. Each
// person turn runs at most a few model requests (tool use, then the spoken reply). The conversation is
// stored on the call so any server instance can continue it.

export interface TurnResult {
  reply: string;
  ended: boolean;
}

const MAX_STEPS = 4;
const trouble = (v: CallVars) =>
  `Sorry, I'm having trouble on this line. If this is an emergency, hang up and call ${v.emergency_number || "911"} now. Otherwise a person will call you back. Goodbye.`;

/** When the agent cannot continue, a person must actually call back: put the person on the registry. */
async function callbackRow(callId: string, why: string) {
  const call = await db().get("calls", callId);
  const id = call?.subject_household_id ?? call?.household_id;
  const h = id ? await db().get("households", id) : null;
  if (!call || !h) return;
  await upsertHelp({ household: h, zone_id: h.zone_id ?? (call.vars.zone_id || null), priority: 3, needs: [],
    reason: `Call back: ${why}`, source: call.purpose === "inbound" ? "inbound" : "stage1" });
}

// Everything in `reply` is spoken. Low-effort turns occasionally narrate the instructions ("Hindi only, per
// instructions."); drop those sentences, and only those, so the approved directive itself is never touched.
const NARRATION = [
  /\bper (my |the |your )?(instructions|rules|prompt)\b/i,
  /\b(greeting|opening|call) must (include|start|begin)\b/i,
  /\bexactly as approved\b/i,
  /\b(record_status|report_hazard|request_human|end_call|lookup_zone|read_observation|received_alert|share_live_location|consent_quote)\b/i,
  /^(now )?(read|reading) (the )?(directive|route|evacuation point|approved)/i,
  /^(respond|speak|reply) (only )?in [\p{L} ()]+ only\.?$/iu,
];

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);

/** True when a sentence quotes four or more consecutive words of an approved text: never drop those. */
function quotesApproved(sentence: string, approved: string[]): boolean {
  const w = words(sentence);
  const texts = approved.map((t) => words(t).join(" "));
  for (let i = 0; i + 4 <= w.length; i++) {
    const run = w.slice(i, i + 4).join(" ");
    if (texts.some((t) => t.includes(run))) return true;
  }
  return false;
}

export function spoken(text: string, approved: string[] = []): string {
  const sentences = text.split(/(?<=[.!?。।])\s+/);
  const kept = sentences.filter((s) => quotesApproved(s, approved) || !NARRATION.some((re) => re.test(s.trim())));
  if (kept.length !== sentences.length) console.warn("[agent] dropped narration:", sentences.filter((s) => !kept.includes(s)).join(" | "));
  return kept.join(" ").trim();
}

export async function agentTurn(callId: string, personText: string | null): Promise<TurnResult> {
  const call = await db().get("calls", callId);
  if (!call) throw new Error("call not found");
  const messages = [...(call.messages as Anthropic.MessageParam[])];
  if (personText === null) {
    if (messages.length) return { reply: "", ended: false }; // already started
    messages.push({ role: "user", content: CALL_CONNECTED });
  } else {
    messages.push({ role: "user", content: personText });
    await appendTranscript(callId, [{ role: "person", text: personText }]);
  }

  const tools: Anthropic.Tool[] = toolDefsFor(call.purpose).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
    strict: true,
  }));

  let reply = "";
  let ended = false;
  for (let step = 0; step < MAX_STEPS; step++) {
    // Re-read the variables each step: lookup_zone can switch the call to another zone's approved text.
    const vars = (await db().get("calls", callId))?.vars ?? call.vars;
    let res: Anthropic.Message;
    try {
      res = await anthropic().messages.create({
        model: agentModel(),
        max_tokens: 1024,
        system: [{ type: "text", text: systemPrompt(vars), cache_control: { type: "ephemeral" } }],
        tools,
        messages,
        output_config: { effort: "low" },
      });
    } catch (e) {
      console.error("[agent]", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
      reply = reply ? `${reply} ${trouble(vars)}` : trouble(vars);
      ended = true;
      await callbackRow(callId, "the line had a technical problem");
      await ledger({ actor: "system", action: "agent error: call ended, a person will call back", kind: "system", target: call.vars.person_name, reason: e instanceof Error ? e.message : String(e) });
      break;
    }
    if (res.stop_reason === "refusal") {
      reply = reply || `I can't help with that on this line. A person will call you back. If this is an emergency, hang up and call ${vars.emergency_number || "911"} now.`;
      await callbackRow(callId, "the agent could not continue the conversation");
      break;
    }
    // A reply cut off by max_tokens may end in a half-written tool call: keep only its text, run no tools.
    const truncated = res.stop_reason === "max_tokens";
    messages.push({ role: "assistant", content: truncated ? res.content.filter((b) => b.type === "text") : res.content });
    const approved = [vars.directive_text, vars.move_text, vars.evac_point, vars.alert_text].filter(Boolean);
    const text = spoken(
      res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join(" ")
        .trim(),
      approved,
    );
    if (text) reply = reply ? `${reply} ${text}` : text;

    const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !uses.length) break;
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      if (!TOOL_NAMES.includes(u.name as ToolName)) {
        results.push({ type: "tool_result", tool_use_id: u.id, content: "Unknown tool.", is_error: true });
        continue;
      }
      try {
        const r = await executeTool(callId, u.name as ToolName, u.input as Record<string, unknown>);
        if (r.end) ended = true;
        results.push({ type: "tool_result", tool_use_id: u.id, content: r.result });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: u.id, content: `Error: ${e instanceof Error ? e.message : String(e)}`, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
    if (ended && reply) break; // the goodbye was already said
  }

  await db().update("calls", callId, { messages, last_activity_at: nowIso() });
  if (reply) await appendTranscript(callId, [{ role: "agent", text: reply }]);
  if (ended) await endCall(callId, "completed");
  return { reply, ended };
}
