// The Conversation Flow version of the VoiceFlare agent, for Retell's visual flow builder.
// Built at run time from the same sources as the single-prompt agent, so it never drifts:
//   - the global prompt is lib/agent/prompt.ts without its "# Scripts by purpose" section;
//   - each node's instruction quotes the script lines for its purpose from that same section;
//   - the tools are the custom functions buildLlmPayload() sends (lib/retell/config.ts), plus three
//     fixed-reason copies of request_human for function nodes (same URL, reason pinned with const).
// Pure module (relative imports only, no server-only), like config.ts, so tsx scripts can load it.
//
// Shapes follow POST /create-conversation-flow (spec revision 2026-10-16):
//   https://docs.retellai.com/api-references/create-conversation-flow
// Node types used: conversation, subagent, function, branch (the "logic split" node), end.
// Edges: edges[] (prompt or equation conditions), else_edge ("Else"), skip_response_edge ("Skip response").
// Global nodes: global_node_setting.condition, go_back_conditions.
import { PROMPT_TEMPLATE } from "../agent/prompt";
import {
  buildAgentPayload,
  buildLlmPayload,
  DEFAULT_RETELL_LLM_MODEL,
  defaultDynamicVariables,
  type RetellLang,
} from "./config";

/** Purposes this flow has its own nodes for. Any other purpose goes to the script fallback node. */
export const FLOW_PURPOSES = ["resident", "inbound", "qrt_callback", "linked_contact", "sentinel", "canary", "test"] as const;

// ---------- The prompt, split ----------

export interface PromptParts {
  /** Every section except the scripts: identity, call variables, how to talk, the safety rules. */
  global: string;
  /** The "# Scripts by purpose" section, whole (null if the heading is gone). */
  scriptsSection: string | null;
  /** Script lines per purpose ("resident" has one line per stage). */
  scripts: Map<string, string[]>;
  /** The "# Heat mode" section, whole (null if the prompt has none). It also stays in the global prompt. */
  heatSection: string | null;
}

export function splitPrompt(template: string = PROMPT_TEMPLATE): PromptParts {
  const parts = template.split(/^(?=# )/m);
  const i = parts.findIndex((p) => /^# Scripts by purpose/.test(p));
  const heatSection = parts.find((p) => /^# Heat mode/.test(p))?.trim() ?? null;
  if (i < 0) return { global: template.trim(), scriptsSection: null, scripts: new Map(), heatSection };
  const scriptsSection = parts[i].trim();
  const scripts = new Map<string, string[]>();
  for (const raw of scriptsSection.split("\n")) {
    const line = raw.trim();
    const m = /^- ([a-z_]+)\b[^:]*:/.exec(line);
    if (!m) continue;
    scripts.set(m[1], [...(scripts.get(m[1]) ?? []), line.slice(2)]);
  }
  return { global: parts.filter((_, j) => j !== i).join("").trim(), scriptsSection, scripts, heatSection };
}

const FLOW_NOTE = `# This call runs as a flow
- The call moves through steps. Each step's instruction says what to do now: do only that step, then stop and listen.
- Every rule above applies in every step. Tools run at fixed steps; never say a tool's name.`;

export function flowGlobalPrompt(parts: PromptParts = splitPrompt()): string {
  return `${parts.global}\n\n${FLOW_NOTE}`;
}

// ---------- Tools ----------

type Schema = Record<string, unknown>;
type LlmTool = ReturnType<typeof buildLlmPayload>["general_tools"][number];
type CustomTool = Extract<LlmTool, { type: "custom" }>;
export type FlowTool = Omit<CustomTool, "parameters" | "name" | "description"> & {
  tool_id: string;
  name: string;
  description: string;
  parameters: Schema;
};

export const toolId = (name: string) => `tool_${name}`;

/** request_human with its reason pinned (const), for function nodes where the reason is never in doubt. */
const HANDOFFS = [
  {
    name: "request_human_medical",
    reason: "medical_emergency",
    urgency: "now",
    description:
      "Hand the person to a human now: a medical emergency, someone trapped, fire at the house, or someone who cannot leave under an order. Call only after saying \"Hang up and call the emergency number now\". Reason and urgency are fixed; put what happened in note.",
  },
  {
    name: "request_human_cannot_answer",
    reason: "cannot_answer",
    urgency: null,
    description:
      "Hand the person to a human because there is no approved instruction for where they are. The reason is fixed; put the place they named in note.",
  },
  {
    name: "request_human_salvage",
    reason: "salvage",
    urgency: null,
    description:
      "Collections line only: log a request for help moving the items on their grab list. It always ranks below every person. The reason is fixed; put what and where in note.",
  },
] as const;

export function buildFlowTools(baseUrl: string): FlowTool[] {
  const llm = buildLlmPayload({ baseUrl, verificationPhrase: "", callbackNumber: "" });
  const custom = llm.general_tools.filter((t): t is CustomTool => t.type === "custom");
  const tools: FlowTool[] = custom.map((t) => ({ ...t, tool_id: toolId(t.name) }));

  const rh = custom.find((t) => t.name === "request_human");
  if (!rh) throw new Error("flow: request_human is missing from the tools; the hand-off nodes need it");
  const rhParams = rh.parameters as { properties: Record<string, Schema>; required?: string[] };
  const reasons = (rhParams.properties.reason?.enum as string[] | undefined) ?? [];
  const urgencies = (rhParams.properties.urgency?.enum as string[] | undefined) ?? [];
  for (const h of HANDOFFS) {
    if (!reasons.includes(h.reason)) throw new Error(`flow: request_human has no reason "${h.reason}" any more (lib/agent/tools.ts)`);
    if (h.urgency && !urgencies.includes(h.urgency)) throw new Error(`flow: request_human has no urgency "${h.urgency}" any more`);
    const properties: Record<string, Schema> = {
      ...rhParams.properties,
      reason: { type: "string", const: h.reason, description: `Always "${h.reason}".` },
      ...(h.urgency ? { urgency: { type: "string", const: h.urgency, description: `Always "${h.urgency}".` } } : {}),
    };
    tools.push({
      ...rh,
      // Same endpoint: the route takes the tool from the URL (/tools/request_human), not from the body's name.
      name: h.name,
      tool_id: toolId(h.name),
      description: h.description,
      parameters: { type: "object", properties, required: rhParams.required ?? Object.keys(properties) },
    });
  }
  return tools;
}

// ---------- Nodes ----------

type PromptCond = { type: "prompt"; prompt: string };
type Equation = { left: string; operator: "==" | "!="; right: string };
type EquationCond = { type: "equation"; equations: Equation[]; operator: "||" | "&&" };
export interface FlowEdge {
  id: string;
  transition_condition: PromptCond | EquationCond;
  destination_node_id?: string;
}
type Instruction = { type: "prompt" | "static_text"; text: string };
export interface FlowNode {
  id: string;
  name: string;
  type: "conversation" | "subagent" | "function" | "branch" | "end";
  display_position: { x: number; y: number };
  instruction?: Instruction;
  edges?: FlowEdge[];
  else_edge?: FlowEdge;
  skip_response_edge?: FlowEdge;
  tool_ids?: string[];
  tool_id?: string;
  tool_type?: "local";
  wait_for_result?: boolean;
  speak_during_execution?: boolean;
  global_node_setting?: { condition: PromptCond; go_back_conditions?: FlowEdge[] };
}

const P = (prompt: string): PromptCond => ({ type: "prompt", prompt });
const eq = (variable: string, value: string, operator: "==" | "!=" = "=="): Equation => ({ left: `{{${variable}}}`, operator, right: value });
const EQ = (operator: "||" | "&&", ...equations: Equation[]): EquationCond => ({ type: "equation", equations, operator });

/** Canvas layout: column and row per node (420 px by 240 px cells). */
const LAYOUT: Record<string, [number, number]> = {
  greeting: [4, 0], route_purpose: [4, 1],
  inbound_where: [0, 2], lookup_zone_fn: [0, 3], ask_landmark: [0, 4], lookup_zone_retry_fn: [0, 5], no_instruction_fn: [0, 6],
  read_lookup_result: [1, 4],
  resident_directive: [2, 2], ask_status: [2, 3], ask_needs: [2, 4], record_status_fn: [2, 5], after_record_split: [2, 6],
  teach_back: [2, 7], teach_back_fn: [2, 8], hazard_question: [2, 9], hazard_fn: [1, 10], collection_split: [2, 10],
  collection_offer: [2, 11], salvage_fn: [1, 12],
  location_consent: [3, 6], share_location_fn: [3, 7], location_link_sent: [3, 8], location_declined: [4, 7], record_location_fn: [4, 8],
  qrt_callback: [3, 2],
  linked_contact: [5, 2], linked_record_fn: [5, 3],
  sentinel: [6, 2], sentinel_fn: [6, 3],
  canary: [7, 2], canary_fn: [7, 3],
  test_call: [8, 2], test_fn: [8, 3],
  script_fallback: [9, 2],
  heat_checkin: [10, 2],
  closing: [5, 12], end_call_fn: [5, 13], end: [5, 14],
  g_medical: [7, 6], medical_split: [7, 7], medical_record_fn: [7, 8], medical_link_offer: [7, 9],
  g_unapproved: [8, 6], g_doubts: [9, 6],
};
const pos = (id: string) => {
  const [c, r] = LAYOUT[id] ?? [10, 0];
  return { x: c * 420, y: r * 240 };
};

export interface FlowBuild {
  body: ReturnType<typeof flowBody>;
  warnings: string[];
}

function flowBody(nodes: FlowNode[], tools: FlowTool[], opts: { model: string; dynamicVariables: Record<string, string>; globalPrompt: string }) {
  return {
    start_speaker: "agent" as const,
    model_choice: { type: "cascading" as const, model: opts.model },
    model_temperature: 0.2,
    global_prompt: opts.globalPrompt,
    tools,
    start_node_id: "greeting",
    default_dynamic_variables: opts.dynamicVariables,
    begin_tag_display_position: { x: pos("greeting").x - 260, y: pos("greeting").y },
    notes: [
      {
        id: "note_about",
        content:
          "VoiceFlare (simulated hackathon demo). The agent reads only words a named human approved for the zone: no ETAs, never \"you are safe\". " +
          "Generated by scripts/retell-export.ts from lib/agent/prompt.ts, lib/agent/tools.ts and lib/retell/config.ts. Change the code, then re-run the export.",
        display_position: { x: 10 * 420, y: 0 },
        size: { width: 380, height: 200 },
      },
    ],
    nodes,
  };
}

/** POST /create-conversation-flow body. */
export function buildFlow(opts: { baseUrl: string; model?: string; verificationPhrase: string; callbackNumber: string; template?: string }): FlowBuild {
  const warnings: string[] = [];
  const parts = splitPrompt(opts.template ?? PROMPT_TEMPLATE);
  if (!parts.scriptsSection) warnings.push('The prompt has no "# Scripts by purpose" section: node instructions carry no script lines.');
  for (const p of parts.scripts.keys()) {
    if (!(FLOW_PURPOSES as readonly string[]).includes(p)) {
      warnings.push(`Purpose "${p}" has a script in the prompt but no lane in the flow: it goes to the script_fallback node.`);
    }
  }
  const script = (p: string) => {
    const lines = parts.scripts.get(p);
    return lines?.length ? `\n\nThe script for this call type (same as the single-prompt agent):\n${lines.map((l) => `- ${l}`).join("\n")}` : "";
  };

  const tools = buildFlowTools(opts.baseUrl);
  const ids = new Set(tools.map((t) => t.tool_id));
  const tid = (name: string) => {
    const id = toolId(name);
    if (!ids.has(id)) throw new Error(`flow: no tool "${name}"`);
    return id;
  };

  const nodes: FlowNode[] = [];
  let edgeN = 0;
  const edge = (cond: PromptCond | EquationCond, to: string): FlowEdge => ({ id: `edge_${++edgeN}`, transition_condition: cond, destination_node_id: to });
  const elseTo = (to: string): FlowEdge => edge(P("Else"), to);
  const skipTo = (to: string): FlowEdge => edge(P("Skip response"), to);

  type Opts = { edges?: [PromptCond | EquationCond, string][]; else?: string; skip?: string; global?: string; goBack?: string };
  const common = (o: Opts) => ({
    ...(o.edges?.length ? { edges: o.edges.map(([c, to]) => edge(c, to)) } : {}),
    ...(o.else ? { else_edge: elseTo(o.else) } : {}),
    ...(o.skip ? { skip_response_edge: skipTo(o.skip) } : {}),
    ...(o.global
      ? {
          global_node_setting: {
            condition: P(o.global),
            ...(o.goBack ? { go_back_conditions: [{ id: `edge_${++edgeN}`, transition_condition: P(o.goBack) }] } : {}),
          },
        }
      : {}),
  });
  const conv = (id: string, name: string, text: string, o: Opts = {}) =>
    nodes.push({ id, name, type: "conversation", display_position: pos(id), instruction: { type: "prompt", text }, ...common(o) });
  const sub = (id: string, name: string, text: string, toolNames: string[], o: Opts = {}) =>
    nodes.push({ id, name, type: "subagent", display_position: pos(id), instruction: { type: "prompt", text }, tool_ids: toolNames.map(tid), ...common(o) });
  const fn = (id: string, name: string, tool: string, o: Opts & { say?: string } = {}) =>
    nodes.push({
      id, name, type: "function", display_position: pos(id),
      tool_id: tid(tool), tool_type: "local", wait_for_result: true,
      speak_during_execution: Boolean(o.say),
      ...(o.say ? { instruction: { type: "prompt" as const, text: o.say } } : {}),
      ...common(o),
    });
  const branch = (id: string, name: string, edges: [EquationCond, string][], elseDest: string) =>
    nodes.push({ id, name, type: "branch", display_position: pos(id), edges: edges.map(([c, to]) => edge(c, to)), else_edge: elseTo(elseDest) });

  // --- Greeting and the purpose split ---
  conv(
    "greeting", "👋 Greeting: verification phrase and callback number",
    "Open the call in {{language}}, in two short sentences at most. Say: this is the emergency information line (if the line mode is heat, " +
      "and it is \"{{mode}}\", say \"the heat check-in line\" instead); you are an automated AI voice; " +
      "the verification phrase is \"{{verification_phrase}}\"; the official callback number is {{callback_number}}. " +
      "If simulated is \"true\" (it is \"{{simulated}}\"), also say this is a simulated call for a hackathon demonstration. " +
      "Do not read any directive yet and do not ask a question yet.",
    { skip: "route_purpose" },
  );
  // Heat mode replaces the resident, public-line, callback and linked-contact scripts (lib/agent/prompt.ts, "# Heat mode").
  const heatLane = parts.heatSection ? (["resident", "inbound", "qrt_callback", "linked_contact"] as const) : [];
  branch("route_purpose", "🔀 Call purpose", [
    ...heatLane.map((p): [EquationCond, string] => [EQ("&&", eq("mode", "heat"), eq("purpose", p)), "heat_checkin"]),
    [EQ("&&", eq("purpose", "resident"), eq("stage", "2")), "ask_status"],
    [EQ("||", eq("purpose", "resident")), "resident_directive"],
    [EQ("||", eq("purpose", "inbound")), "inbound_where"],
    [EQ("||", eq("purpose", "qrt_callback")), "qrt_callback"],
    [EQ("||", eq("purpose", "linked_contact")), "linked_contact"],
    [EQ("||", eq("purpose", "sentinel")), "sentinel"],
    [EQ("||", eq("purpose", "canary")), "canary"],
    [EQ("||", eq("purpose", "test")), "test_call"],
  ], "script_fallback");

  // --- Resident: read the approved words, then the questions ---
  conv(
    "resident_directive", "📢 Read the approved directive, word for word",
    "Read the approved texts for this zone now, exactly as written, in this order: the directive \"{{directive_text}}\", the route text \"{{move_text}}\", " +
      "the evacuation point \"{{evac_point}}\". Skip any that is (none). If the call's language differs from a text, translate it faithfully: add nothing, " +
      "remove nothing, soften nothing. Say nothing else: no advice, no time estimate, nothing about the hazard beyond the text. Do not ask a question yet." +
      script("resident"),
    { skip: "ask_status" },
  );
  conv(
    "ask_status", "❓ Status question",
    "Ask one short question for this call's stage, then listen. The stage is {{stage}}.\n" +
      "- Warning (stage 1) or a public-line caller: \"Are you leaving, staying, or already gone?\"\n" +
      "- Check-in (stage 2): \"Have you left?\"\n" +
      "- Order (stage 3): \"Are you leaving now?\"\n" +
      "- Shelter: \"Is anyone hurt or trapped?\"\n" +
      "- Watch: \"Would anyone at the address need help to leave if that changes?\"\n" +
      "If they ask something, answer only from the approved texts, then ask again.",
    {
      edges: [
        [P("The person says they are somewhere other than their home address (they name an address, intersection or landmark)"), "lookup_zone_fn"],
        [P("The person answered the question"), "ask_needs"],
      ],
    },
  );
  conv(
    "ask_needs", "♿ Needs and people",
    "Ask what is still missing, one question at a time:\n" +
      "- unless the stage is shelter or watch: does anyone at the address need help to leave (for example a wheelchair, oxygen, no car, children alone, pets), and how many people are there;\n" +
      "- unless the stage is watch: where they are right now, in their words.\n" +
      "Use the memory note ({{memory_note}}) for one caring question if it is relevant. Then confirm everything back in one sentence, " +
      "for example \"I heard you are leaving with two children for Westchester, is that right?\"",
    { edges: [[P("The person confirmed the summary is right"), "record_status_fn"]] },
  );
  fn("record_status_fn", "📝 record_status", "record_status", {
    edges: [[P("The person needs help now or needs help to leave, or is staying while the zone state ({{zone_state}}) is order"), "location_consent"]],
    else: "after_record_split",
  });
  branch("after_record_split", "🔀 Warning call or public line?", [
    [EQ("||", eq("stage", "1"), eq("purpose", "inbound")), "teach_back"],
  ], "closing");
  conv("teach_back", "🔁 Teach-back", "Ask: \"Where will you go, and by when?\" Then listen.", {
    edges: [[P("The person answered"), "teach_back_fn"]],
  });
  fn("teach_back_fn", "📝 record_status (understood)", "record_status", { else: "hazard_question" });
  conv(
    "hazard_question", "🔥 Do you see smoke or fire?",
    "They are leaving or already safe, so ask once: \"Do you see smoke or fire near you?\" Never ask anyone to go and look.",
    { edges: [[P("The person says they see smoke, fire, damage or injury"), "hazard_fn"]], else: "collection_split" },
  );
  fn("hazard_fn", "📝 report_hazard", "report_hazard", { else: "collection_split" });
  branch("collection_split", "🔀 Collection on file?", [[EQ("&&", eq("collection_note", "(none)", "!=")), "collection_offer"]], "closing");
  conv(
    "collection_offer", "🖼️ Collections line (asked once, last)",
    "A collection is on file: {{collection_note}}. Ask once: \"Do you need help moving the items on your list while there is still time?\" " +
      "Never promise anyone will come.",
    { edges: [[P("The person said yes"), "salvage_fn"]], else: "closing" },
  );
  fn("salvage_fn", "🙋 request_human (salvage)", "request_human_salvage", { else: "closing" });

  // --- Live location, with consent ---
  conv(
    "location_consent", "📍 Live-location consent question",
    "Ask exactly once, translated faithfully if needed: \"Can I text you a link that shares your phone's live location with the response team? " +
      "It stays on only until help reaches you.\" Never pressure them.",
    { edges: [[P("The person clearly said yes to the text link"), "share_location_fn"]], else: "location_declined" },
  );
  fn("share_location_fn", "📲 share_live_location", "share_live_location", { else: "location_link_sent" });
  conv(
    "location_link_sent", "📲 Explain the link",
    "Say what the result says, in one or two short sentences. Link sent: it is on its way; they tap it and press Share; it stays on only until help " +
      "reaches them; they can stop it at any time. A link already on: they can use the link they have. Nothing sent: ask where they are right now, " +
      "in their words. Never say when anyone will arrive and never say a helper is coming; say only that the response team will have their location.",
    { edges: [[P("No link was sent and the person said where they are"), "record_location_fn"]], else: "closing" },
  );
  conv(
    "location_declined", "📍 No link: where are you?",
    "Say that is fine. Ask where they are right now, in their words. Never ask about the link again on this call.",
    { edges: [[P("The person said where they are, or would not say"), "record_location_fn"]] },
  );
  fn("record_location_fn", "📝 record_status (location)", "record_status", { else: "closing" });

  // --- Public line (inbound) and places away from home ---
  conv("inbound_where", "📞 Public line: where are you?", "Ask where they are right now: an address, an intersection or a landmark." + script("inbound"), {
    edges: [[P("The person said where they are"), "lookup_zone_fn"]],
  });
  fn("lookup_zone_fn", "🗺️ lookup_zone", "lookup_zone", {
    say: "One short sentence in the language of the call saying you are checking the instructions for that place.",
    edges: [
      [P("The result names a zone and gives a directive to read"), "read_lookup_result"],
      [P("The result says it could not find that place"), "ask_landmark"],
    ],
    else: "no_instruction_fn",
  });
  conv("ask_landmark", "🗺️ Ask once for a landmark", "Say you could not find that place. Ask once for a nearby intersection or landmark.", {
    edges: [[P("The person named a place"), "lookup_zone_retry_fn"]],
    else: "no_instruction_fn",
  });
  fn("lookup_zone_retry_fn", "🗺️ lookup_zone (second try)", "lookup_zone", {
    say: "One short sentence in the language of the call saying you are checking the instructions for that place.",
    edges: [[P("The result names a zone and gives a directive to read"), "read_lookup_result"]],
    else: "no_instruction_fn",
  });
  conv(
    "read_lookup_result", "📢 Read the directive for that place",
    "Read exactly what the lookup returned for that place, in this order: the directive, the route, the evacuation point. Skip any that is (none). " +
      "Translate faithfully if needed; add nothing. Do not ask a question yet.",
    { skip: "ask_status" },
  );
  fn("no_instruction_fn", "🙋 request_human (no instruction)", "request_human_cannot_answer", {
    say: "Say, in the language of the call, that you have no instructions for their location and a person will call them back.",
    else: "closing",
  });

  // --- Other purposes ---
  conv(
    "qrt_callback", "🚑 Response-team callback",
    "Say you are calling back from the response team about their request for help. Ask, one at a time: is it the same; how many people are with them; " +
      "where are they right now. Then confirm back in one sentence." + script("qrt_callback"),
    { edges: [[P("The person confirmed the summary is right"), "record_status_fn"]] },
  );
  conv(
    "linked_contact", "👪 Linked contact",
    "Say you are calling because {{subject_name}} did not answer. Ask whether they have heard from {{subject_name}}, whether they are leaving, and whether " +
      "they need help. Never say where {{subject_name}} is, or anything else about them. Then confirm back in one sentence." + script("linked_contact"),
    { edges: [[P("The person confirmed the summary is right"), "linked_record_fn"]] },
  );
  fn("linked_record_fn", "📝 record_status (about the subject)", "record_status", { else: "closing" });
  conv(
    "sentinel", "👀 Sentinel: does this match what you see?",
    "Read the alert text exactly: \"{{alert_text}}\". Then ask: \"Does this match what you see? Yes, no, or not sure. What do you see, and in which direction?\" " +
      "Do not tell them to do anything." + script("sentinel"),
    { edges: [[P("The person answered"), "sentinel_fn"]] },
  );
  fn("sentinel_fn", "📝 read_observation", "read_observation", { else: "closing" });
  conv(
    "canary", "🐤 Canary: did the alert arrive?",
    "Do not read the alert. Ask: \"Did you receive an emergency alert on your phone in the last minute? Yes or no.\"" + script("canary"),
    { edges: [[P("The person answered yes or no"), "canary_fn"]] },
  );
  fn("canary_fn", "📝 received_alert", "received_alert", { else: "closing" });
  conv("test_call", "🧪 Monthly test", "Say this is the monthly test of the line. Ask them to say yes if they can hear this." + script("test"), {
    edges: [[P("The person answered"), "test_fn"]],
  });
  fn("test_fn", "📝 received_alert (test)", "received_alert", { else: "closing" });
  sub(
    "script_fallback", "📜 Any other purpose: follow its script",
    "This call's purpose is {{purpose}} (stage {{stage}}). Follow the script for that purpose below, exactly, using the tools it names. " +
      "Do not end the call yourself; when the script is done, stop.\n\n" + (parts.scriptsSection ?? "(no scripts in the prompt)"),
    ["record_status", "report_hazard", "request_human", "lookup_zone", "read_observation", "received_alert", "share_live_location"],
    { edges: [[P("The script for this call is finished"), "closing"]] },
  );

  if (parts.heatSection) {
    sub(
      "heat_checkin", "🌡️ Heat check-in line (mode heat)",
      "This call is on the heat check-in line (purpose {{purpose}}, stage {{stage}}). The greeting is done. Follow the heat mode script below exactly, " +
        "one question at a time, using the tools it names. Read the approved texts word for word: the directive \"{{directive_text}}\" and the route " +
        "text \"{{move_text}}\". Do not end the call yourself; when the script is done, stop.\n\n" + parts.heatSection,
      ["record_status", "request_human", "share_live_location", "lookup_zone"],
      { edges: [[P("The script for this call is finished"), "closing"]] },
    );
  } else {
    warnings.push('The prompt has no "# Heat mode" section: heat calls follow the fire scripts.');
  }

  // --- Closing ---
  conv(
    "closing", "🙏 Thank you and goodbye",
    "Thank them and say goodbye in one or two short sentences. If they asked for help with their collection, say that leaving on time comes first; " +
      "never promise anyone will come. Repeat an approved text only if they ask. Add no advice of your own.",
    { skip: "end_call_fn" },
  );
  fn("end_call_fn", "📝 end_call (records the outcome)", "end_call", { else: "end" });
  nodes.push({ id: "end", name: "📴 Hang up", type: "end", display_position: pos("end") });

  // --- Global nodes: reachable from any step ---
  fn("g_medical", "🚨 Medical emergency: hang up and call now", "request_human_medical", {
    say: "Say exactly, translated faithfully into the language of the call: \"Hang up and call {{emergency_number}} now.\"",
    global: "The person describes a medical emergency, someone trapped, or fire at the house, or, under an order, says they cannot leave",
    else: "medical_split",
  });
  branch("medical_split", "🔀 Can this call share a location?", [
    [EQ("||", eq("purpose", "resident"), eq("purpose", "inbound"), eq("purpose", "qrt_callback")), "medical_record_fn"],
  ], "closing");
  fn("medical_record_fn", "📝 record_status (life safety)", "record_status", { else: "medical_link_offer" });
  conv(
    "medical_link_offer", "📍 Offer the link once",
    "Ask once, exactly: \"Can I text you a link that shares your phone's live location with the response team? It stays on only until help reaches you.\" " +
      "If they do not clearly say yes at once, the call ends.",
    { edges: [[P("The person clearly said yes to the text link"), "share_location_fn"]], else: "closing" },
  );
  sub(
    "g_unapproved", "🚫 Not approved to answer (ETA and the like)",
    "Say exactly, translated faithfully: \"I can't answer that; a person will call you back.\" Call request_human with reason asked_unapproved and a short note " +
      "of what they asked (for example \"asked for an ETA\"). Never guess a time, never say anyone is safe, never say where another person is. " +
      "Then ask if there is anything else.",
    ["request_human"],
    {
      global:
        "The person asks for something the approved text does not answer: when help or a helper will arrive, any time estimate, whether it is safe to stay, " +
        "where another person is, or any other question you cannot answer from the approved text",
      goBack: "The person moved on: they said okay, answered an earlier question, or asked something the approved text covers",
      edges: [[P("The person has nothing else and wants to finish the call"), "closing"]],
    },
  );
  sub(
    "g_doubts", "🛡️ Doubts the call is real",
    "Repeat the verification phrase \"{{verification_phrase}}\" and the official callback number {{callback_number}}. Call request_human with reason doubts_call. " +
      "Then ask whether they are willing to go on.",
    ["request_human"],
    {
      global: "The person doubts the call is real, or asks whether it is a scam",
      goBack: "The person agrees to go on",
      edges: [[P("The person does not want to go on"), "closing"]],
    },
  );

  // Every edge must land on a node.
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const n of nodes) {
    for (const e of [...(n.edges ?? []), n.else_edge, n.skip_response_edge]) {
      if (e?.destination_node_id && !nodeIds.has(e.destination_node_id)) throw new Error(`flow: ${n.id} points at missing node ${e.destination_node_id}`);
    }
  }

  const body = flowBody(nodes, tools, {
    model: opts.model ?? DEFAULT_RETELL_LLM_MODEL,
    dynamicVariables: defaultDynamicVariables({ verificationPhrase: opts.verificationPhrase, callbackNumber: opts.callbackNumber }),
    globalPrompt: flowGlobalPrompt(parts),
  });
  return { body, warnings };
}

/** POST /create-agent body for a conversation-flow agent: the single-prompt agent's settings, another engine. */
export function buildFlowAgentPayload(l: RetellLang, opts: { flowId: string; voiceId: string; baseUrl: string; analysisModel?: string }) {
  const base = buildAgentPayload(l, { llmId: "unused", voiceId: opts.voiceId, baseUrl: opts.baseUrl, analysisModel: opts.analysisModel });
  const { response_engine: _unused, ...rest } = base;
  void _unused;
  return {
    ...rest,
    agent_name: `VoiceFlare ${l.lang.name} flow (${l.retellLanguage})`,
    response_engine: { type: "conversation-flow" as const, conversation_flow_id: opts.flowId },
  };
}
