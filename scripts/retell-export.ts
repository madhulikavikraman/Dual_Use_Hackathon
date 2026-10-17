// Generate the Retell kit in docs/retell/ from the code, so what goes on the Retell dashboard never drifts
// from what the app and scripts/retell-setup.ts use:
//   voiceflare-retell-llm.json         POST /create-retell-llm body (single prompt agent)
//   voiceflare-agent.json              POST /create-agent body, English, single prompt (response_engine: retell-llm)
//   voiceflare-conversation-flow.json  POST /create-conversation-flow body (the visual flow builder)
//   voiceflare-flow-agent.json         POST /create-agent body, English, conversation flow
//   functions/<name>.json              one custom function each, as the dashboard's function form wants it
//   dynamic-variables.sample.json      values for the dashboard test panel
//   prompt.md                          the prompt and every dynamic variable, explained
//   retell-kit.html                    one page: every dashboard field in order, a Copy button per block
//
//   npx tsx scripts/retell-export.ts                         uses APP_BASE_URL when it is a public https URL
//   npx tsx scripts/retell-export.ts --base-url=https://...  or a URL you pass
// With neither, URLs are written as {{APP_BASE_URL}}/... for you to replace (the kit page has a box that does it).
// Reads only pure modules: lib/retell/config.ts, lib/retell/flow.ts, lib/agent/*, lib/directives.ts.
import { config } from "dotenv";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { directiveFor } from "../lib/directives";
import { retellPromptTemplate } from "../lib/agent/prompt";
import {
  buildAgentPayload,
  buildLlmPayload,
  buildPhoneNumberPayload,
  DEFAULT_RETELL_ANALYSIS_MODEL,
  DEFAULT_RETELL_LLM_MODEL,
  DEFAULT_RETELL_VOICE,
  defaultDynamicVariables,
  inboundUrl,
  POST_CALL_ANALYSIS,
  promptPlaceholders,
  RETELL_LANGS,
  VOICEMAIL_PROMPT,
  webhookUrl,
} from "../lib/retell/config";
import { buildFlow, buildFlowAgentPayload, type FlowNode } from "../lib/retell/flow";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const argv = process.argv.slice(2);
const opt = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const env = (k: string) => process.env[k]?.trim() || undefined;

const OUT = resolve(opt("out") ?? "docs/retell");
/** Every top-level name this script writes in OUT (and the only ones it ever deletes). */
const GENERATED = new Set([
  "voiceflare-retell-llm.json", "voiceflare-agent.json", "voiceflare-conversation-flow.json", "voiceflare-flow-agent.json",
  "functions", "dynamic-variables.sample.json", "prompt.md", "retell-kit.html",
]);
const PLACEHOLDER_BASE = "{{APP_BASE_URL}}";

function pickBaseUrl(): { base: string; real: boolean; note: string } {
  const raw = opt("base-url") ?? env("APP_BASE_URL");
  if (!raw) return { base: PLACEHOLDER_BASE, real: false, note: "APP_BASE_URL is not set: URLs use the {{APP_BASE_URL}} placeholder" };
  try {
    const url = new URL(raw);
    const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/.test(url.hostname);
    if (url.protocol === "https:" && !local) return { base: url.origin, real: true, note: `URLs use ${url.origin}` };
    return { base: PLACEHOLDER_BASE, real: false, note: `"${raw}" is not a public https URL (Retell blocks localhost): URLs use the {{APP_BASE_URL}} placeholder` };
  } catch {
    return { base: PLACEHOLDER_BASE, real: false, note: `"${raw}" is not a URL: URLs use the {{APP_BASE_URL}} placeholder` };
  }
}

const { base, real, note: baseNote } = pickBaseUrl();
const model = opt("model") ?? env("RETELL_LLM_MODEL") ?? DEFAULT_RETELL_LLM_MODEL;
const verificationPhrase = env("VERIFICATION_PHRASE") ?? "blue heron";
const callbackNumber = env("CALLBACK_NUMBER") ?? "(213) 555-0142";
const EN = RETELL_LANGS.find((l) => l.suffix === "EN") ?? RETELL_LANGS[0];
const voiceEn = env("RETELL_VOICE_EN") ?? DEFAULT_RETELL_VOICE;
const llmIdForAgent = env("RETELL_LLM_ID") ?? "{{RETELL_LLM_ID}}";
const flowIdForAgent = env("RETELL_FLOW_ID") ?? "{{RETELL_FLOW_ID}}";

// ---------- Build everything from the code ----------

const llmRaw = buildLlmPayload({ baseUrl: base, model, verificationPhrase, callbackNumber });
// begin_message null = "AI speaks first, dynamic message": the opening must be in the call's language and say the
// verification phrase, so the model writes it from the prompt. (retell-setup.ts leaves it unset, which is the same.)
const { model: _m, model_temperature, start_speaker, ...llmRest } = llmRaw;
void _m;
const llm = { model, model_temperature, start_speaker, begin_message: null as string | null, ...llmRest };
const agent = buildAgentPayload(EN, { llmId: llmIdForAgent, voiceId: voiceEn, baseUrl: base });
const flowBuild = buildFlow({ baseUrl: base, model, verificationPhrase, callbackNumber });
const flow = flowBuild.body;
const flowAgent = buildFlowAgentPayload(EN, { flowId: flowIdForAgent, voiceId: voiceEn, baseUrl: base });
const phone = buildPhoneNumberPayload({ agentId: "{{RETELL_AGENT_ID_EN}}", baseUrl: base });
type LlmTool = (typeof llm.general_tools)[number];
const customTools = llm.general_tools.filter((t): t is Extract<LlmTool, { type: "custom" }> => t.type === "custom");
const endCallTool = llm.general_tools.find((t): t is Extract<LlmTool, { type: "end_call" }> => t.type === "end_call");

// ---------- Dynamic variables: what each one is, and samples for the test panel ----------

const VAR_INFO: Record<string, string> = {
  purpose: "Kind of call: resident, inbound (the public line), sentinel, canary, linked_contact, qrt_callback or test.",
  stage: "Where the call sits on the ladder: 1 (warning), 2 (check-in), 3 (order), shelter, watch, hold (sentinel), canary, callback (response team) or inbound.",
  language: "The call's language, by name. The agent speaks only this language unless the person answers in another.",
  person_name: "The enrolled person or household being called.",
  zone_name: "The zone the person is in.",
  zone_state: "The zone's state on the Cal OES ladder: monitor, watch, warning, order, shelter_in_place or lifted.",
  directive_text: "The directive a named human approved for the zone. Read word for word.",
  move_text: "The approved route text. Read word for word.",
  evac_point: "The approved evacuation point.",
  alert_text: "The alert text. Sentinels hear it and say if it matches what they see; canaries never hear it.",
  verification_phrase: "Said at the start of every call so people can tell the call is real.",
  callback_number: "The official callback number.",
  emergency_number: "What \"Hang up and call ... now\" says in this place.",
  memory_note: "One fact kept from an earlier call, if any.",
  collection_note: "Collections line only: what they hold and their grab list.",
  subject_name: "Linked-contact calls: the person we are asking about.",
  simulated: "\"true\" on demo calls: the agent says the call is simulated.",
};

async function scenarioSample(): Promise<{ move_text: string; evac_point: string; source: string }> {
  try {
    const { WESTSIDE_PRESETS } = await import("../lib/scenarios/westside");
    const p = WESTSIDE_PRESETS["LA-CC"]?.warning;
    if (p?.move_text) return { move_text: p.move_text, evac_point: p.evac_point ?? "(none)", source: "lib/scenarios/westside.ts (LA-CC, warning)" };
  } catch (e) {
    console.warn(`! could not read the westside scenario for sample values (${(e as Error).message}); using (none)`);
  }
  return { move_text: "(none)", evac_point: "(none)", source: "(scenario not readable)" };
}

function completeVars(over: Record<string, string>): Record<string, string> {
  const out = defaultDynamicVariables({ verificationPhrase, callbackNumber });
  for (const k of Object.keys(out)) if (over[k] !== undefined) out[k] = over[k];
  return out;
}

// ---------- Small helpers ----------

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const onOff = (b: boolean | undefined) => (b ? "ON" : "OFF");
const ms = (n: number) => (n % 1000 === 0 ? `${n / 1000} s` : `${n} ms`);
const TYPE_LABEL: Record<string, string> = { enum: "Selector", string: "Text", number: "Number", boolean: "Boolean" };
const NODE_TYPE_LABEL: Record<FlowNode["type"], string> = {
  conversation: "Conversation", subagent: "Subagent (dialogue + tools)", function: "Function", branch: "Logic split", end: "End",
};

function writeOut(rel: string, content: string) {
  const path = join(OUT, rel);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content, "utf8");
  return rel;
}

// ---------- prompt.md ----------

function promptMd(samples: { resident: Record<string, string>; inbound: Record<string, string>; sentinel: Record<string, string> }, sampleSource: string) {
  const placeholders = promptPlaceholders();
  const defaults = defaultDynamicVariables({ verificationPhrase, callbackNumber });
  const rows = placeholders.map((k) => {
    const info = VAR_INFO[k] ?? "New in the prompt: see lib/agent/prompt.ts.";
    const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
    return `| \`{{${k}}}\` | ${cell(info)} | ${cell(samples.resident[k] ?? "(none)")} | ${cell(defaults[k] ?? "(none)")} |`;
  });
  return `# VoiceFlare agent prompt

> Generated by \`scripts/retell-export.ts\` from \`lib/agent/prompt.ts\`. Do not edit this file: change the code and run
> \`npx tsx scripts/retell-export.ts\` again. One template serves both transports: the browser phone renders it, Retell fills
> the \`{{placeholders}}\` from each call's dynamic variables.

## Single prompt agent: the Prompt box

Paste everything inside the block into the agent's prompt. Welcome message: **AI speaks first, Dynamic message** (no fixed
begin message: the opening must be in the call's language and say the verification phrase).

\`\`\`text
${retellPromptTemplate()}
\`\`\`

## Dynamic variables

VoiceFlare sends all of these on every call (outbound: \`retell_llm_dynamic_variables\`; inbound: the inbound webhook's
\`dynamic_variables\`). Retell leaves a missing one as raw \`{{name}}\`, so the agent also carries a default for each
(**Security & fallback settings, Default dynamic variables**). Sample values are a synthetic resident warning call in
Culver City and Palms (route and evacuation point from ${sampleSource}). Every sample is simulated.

| Variable | What it is | Sample (resident, warning) | Default |
| --- | --- | --- | --- |
${rows.join("\n")}

## Test panel samples

Paste one block into the dashboard test panel's dynamic variables, then start a web call. A dashboard test call is not
linked to a VoiceFlare call, so the tools answer "Nothing was recorded: this call is not linked to the response system".
That is expected. For a linked test, call the Retell number (inbound) or approve a zone on the board (outbound).

### Resident, evacuation warning (stage 1)

\`\`\`json
${JSON.stringify(samples.resident, null, 2)}
\`\`\`

### Public line (inbound): the defaults

\`\`\`json
${JSON.stringify(samples.inbound, null, 2)}
\`\`\`

### Sentinel during a 90-second hold

\`\`\`json
${JSON.stringify(samples.sentinel, null, 2)}
\`\`\`

## Conversation flow: the global prompt

The flow agent uses the same rules. Its global prompt is the template above without "# Scripts by purpose" (each script
line moves into the node that runs it), plus a short note on how the flow works:

\`\`\`text
${flow.global_prompt}
\`\`\`
`;
}

// ---------- retell-kit.html ----------

function kitHtml(samples: { resident: Record<string, string>; inbound: Record<string, string>; sentinel: Record<string, string> }) {
  const blocks: Record<string, string> = {};
  let n = 0;
  const block = (label: string, text: string, big = false) => {
    const id = `b${++n}`;
    blocks[id] = text;
    return `<div class="block${big ? " big" : ""}">
  <div class="block-bar"><span class="block-label">${esc(label)}</span><button type="button" class="copy" data-copy="${id}" aria-label="Copy: ${esc(label)}">Copy</button></div>
  <pre id="${id}" tabindex="0" aria-label="${esc(label)}">${esc(text)}</pre>
</div>`;
  };
  const kv = (label: string, value: string, hint = "") => `<div class="kv"><div class="kv-label">${esc(label)}${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</div><div class="kv-value">${esc(value)}</div></div>`;
  const chip = (label: string, on: boolean | null) => `<span class="chip${on === null ? "" : on ? " on" : " off"}">${esc(label)}</span>`;

  const sections: { id: string; icon: string; title: string; html: string }[] = [];
  const add = (id: string, icon: string, title: string, html: string) => sections.push({ id, icon, title, html });

  add("start", "🧭", "Before you start", `
<p>This page holds every value the Retell dashboard asks for, in the order it asks. Each block has a Copy button.
Everything is generated from the code (<code>lib/agent/prompt.ts</code>, <code>lib/agent/tools.ts</code>,
<code>lib/retell/config.ts</code>, <code>lib/retell/flow.ts</code>) by <code>npx tsx scripts/retell-export.ts</code>.</p>
<ul>
  <li>Retell must reach your server over public HTTPS. Start a tunnel: <code>npx cloudflared tunnel --url http://localhost:3000</code>.</li>
  <li>Use the Retell API key with the <b>webhook badge</b> as <code>RETELL_API_KEY</code>: only that key verifies the signatures on tool calls and webhooks.</li>
  <li>The fastest path is the script, not this page: <code>npx tsx scripts/retell-setup.ts</code> creates the same agent through the API. See <code>docs/retell/README.md</code>.</li>
</ul>
<div class="urlbox">
  <label for="base-url">Your public HTTPS URL</label>
  <input id="base-url" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://your-tunnel.trycloudflare.com" value="${real ? esc(base) : ""}">
  <p class="hint" id="base-hint">Every URL on this page updates as you type. ${real ? `The export used ${esc(base)}.` : "The export had no public URL, so URLs show {{APP_BASE_URL}} until you fill this in."}</p>
</div>`);

  add("type", "🤔", "Which agent type?", `
<div class="two">
  <div class="card"><h3>✅ Single prompt <span class="tag">recommended</span></h3>
  <p>What the code is built around. The browser phone, the tests and <code>scripts/retell-setup.ts</code> all use this one prompt and these eight tools. The model follows the script for each kind of call; the tool allowlist is the hard boundary.</p></div>
  <div class="card"><h3>🧩 Conversation flow</h3>
  <p>The same rules split into ${flow.nodes.length} nodes on Retell's visual canvas: greeting, a purpose split, the directive read word for word, the questions, the live-location consent, and global nodes for a medical emergency, an unapproved question (an ETA) and a doubting caller. Create it with <code>npx tsx scripts/retell-flow-setup.ts --create</code>. Retell's docs describe no JSON import for agents or flows, so a flow goes on the dashboard through the API (or by hand from the node list below).</p></div>
</div>`);

  add("agent", "🆕", "1. Create the agent", `
<p>Agents, then <b>Create an agent</b>, <b>Single prompt</b>, <b>Build from scratch</b>. One agent per language; start with English.</p>
${block("Agent name", agent.agent_name)}
<table><caption>One agent per language (all use the same prompt and tools)</caption><thead><tr><th>Env var for its id</th><th>Language</th><th>Retell language</th></tr></thead><tbody>
${RETELL_LANGS.map((l) => `<tr><td><code>${esc(l.envVar)}</code></td><td>${esc(l.lang.name)}</td><td><code>${esc(l.retellLanguage)}</code></td></tr>`).join("\n")}
</tbody></table>`);

  add("model", "🧠", "2. Model, voice, language", `
${kv("Model", llm.model, "agent toolbar")}
${kv("Temperature", String(llm.model_temperature), "model settings")}
${kv("Voice", agent.voice_id, "voice picker; any voice with an American accent works for English")}
${kv("Language", String(agent.language))}
${kv("Post-call analysis model", agent.post_call_analysis_model ?? DEFAULT_RETELL_ANALYSIS_MODEL, "Post Call Extraction")}`);

  add("prompt", "📜", "3. Prompt", `
<p>Paste into the large prompt box. The <code>{{placeholders}}</code> stay as they are: Retell fills them on every call.</p>
${block("Prompt (general_prompt)", llm.general_prompt, true)}`);

  add("welcome", "👋", "4. Welcome message", `
${kv("Welcome Message", "AI speaks first, then Dynamic message", "begin_message: none")}
${kv("Pause Before Speaking", ms(agent.begin_message_delay_ms), "begin_message_delay_ms")}
<p class="hint">No fixed opening line: the agent must greet in the call's language with the verification phrase, and say the call is simulated on demo calls. The prompt tells it how.</p>`);

  const fnCards = customTools.map((t) => {
    const execMsg = (t as { execution_message_description?: string }).execution_message_description;
    return `<article class="card fn" id="fn-${esc(t.name)}">
<h3>🔧 ${esc(t.name)}</h3>
<div class="chips">${chip(`Talk While Waiting: ${onOff(t.speak_during_execution)}`, t.speak_during_execution)}${chip(`Talk After Action Completed: ${onOff(t.speak_after_execution)}`, t.speak_after_execution)}${chip("Payload: args only: OFF", false)}${chip(`Timeout: ${t.timeout_ms} ms`, null)}${chip(`Retries: ${t.max_retry}`, null)}</div>
${block(`${t.name}: name`, t.name)}
${block(`${t.name}: description`, t.description)}
${block(`${t.name}: API endpoint (${t.method})`, t.url)}
${block(`${t.name}: timeout (ms)`, String(t.timeout_ms))}
${block(`${t.name}: parameters (JSON schema)`, JSON.stringify(t.parameters, null, 2), true)}
${execMsg ? block(`${t.name}: Talk While Waiting message (prompt)`, execMsg) : ""}
<details><summary>Whole function as JSON (API shape, also in functions/${esc(t.name)}.json)</summary>${block(`${t.name}: JSON`, JSON.stringify(t, null, 2), true)}</details>
</article>`;
  });
  add("functions", "🔧", `5. Functions (${customTools.length} custom + end call)`, `
<p>In <b>Functions</b>, click <b>+ Add</b>, then <b>Custom Function</b>, once per tool. Method <b>POST</b> for all. Leave headers and query parameters empty, and leave <b>Payload: args only</b> off: the server needs the <code>call</code> object to find the VoiceFlare call. Every request is signed (<code>X-Retell-Signature</code>) and checked.</p>
<nav class="fn-index" aria-label="Functions">${customTools.map((t) => `<a href="#fn-${esc(t.name)}">${esc(t.name)}</a>`).join("")}</nav>
${fnCards.join("\n")}
${endCallTool ? `<article class="card fn" id="fn-${esc(endCallTool.name)}"><h3>📴 ${esc(endCallTool.name)} <span class="tag">End Call</span></h3>
<p>Add an <b>End Call</b> function (not a custom one). Our <code>end_call</code> only records the outcome; this one hangs up. Tool names must be unique, so it is named <code>${esc(endCallTool.name)}</code>.</p>
${block(`${endCallTool.name}: name`, endCallTool.name)}
${block(`${endCallTool.name}: description`, endCallTool.description)}
<div class="chips">${chip(`Talk While Waiting: ${onOff(endCallTool.speak_during_execution)}`, endCallTool.speak_during_execution)}</div></article>` : ""}`);

  add("speech", "🎙️", "6. Speech settings", `
${kv("Interruption Sensitivity", "Keep the default (1)", "a person must always be able to cut in")}
${kv("Response Wait time", "Keep the default (no added wait)")}
${kv("Reminder Message Frequency", "Keep the default (10 s, once)")}
<p class="hint">VoiceFlare sets none of these through the API; the values above are Retell's documented defaults.</p>`);

  add("call", "📞", "7. Call settings", `
${kv("Voicemail detection", "On: leave a message (prompt)", "voicemail_option")}
${block("Voicemail message prompt", VOICEMAIL_PROMPT)}
${kv("End Call on Silence", ms(agent.end_call_after_silence_ms), "end_call_after_silence_ms; no answer is never safe: the board marks silence")}
${kv("Max Call Duration", ms(agent.max_call_duration_ms), "calls are meant to be under 90 s")}
${kv("Ring Duration", ms(agent.ring_duration_ms))}
${kv("Timezone", agent.timezone)}`);

  add("extraction", "🧾", "8. Post call extraction", `
<p>Add each field as a custom category. Names must match exactly: the webhook reads <code>call_analysis.custom_analysis_data</code> by these names.</p>
${POST_CALL_ANALYSIS.map((f) => `<article class="card">
<h3>${esc(f.name)} <span class="tag">${esc(TYPE_LABEL[f.type] ?? f.type)}</span>${f.required ? "" : ' <span class="tag muted">optional</span>'}</h3>
${block(`${f.name}: name`, f.name)}
${block(`${f.name}: description`, f.description)}
${"choices" in f ? block(`${f.name}: choices (one per line)`, (f.choices as string[]).join("\n")) : ""}
</article>`).join("\n")}
<details><summary>All fields as JSON (post_call_analysis_data)</summary>${block("post_call_analysis_data", JSON.stringify(POST_CALL_ANALYSIS, null, 2), true)}</details>`);

  add("defaults", "🛟", "9. Default dynamic variables", `
<p>In <b>Security &amp; fallback settings</b>. Used only when a call arrives without variables (for example the inbound webhook failed): a public-line call, simulated.</p>
${block("default_dynamic_variables", JSON.stringify(llm.default_dynamic_variables, null, 2), true)}`);

  add("webhook", "🔔", "10. Webhook", `
${block("Agent webhook URL", agent.webhook_url)}
${kv("Events", agent.webhook_events.join(", "))}`);

  add("number", "☎️", "11. Phone number", `
<p>Phone Numbers, then your number: set this agent as the inbound and the outbound agent, and turn on the inbound call webhook with this URL. Calls in other languages switch agent per call (the app passes the language's agent id).</p>
${block("Inbound call webhook URL", phone.inbound_webhook_url)}
${kv("Nickname", phone.nickname)}
<p>Then paste the agent ids into <code>.env.local</code> and restart the dev server:</p>
${block(".env.local lines", [`RETELL_AGENT_ID_EN=agent_...`, `RETELL_FROM_NUMBER=+1XXXXXXXXXX`, `APP_BASE_URL=${base}`].join("\n"))}`);

  add("test", "🧪", "12. Test", `
<p>Click <b>Test</b> for a web call. Put one of these in the test panel's dynamic variables first. A dashboard test call is not linked to a VoiceFlare call, so tools answer "Nothing was recorded: this call is not linked to the response system". That is expected. For a linked test, call the number (inbound) or approve a zone on the board (outbound).</p>
${block("Resident, evacuation warning (synthetic sample)", JSON.stringify(samples.resident, null, 2), true)}
${block("Public line, inbound (the defaults)", JSON.stringify(samples.inbound, null, 2), true)}
${block("Sentinel during a 90-second hold (synthetic sample)", JSON.stringify(samples.sentinel, null, 2), true)}`);

  const byId = new Map(flow.nodes.map((nd) => [nd.id, nd]));
  const dest = (id?: string) => (id ? `${esc(byId.get(id)?.name ?? id)}` : "back to where the call was");
  const cond = (c: { type: string; prompt?: string; equations?: { left: string; operator: string; right: string }[]; operator?: string }) =>
    c.type === "prompt"
      ? esc(c.prompt ?? "")
      : esc((c.equations ?? []).map((e) => `${e.left} ${e.operator} "${e.right}"`).join(c.operator === "&&" ? " and " : " or "));
  const nodeRows = flow.nodes.map((nd) => {
    const out: string[] = [];
    for (const e of nd.edges ?? []) out.push(`<li>${cond(e.transition_condition)} → ${dest(e.destination_node_id)}</li>`);
    if (nd.skip_response_edge) out.push(`<li>after speaking → ${dest(nd.skip_response_edge.destination_node_id)}</li>`);
    if (nd.else_edge) out.push(`<li>otherwise → ${dest(nd.else_edge.destination_node_id)}</li>`);
    for (const g of nd.global_node_setting?.go_back_conditions ?? []) out.push(`<li>${cond(g.transition_condition)} → back to where the call was</li>`);
    const tool = nd.tool_id ? flow.tools.find((t) => t.tool_id === nd.tool_id)?.name : null;
    const tools = nd.tool_ids?.map((t) => flow.tools.find((x) => x.tool_id === t)?.name ?? t).join(", ");
    return `<tr><td><b>${esc(nd.name)}</b><br><code>${esc(nd.id)}</code>${nd.global_node_setting ? `<br><span class="tag">global: ${esc(nd.global_node_setting.condition.prompt)}</span>` : ""}</td>
<td>${esc(NODE_TYPE_LABEL[nd.type])}${tool ? `<br>calls <code>${esc(tool)}</code>` : ""}${tools ? `<br>tools: <code>${esc(tools)}</code>` : ""}</td>
<td>${out.length ? `<ul>${out.join("")}</ul>` : "ends the call"}</td></tr>`;
  });
  add("flow", "🧩", "Conversation flow", `
<p>Create it through the API (it then appears under Agents, ready to test):</p>
${block("Create the flow and an English flow agent", "npx tsx scripts/retell-flow-setup.ts            # dry run: prints the payloads\nnpx tsx scripts/retell-flow-setup.ts --create   # creates them and prints the ids")}
<p>Global settings: model <code>${esc(flow.model_choice.model)}</code>, temperature ${flow.model_temperature}, agent speaks first, start node <code>${esc(flow.start_node_id)}</code>. The flow agent takes the same voice, webhook, post-call extraction and call settings as the single prompt agent (steps 2, 7 to 10). ${flow.tools.length} functions: the ${customTools.length} above plus ${flow.tools.length - customTools.length} copies of <code>request_human</code> with the reason fixed, for function nodes. Function nodes run their tool on entry and move on when it returns; the end node hangs up.</p>
${block("Global prompt (flow)", flow.global_prompt, true)}
<div class="table-wrap"><table class="nodes"><caption>${flow.nodes.length} nodes</caption><thead><tr><th>Node</th><th>Type</th><th>Goes to</th></tr></thead><tbody>
${nodeRows.join("\n")}
</tbody></table></div>
<details><summary>Whole flow as JSON (POST /create-conversation-flow, also voiceflare-conversation-flow.json)</summary>${block("voiceflare-conversation-flow.json", JSON.stringify(flow, null, 2), true)}</details>`);

  add("files", "📁", "Files in docs/retell", `
<ul class="files">
<li><code>README.md</code>: three ways onto the dashboard, and what to do after.</li>
<li><code>voiceflare-retell-llm.json</code>: POST /create-retell-llm body.</li>
<li><code>voiceflare-agent.json</code>: POST /create-agent body (single prompt, English).</li>
<li><code>voiceflare-conversation-flow.json</code>: POST /create-conversation-flow body.</li>
<li><code>voiceflare-flow-agent.json</code>: POST /create-agent body (conversation flow, English).</li>
<li><code>functions/*.json</code>: one function each.</li>
<li><code>dynamic-variables.sample.json</code>: test panel values.</li>
<li><code>prompt.md</code>: the prompt and every variable.</li>
</ul>`);

  const nav = sections.map((s) => `<a href="#${s.id}"><span aria-hidden="true">${s.icon}</span> ${esc(s.title)}</a>`).join("\n");
  const main = sections.map((s) => `<section id="${s.id}" aria-labelledby="h-${s.id}"><h2 id="h-${s.id}"><span aria-hidden="true">${s.icon}</span> ${esc(s.title)}</h2>${s.html}</section>`).join("\n");
  const data = JSON.stringify({ base, blocks }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VoiceFlare Retell Kit</title>
<meta name="description" content="Every Retell dashboard field for the VoiceFlare voice agent, in order, with a Copy button per block. Generated from the code.">
<style>
:root{--bg:#f7f7f5;--panel:#ffffff;--ink:#1d1d1b;--muted:#5f5f5a;--line:#e3e2dc;--accent:#c2410c;--accent-ink:#ffffff;--code:#f1f0ea;--on:#166534;--on-bg:#dcfce7;--off:#6b6b66;--off-bg:#efeee9;--focus:#2563eb;--warn:#92400e;--warn-bg:#fef3c7}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#141413;--panel:#1d1d1b;--ink:#ecebe6;--muted:#a3a29b;--line:#34332f;--accent:#fb923c;--accent-ink:#1d1d1b;--code:#262623;--on:#86efac;--on-bg:#14301f;--off:#a3a29b;--off-bg:#2a2a27;--focus:#93c5fd;--warn:#fcd34d;--warn-bg:#3a2e10}}
:root[data-theme="dark"]{--bg:#141413;--panel:#1d1d1b;--ink:#ecebe6;--muted:#a3a29b;--line:#34332f;--accent:#fb923c;--accent-ink:#1d1d1b;--code:#262623;--on:#86efac;--on-bg:#14301f;--off:#a3a29b;--off-bg:#2a2a27;--focus:#93c5fd;--warn:#fcd34d;--warn-bg:#3a2e10}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
code,pre,.kv-value{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13.5px}
code{background:var(--code);padding:1px 5px;border-radius:4px;overflow-wrap:anywhere}
a{color:var(--accent)}
:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.skip{position:absolute;left:-999px;top:8px;background:var(--panel);padding:8px 12px;border-radius:6px}
.skip:focus{left:16px;z-index:10}
header.top{padding:28px 16px 20px;border-bottom:1px solid var(--line);background:var(--panel)}
header.top .inner{max-width:1180px;margin:0 auto}
header h1{margin:0 0 6px;font-size:28px;line-height:1.2}
header p{margin:0;color:var(--muted);max-width:70ch}
.badge{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:var(--warn-bg);color:var(--warn);font-size:12px;font-weight:600;vertical-align:middle}
.layout{max-width:1180px;margin:0 auto;padding:0 16px;display:grid;grid-template-columns:1fr;gap:24px}
@media (min-width:960px){.layout{grid-template-columns:240px minmax(0,1fr)}}
.toc{display:none}
@media (min-width:960px){.toc{display:flex;flex-direction:column;gap:2px;position:sticky;top:0;align-self:start;max-height:100vh;overflow:auto;padding:20px 0}}
.toc a{color:var(--ink);text-decoration:none;padding:6px 10px;border-radius:6px;font-size:14px}
.toc a:hover{background:var(--code)}
main{min-width:0;padding:8px 0 64px}
section{padding:20px 0;border-bottom:1px solid var(--line)}
h2{font-size:21px;margin:0 0 12px}
h3{font-size:16px;margin:0 0 8px}
p{max-width:75ch}
.hint{display:block;color:var(--muted);font-size:13px;font-weight:400}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:12px 0}
.two{display:grid;gap:12px;grid-template-columns:1fr}
@media (min-width:720px){.two{grid-template-columns:1fr 1fr}}
.tag{display:inline-block;font-size:12px;font-weight:600;padding:1px 8px;border-radius:999px;background:var(--code);color:var(--muted);vertical-align:middle}
.tag.muted{font-weight:400}
.block{margin:8px 0;border:1px solid var(--line);border-radius:8px;background:var(--panel);overflow:hidden}
.block-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px 6px 12px;border-bottom:1px solid var(--line);background:var(--code)}
.block-label{font-size:13px;color:var(--muted);overflow-wrap:anywhere}
.copy{flex:none;font:inherit;font-size:13px;font-weight:600;padding:5px 12px;border-radius:6px;border:0;background:var(--accent);color:var(--accent-ink);cursor:pointer;min-height:32px}
.copy[data-done]{background:var(--on);color:var(--panel)}
pre{margin:0;padding:10px 12px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto}
.block.big pre{max-height:420px}
.kv{display:grid;grid-template-columns:1fr;gap:2px 16px;padding:8px 0;border-bottom:1px dashed var(--line)}
@media (min-width:640px){.kv{grid-template-columns:260px 1fr}}
.kv-label{font-weight:600}
.kv-value{overflow-wrap:anywhere}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}
.chip{font-size:12.5px;padding:2px 9px;border-radius:999px;background:var(--code);color:var(--muted);border:1px solid var(--line)}
.chip.on{background:var(--on-bg);color:var(--on)}
.chip.off{background:var(--off-bg);color:var(--off)}
.fn-index{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.fn-index a{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;padding:3px 9px;border:1px solid var(--line);border-radius:6px;text-decoration:none;color:var(--ink);background:var(--panel)}
.urlbox{background:var(--panel);border:2px solid var(--accent);border-radius:10px;padding:14px 16px;margin-top:12px}
.urlbox label{font-weight:700;display:block;margin-bottom:6px}
.urlbox input{width:100%;font:inherit;font-family:ui-monospace,Menlo,Consolas,monospace;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}
.urlbox .bad{color:var(--warn)}
table{border-collapse:collapse;width:100%;font-size:14px;margin:8px 0}
caption{text-align:left;color:var(--muted);font-size:13px;padding:4px 0}
th,td{border-bottom:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}
.table-wrap{overflow-x:auto}
table.nodes{min-width:640px}
table.nodes ul{margin:0;padding-left:18px}
details{margin:8px 0}
summary{cursor:pointer;font-weight:600;padding:6px 0}
.toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:8px 14px;border-radius:8px;font-size:14px;opacity:0;pointer-events:none;transition:opacity .2s}
.toast.show{opacity:1}
@media (prefers-reduced-motion: reduce){.toast{transition:none}}
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="inner">
<h1><span aria-hidden="true">📟</span> VoiceFlare Retell kit <span class="badge">Simulated demo</span></h1>
<p>Put the VoiceFlare voice agent on the Retell dashboard by hand: every field, in order, ready to copy. The agent reads only words a named human approved. It never gives an ETA and never says anyone is safe.</p>
</div></header>
<div class="layout">
<nav class="toc" aria-label="Sections">${nav}</nav>
<main id="main">${main}</main>
</div>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script type="application/json" id="kit-data">${data}</script>
<script>
(function(){
  var DATA = JSON.parse(document.getElementById("kit-data").textContent);
  var input = document.getElementById("base-url");
  var hint = document.getElementById("base-hint");
  var KEY = "voiceflare-retell-kit-base";
  function clean(v){ return (v || "").trim().replace(/\\/+$/, ""); }
  function current(){ var v = clean(input.value); return v || DATA.base; }
  function render(){
    var b = current();
    Object.keys(DATA.blocks).forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.textContent = DATA.blocks[id].split(DATA.base).join(b);
    });
    var v = clean(input.value);
    var ok = !v || /^https:\\/\\/[^\\s\\/]+\\.[^\\s\\/]+/.test(v) && !/^https:\\/\\/(localhost|127\\.|10\\.|192\\.168\\.)/.test(v);
    hint.classList.toggle("bad", !ok);
    hint.textContent = !v
      ? (DATA.base.indexOf("{{") === 0 ? "URLs show {{APP_BASE_URL}} until you fill this in." : "The export used " + DATA.base + ".")
      : ok ? "Every URL on this page now uses " + v + "." : "Retell needs a public https URL (no localhost, no private IPs).";
  }
  try { var saved = localStorage.getItem(KEY); if (saved && !input.value) input.value = saved; } catch (e) {}
  input.addEventListener("input", function(){
    try { localStorage.setItem(KEY, clean(input.value)); } catch (e) {}
    render();
  });
  var toast = document.getElementById("toast"), timer = null;
  function say(msg){ toast.textContent = msg; toast.classList.add("show"); clearTimeout(timer); timer = setTimeout(function(){ toast.classList.remove("show"); }, 1600); }
  function fallbackCopy(text){
    var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} document.body.removeChild(ta); return ok;
  }
  document.addEventListener("click", function(ev){
    var btn = ev.target.closest && ev.target.closest("button.copy");
    if (!btn) return;
    var pre = document.getElementById(btn.getAttribute("data-copy"));
    var text = pre ? pre.textContent : "";
    function done(ok){
      if (!ok) { say("Copy failed: select the text and copy it by hand"); return; }
      btn.setAttribute("data-done", ""); btn.textContent = "Copied";
      setTimeout(function(){ btn.removeAttribute("data-done"); btn.textContent = "Copy"; }, 1400);
      say("Copied: " + (btn.getAttribute("aria-label") || "").replace(/^Copy: /, ""));
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function(){ done(true); }, function(){ done(fallbackCopy(text)); });
    else done(fallbackCopy(text));
  });
  render();
})();
</script>
</body>
</html>
`;
}

// ---------- Main ----------

async function main() {
  const sample = await scenarioSample();
  const zone = "Culver City and Palms";
  const resident = completeVars({
    purpose: "resident", stage: "1", language: "English", person_name: "Marcus Bell", zone_name: zone, zone_state: "warning",
    directive_text: directiveFor("warning", "civilian", zone), move_text: sample.move_text, evac_point: sample.evac_point,
    alert_text: directiveFor("warning", "civilian", zone), emergency_number: "911", memory_note: "(none)", collection_note: "(none)",
    subject_name: "(none)", simulated: "true",
  });
  const inbound = completeVars({});
  const sentinel = completeVars({
    purpose: "sentinel", stage: "hold", language: "English", person_name: "Culver City fire station 2", zone_name: zone, zone_state: "warning",
    alert_text: directiveFor("order", "civilian", zone), directive_text: "(none)", move_text: "(none)", evac_point: "(none)",
    emergency_number: "911", simulated: "true",
  });
  const samples = { resident, inbound, sentinel };

  // Clear what an earlier run wrote (only our own file names; README.md is written by hand and kept).
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (GENERATED.has(f)) rmSync(join(OUT, f), { recursive: true, force: true });

  const written = [
    writeOut("voiceflare-retell-llm.json", json(llm)),
    writeOut("voiceflare-agent.json", json(agent)),
    writeOut("voiceflare-conversation-flow.json", json(flow)),
    writeOut("voiceflare-flow-agent.json", json(flowAgent)),
    ...llm.general_tools.map((t) => writeOut(`functions/${t.name}.json`, json(t))),
    writeOut("dynamic-variables.sample.json", json({ _note: "Synthetic samples for the Retell test panel. Every value is simulated.", ...samples })),
    writeOut("prompt.md", promptMd(samples, sample.source)),
    writeOut("retell-kit.html", kitHtml(samples)),
  ];

  console.log(`Retell kit written to ${OUT}`);
  console.log(`  ${baseNote}`);
  console.log(`  model ${model}, voice ${voiceEn}, ${customTools.length} custom functions + ${endCallTool ? endCallTool.name : "no end-call tool"}`);
  console.log(`  flow: ${flow.nodes.length} nodes, ${flow.tools.length} functions`);
  console.log(`  webhook ${webhookUrl(base)}, inbound ${inboundUrl(base)}`);
  for (const w of flowBuild.warnings) console.warn(`! ${w}`);
  const unknown = promptPlaceholders().filter((k) => !VAR_INFO[k]);
  if (unknown.length) console.warn(`! new dynamic variables without a description in scripts/retell-export.ts: ${unknown.join(", ")}`);
  for (const f of written) console.log(`  - ${f}`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
