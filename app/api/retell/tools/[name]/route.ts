import { after } from "next/server";
import { TOOL_NAMES } from "@/lib/agent/tools";
import { executeTool } from "@/lib/engine/calls";
import { json } from "@/lib/http";
import { stopRetellCall } from "@/lib/retell/client";
import { readVerifiedRetellBody, resolveCallId, textResponse } from "@/lib/retell/guard";
import { isToolName, normalizeToolArgs, parseFunctionCall } from "@/lib/retell/payload";

// POST /api/retell/tools/[name] — the seven tools as Retell custom functions (same allowlist and the
// same executor as the browser transport). Retell posts {name, call, args} with X-Retell-Signature and
// hands whatever we return (2xx) to its LLM as a string, so results are plain text.

/**
 * After end_call the model hangs up with Retell's built-in hang_up tool. If the line is still up this
 * long after end_call and no other tool was used since (the conversation did not continue), we stop the
 * call through the API so it never lingers in "are you still there?" reminders.
 */
const HANGUP_FALLBACK_MS = 8000;

// Guard against a looping model: at most this many tool calls per Retell call per minute.
const RATE_LIMIT = 30;
const g = globalThis as unknown as { __secondKeyToolRate?: Map<string, number[]> };
const rate = (g.__secondKeyToolRate ??= new Map<string, number[]>());

function overLimit(key: string): boolean {
  const now = Date.now();
  const recent = (rate.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  rate.set(key, recent);
  if (rate.size > 500) for (const [k, v] of rate) if (!v.some((t) => now - t < 60_000)) rate.delete(k);
  return recent.length > RATE_LIMIT;
}

function scheduleHangup(retellCallId: string | undefined) {
  if (!retellCallId) return;
  const endAt = Date.now();
  after(async () => {
    await new Promise((r) => setTimeout(r, HANGUP_FALLBACK_MS));
    if ((rate.get(retellCallId) ?? []).some((t) => t > endAt)) return; // the conversation went on
    try {
      if (await stopRetellCall(retellCallId)) console.log(`[retell tools] stopped Retell call ${retellCallId} after end_call`);
    } catch (e) {
      console.error(`[retell tools] could not hang up Retell call ${retellCallId}`, e);
    }
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const checked = await readVerifiedRetellBody(req);
  if ("response" in checked) return checked.response;

  const { name } = await ctx.params;
  if (!isToolName(name)) {
    return json({ error: `Unknown tool "${name}". Allowed: ${TOOL_NAMES.join(", ")}` }, 404);
  }

  const parsed = parseFunctionCall(checked.raw);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  if (parsed.name && parsed.name !== name) {
    console.warn(`[retell tools] body names "${parsed.name}" but the URL is /tools/${name}; using ${name}`);
  }

  const call = parsed.call;
  if (call && overLimit(call.call_id)) {
    return textResponse("Too many tool calls on this call. Stop calling tools; tell the person a person will call them back.", 429);
  }

  let callId: string | null = null;
  try {
    callId = await resolveCallId(call, { createInbound: true });
  } catch (e) {
    console.error(`[retell tools] ${name}: could not map Retell call ${call?.call_id}`, e);
  }
  if (!callId) {
    console.warn(`[retell tools] ${name}: no call of ours for Retell call ${call?.call_id ?? "(none in body)"}`);
    if (name === "end_call") scheduleHangup(call?.call_id);
    return textResponse(
      "Nothing was recorded: this call is not linked to the response system. Do not call tools again on this call. " +
        "Tell the person you could not record that and that a person will call them back.",
      200,
      { "X-Second-Key-Error": "unmatched_call" },
    );
  }

  const { args, dropped } = normalizeToolArgs(name, parsed.args);
  if (dropped.length) console.warn(`[retell tools] ${name}: dropped unknown arguments ${dropped.join(", ")}`);

  try {
    const result = await executeTool(callId, name, args);
    if (result.end) scheduleHangup(call?.call_id);
    return textResponse(result.result || "Done.", 200, { "X-Second-Key-Call": callId });
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    console.error(`[retell tools] ${name} failed for call ${callId}`, e);
    // The goodbye was already said; a failed record must not leave the line open.
    if (name === "end_call") scheduleHangup(call?.call_id);
    return textResponse(
      `The ${name} tool failed (${msg}). Do not retry it. Tell the person you could not record that and that a person will call them back.`,
      200,
      { "X-Second-Key-Error": "tool_failed", "X-Second-Key-Call": callId },
    );
  }
}
