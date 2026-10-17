// Create (or update) the Conversation Flow version of the VoiceFlare agent through the Retell API, so it shows up
// on the Retell dashboard ready to test: one conversation flow (lib/retell/flow.ts) and one flow agent per language.
// The single prompt agent (scripts/retell-setup.ts) stays the default; this is the visual-canvas alternative.
//
//   npx tsx scripts/retell-flow-setup.ts                  dry run: prints what it would send (the default)
//   npx tsx scripts/retell-flow-setup.ts --create         creates the flow and the agent(s), prints the ids
//   npx tsx scripts/retell-flow-setup.ts --update         PATCHes RETELL_FLOW_ID and RETELL_FLOW_AGENT_ID_* in place
//                                                          (run it whenever the tunnel URL changes)
// Options: --base-url=https://...  --model=claude-5.5-haiku  --only=en,es  --bind-number  --verbose
//   --bind-number  also points RETELL_FROM_NUMBER at the English flow agent (replaces the single prompt agent there)
//   --verbose      prints the whole flow body in a dry run
// Needs RETELL_API_KEY (the key with the webhook badge) and APP_BASE_URL (public https) for --create / --update.
// Voices: RETELL_VOICE_EN ... RETELL_VOICE_FR override the automatic pick from GET /list-voices.
import { config } from "dotenv";
import { retellRequest, RetellApiError, toE164 } from "../lib/retell/api";
import {
  buildPhoneNumberPayload,
  DEFAULT_RETELL_VOICE,
  pickVoice,
  RETELL_LANG_LIST_HELP,
  RETELL_LANGS,
  RETELL_LLM_MODELS,
  type RetellVoice,
} from "../lib/retell/config";
import { buildFlow, buildFlowAgentPayload } from "../lib/retell/flow";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const env = (k: string) => process.env[k]?.trim() || undefined;

if (flag("help") || flag("h")) {
  console.log(
    [
      "Usage: npx tsx scripts/retell-flow-setup.ts [--create | --update] [--base-url=https://...] [--model=...] [--only=en,es] [--bind-number] [--verbose]",
      "Without --create or --update it is a dry run.",
      `Languages: ${RETELL_LANG_LIST_HELP} (default: en)`,
      `Models: ${RETELL_LLM_MODELS.join(", ")}`,
    ].join("\n"),
  );
  process.exit(0);
}

const apiKey = env("RETELL_API_KEY");
const update = flag("update");
const live = flag("create") || update;
const model = opt("model") ?? env("RETELL_LLM_MODEL");
const only = (opt("only") ?? "en").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
const langs = RETELL_LANGS.filter((l) => only.includes(l.suffix.toLowerCase()));
const verificationPhrase = env("VERIFICATION_PHRASE") ?? "blue heron";
const callbackNumber = env("CALLBACK_NUMBER") ?? "(213) 555-0142";
const flowEnv = (suffix: string) => `RETELL_FLOW_AGENT_ID_${suffix}`;

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

function baseUrlOrFail(): string {
  const raw = opt("base-url") ?? env("APP_BASE_URL");
  if (!raw) {
    if (!live) return "https://YOUR-PUBLIC-HTTPS-URL";
    fail("APP_BASE_URL is not set. Retell must reach your server over public HTTPS (npx cloudflared tunnel --url http://localhost:3000).");
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail(`APP_BASE_URL "${raw}" is not a URL`);
  }
  const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/.test(url.hostname);
  if (url.protocol !== "https:" || local) {
    const msg = `APP_BASE_URL "${raw}" is not a public https URL; Retell blocks localhost and private IPs.`;
    if (live) fail(`${msg} Start a tunnel and use its https URL.`);
    console.warn(`! ${msg}`);
  }
  return url.origin;
}

const section = (title: string) => console.log(`\n=== ${title} ${"=".repeat(Math.max(0, 70 - title.length))}`);
const show = (label: string, payload: unknown) => console.log(`${label}\n${JSON.stringify(payload, null, 2)}`);

async function listVoices(): Promise<RetellVoice[]> {
  try {
    return await retellRequest<RetellVoice[]>(apiKey as string, "GET", "/list-voices");
  } catch (e) {
    console.warn(`! could not list voices (${(e as Error).message}); using ${DEFAULT_RETELL_VOICE}`);
    return [];
  }
}

async function main() {
  if (live && !apiKey) fail("RETELL_API_KEY is not set (use the key with the webhook badge). Without it, run the dry run.");
  if (langs.length === 0) fail(`--only=${opt("only")} matched no language (${RETELL_LANG_LIST_HELP})`);
  if (model && !RETELL_LLM_MODELS.includes(model)) console.warn(`! model "${model}" is not in the known list; Retell will reject it if invalid`);
  const baseUrl = baseUrlOrFail();

  console.log(`Retell conversation flow setup${live ? (update ? " (update)" : " (create)") : " (DRY RUN: nothing is sent; add --create to create)"}`);
  console.log(`  base URL:  ${baseUrl}`);
  console.log(`  languages: ${langs.map((l) => `${l.suffix} ${l.retellLanguage}`).join(", ")}`);

  // 1. The conversation flow.
  const { body: flow, warnings } = buildFlow({ baseUrl, model, verificationPhrase, callbackNumber });
  for (const w of warnings) console.warn(`! ${w}`);
  const existingFlow = update ? env("RETELL_FLOW_ID") : undefined;
  if (update && !existingFlow) fail("--update needs RETELL_FLOW_ID in .env.local (run --create first)");
  section(existingFlow ? `PATCH /update-conversation-flow/${existingFlow}` : "POST /create-conversation-flow");
  console.log(`  ${flow.nodes.length} nodes, start node "${flow.start_node_id}", model ${flow.model_choice.model}`);
  console.log(`  ${flow.tools.length} functions:\n${flow.tools.map((t) => `    ${t.name.padEnd(28)} ${t.method} ${t.url}`).join("\n")}`);
  if (!live && flag("verbose")) show("payload:", flow);
  else if (!live) console.log("  (the whole body: --verbose, or docs/retell/voiceflare-conversation-flow.json after npx tsx scripts/retell-export.ts)");

  let flowId = existingFlow ?? "conversation_flow_DRY_RUN";
  if (live) {
    const res = existingFlow
      ? await retellRequest<{ conversation_flow_id: string; version?: number }>(apiKey as string, "PATCH", `/update-conversation-flow/${encodeURIComponent(existingFlow)}`, flow)
      : await retellRequest<{ conversation_flow_id: string; version?: number }>(apiKey as string, "POST", "/create-conversation-flow", flow);
    flowId = res.conversation_flow_id;
    console.log(`✓ conversation flow ${flowId}${res.version !== undefined ? ` (version ${res.version})` : ""}`);
  }

  // 2. One flow agent per language (default: English only).
  const voices = live ? await listVoices() : [];
  const englishVoice = env("RETELL_VOICE_EN") ?? pickVoice(RETELL_LANGS[0], voices, DEFAULT_RETELL_VOICE).voice_id;
  const agentIds: Record<string, string> = {};
  const failures: string[] = [];
  for (const l of langs) {
    const chosen = env(l.voiceEnv) ? { voice_id: env(l.voiceEnv) as string, why: `from ${l.voiceEnv}` } : pickVoice(l, voices, englishVoice);
    const existing = update ? env(flowEnv(l.suffix)) : undefined;
    const payload = buildFlowAgentPayload(l, { flowId, voiceId: chosen.voice_id, baseUrl });
    section(`${existing ? `PATCH /update-agent/${existing}` : "POST /create-agent"}  ${l.lang.name} (flow)`);
    if (!live) {
      show("payload:", payload);
      agentIds[flowEnv(l.suffix)] = `agent_DRY_RUN_${l.suffix}`;
      continue;
    }
    if (update && !existing) console.log(`  (no ${flowEnv(l.suffix)} in env: creating a new agent)`);
    const send = (body: typeof payload) =>
      existing
        ? retellRequest<{ agent_id: string }>(apiKey as string, "PATCH", `/update-agent/${encodeURIComponent(existing)}`, body)
        : retellRequest<{ agent_id: string }>(apiKey as string, "POST", "/create-agent", body);
    try {
      let res: { agent_id: string };
      try {
        res = await send(payload);
      } catch (e) {
        // A voice that does not support the language is rejected: retry once with the default platform voice.
        if (!(e instanceof RetellApiError) || e.status !== 400 || payload.voice_id === DEFAULT_RETELL_VOICE) throw e;
        console.warn(`! ${l.lang.name}: ${e.message}\n  retrying with ${DEFAULT_RETELL_VOICE}`);
        res = await send({ ...payload, voice_id: DEFAULT_RETELL_VOICE });
      }
      agentIds[flowEnv(l.suffix)] = res.agent_id;
      console.log(`✓ ${l.lang.name}: flow agent ${res.agent_id} (voice ${chosen.voice_id}: ${chosen.why})`);
    } catch (e) {
      failures.push(`${l.lang.name}: ${(e as Error).message}`);
      console.error(`✗ ${l.lang.name}: ${(e as Error).message}`);
    }
  }

  // 3. Optional: point the public number at the English flow agent.
  const enAgent = agentIds[flowEnv("EN")] ?? env(flowEnv("EN"));
  if (flag("bind-number")) {
    const raw = env("RETELL_FROM_NUMBER");
    const number = raw ? toE164(raw) : null;
    if (!number) console.log("\n(--bind-number: RETELL_FROM_NUMBER is not set or not E.164, so the number was not bound)");
    else if (!enAgent) console.log("\n(--bind-number: no English flow agent, so the number was not bound)");
    else {
      const numberPayload = buildPhoneNumberPayload({ agentId: enAgent, baseUrl });
      section(`PATCH /update-phone-number/${number}`);
      if (!live) show("payload:", numberPayload);
      else {
        try {
          await retellRequest(apiKey as string, "PATCH", `/update-phone-number/${encodeURIComponent(number)}`, numberPayload);
          console.log(`✓ ${number}: inbound and outbound agent ${enAgent} (flow), inbound webhook ${numberPayload.inbound_webhook_url}`);
        } catch (e) {
          failures.push(`phone number: ${(e as Error).message}`);
          console.error(`✗ phone number: ${(e as Error).message}`);
        }
      }
    }
  }

  section(live ? "Paste into .env.local" : "Env lines (dry run placeholders)");
  console.log(`RETELL_FLOW_ID=${flowId}`);
  for (const [k, v] of Object.entries(agentIds)) console.log(`${k}=${v}`);
  console.log(
    "\nThe app places calls with RETELL_AGENT_ID_<LANG>. To use the flow agent for calls, set RETELL_AGENT_ID_EN to the English flow agent id" +
      " (and restart the dev server). Open the agent on the dashboard to see the canvas and press Test.",
  );
  if (failures.length) {
    console.error(`\n${failures.length} step(s) failed:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
