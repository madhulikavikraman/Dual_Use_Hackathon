// Create (or update) the Retell side of VoiceFlare: one Retell LLM with the shared prompt and the eight
// tools as custom functions, one voice agent per language (eight: EN, ES, KO, ZH, HI, FR, HY hy-AM, TL fil-PH),
// and the public number's agent binding and inbound webhook. Prints the RETELL_AGENT_ID_* lines to paste into .env.local.
//
//   npx tsx scripts/retell-setup.ts               create everything (needs RETELL_API_KEY and APP_BASE_URL)
//   npx tsx scripts/retell-setup.ts --dry-run     print the payloads only (automatic without RETELL_API_KEY)
//   npx tsx scripts/retell-setup.ts --update      reuse RETELL_LLM_ID / RETELL_AGENT_ID_* from env and PATCH them
//                                                 (run this whenever the tunnel URL changes)
// Options: --base-url=https://...  --model=claude-5.5-haiku  --only=en,hi  --skip-number
// Voices: RETELL_VOICE_EN ... RETELL_VOICE_TL override the automatic pick from GET /list-voices.
//
// Safe imports only (no "server-only"): lib/retell/config.ts, lib/retell/api.ts, which use lib/agent/*,
// lib/languages.ts and lib/types.ts.
import { config } from "dotenv";
import { retellRequest, RetellApiError, toE164 } from "../lib/retell/api";
import {
  buildAgentPayload,
  buildLlmPayload,
  buildPhoneNumberPayload,
  DEFAULT_RETELL_VOICE,
  pickVoice,
  RETELL_LANG_LIST_HELP,
  RETELL_LANGS,
  RETELL_LLM_MODELS,
  type RetellLang,
  type RetellVoice,
} from "../lib/retell/config";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

if (flag("help") || flag("h")) {
  console.log(
    [
      "Usage: npx tsx scripts/retell-setup.ts [--dry-run] [--update] [--base-url=https://...] [--model=...] [--only=en,es] [--skip-number]",
      `Languages: ${RETELL_LANG_LIST_HELP}`,
      `Models: ${RETELL_LLM_MODELS.join(", ")}`,
    ].join("\n"),
  );
  process.exit(0);
}

const env = (k: string) => process.env[k]?.trim() || undefined;
const apiKey = env("RETELL_API_KEY");
const dryRun = flag("dry-run") || !apiKey;
const update = flag("update");
const model = opt("model") ?? env("RETELL_LLM_MODEL");
const only = opt("only")?.toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
const langs: RetellLang[] = only ? RETELL_LANGS.filter((l) => only.includes(l.suffix.toLowerCase())) : RETELL_LANGS;
const verificationPhrase = env("VERIFICATION_PHRASE") ?? "blue heron";
const callbackNumber = env("CALLBACK_NUMBER") ?? "(213) 555-0142";
const fromNumberRaw = env("RETELL_FROM_NUMBER");

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

function baseUrlOrFail(): string {
  const raw = opt("base-url") ?? env("APP_BASE_URL");
  if (!raw) {
    if (dryRun) return "https://YOUR-PUBLIC-HTTPS-URL";
    fail("APP_BASE_URL is not set. Retell must reach your server over public HTTPS (see docs/RETELL.md: cloudflared tunnel).");
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
    if (!dryRun) fail(`${msg} Start a tunnel (npx cloudflared tunnel --url http://localhost:3000) and use its https URL.`);
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
  const baseUrl = baseUrlOrFail();
  if (model && !RETELL_LLM_MODELS.includes(model)) console.warn(`! model "${model}" is not in the known list; Retell will reject it if invalid`);
  if (only && langs.length === 0) fail(`--only=${opt("only")} matched no language (${RETELL_LANG_LIST_HELP})`);

  console.log(`Retell setup${dryRun ? " (DRY RUN: nothing is sent)" : update ? " (update)" : ""}`);
  console.log(`  base URL:  ${baseUrl}`);
  console.log(`  languages: ${langs.map((l) => `${l.suffix} ${l.retellLanguage}`).join(", ")}`);
  if (!apiKey) console.log("  RETELL_API_KEY is not set, so this is a dry run.");

  // 1. The Retell LLM: shared prompt template + the eight tools as custom functions.
  const llmPayload = buildLlmPayload({ baseUrl, model, verificationPhrase, callbackNumber });
  const existingLlm = update ? env("RETELL_LLM_ID") : undefined;
  let llmId = existingLlm ?? "llm_DRY_RUN";
  section(existingLlm ? `PATCH /update-retell-llm/${existingLlm}` : "POST /create-retell-llm");
  if (dryRun) show("payload:", llmPayload);
  else {
    const res = existingLlm
      ? await retellRequest<{ llm_id: string }>(apiKey as string, "PATCH", `/update-retell-llm/${encodeURIComponent(existingLlm)}`, llmPayload)
      : await retellRequest<{ llm_id: string }>(apiKey as string, "POST", "/create-retell-llm", llmPayload);
    llmId = res.llm_id;
    console.log(`✓ Retell LLM ${llmId} (${llmPayload.model}, ${llmPayload.general_tools.length} tools)`);
  }

  // 2. One agent per language.
  const voices = dryRun ? [] : await listVoices();
  const englishVoice = env("RETELL_VOICE_EN") ?? pickVoice(RETELL_LANGS[0], voices, DEFAULT_RETELL_VOICE).voice_id;
  const agentIds: Record<string, string> = {};
  const failures: string[] = [];
  for (const l of langs) {
    const chosen = env(l.voiceEnv)
      ? { voice_id: env(l.voiceEnv) as string, why: `from ${l.voiceEnv}` }
      : pickVoice(l, voices, englishVoice);
    const existing = update ? env(l.envVar) : undefined;
    const payload = buildAgentPayload(l, { llmId, voiceId: chosen.voice_id, baseUrl });
    section(`${existing ? `PATCH /update-agent/${existing}` : "POST /create-agent"}  ${l.lang.name}`);
    if (dryRun) {
      console.log(`voice: ${env(l.voiceEnv) ? chosen.why : `${chosen.voice_id} (a live run picks one from GET /list-voices by accent)`}`);
      show("payload:", payload);
      agentIds[l.envVar] = `agent_DRY_RUN_${l.suffix}`;
      continue;
    }
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
      agentIds[l.envVar] = res.agent_id;
      console.log(`✓ ${l.lang.name}: ${res.agent_id} (voice ${chosen.voice_id}: ${chosen.why})`);
    } catch (e) {
      failures.push(`${l.lang.name}: ${(e as Error).message}`);
      console.error(`✗ ${l.lang.name}: ${(e as Error).message}`);
    }
  }

  // 3. The public number: English agent both ways (calls pick their language agent per call) + inbound webhook.
  const enAgent = agentIds.RETELL_AGENT_ID_EN ?? env("RETELL_AGENT_ID_EN");
  if (flag("skip-number")) console.log("\n(skipping the phone number: --skip-number)");
  else if (!fromNumberRaw) console.log("\n(RETELL_FROM_NUMBER is not set: buy a number in the Retell dashboard, then rerun with --update)");
  else if (!enAgent) console.log("\n(no English agent yet, so the number was not bound)");
  else {
    const number = toE164(fromNumberRaw);
    if (!number) fail(`RETELL_FROM_NUMBER "${fromNumberRaw}" is not E.164 (+12135550142)`);
    const numberPayload = buildPhoneNumberPayload({ agentId: enAgent, baseUrl });
    section(`PATCH /update-phone-number/${number}`);
    if (dryRun) show("payload:", numberPayload);
    else {
      try {
        await retellRequest(apiKey as string, "PATCH", `/update-phone-number/${encodeURIComponent(number)}`, numberPayload);
        console.log(`✓ ${number}: inbound and outbound agent ${enAgent}, inbound webhook ${numberPayload.inbound_webhook_url}`);
      } catch (e) {
        failures.push(`phone number: ${(e as Error).message}`);
        console.error(`✗ phone number: ${(e as Error).message}`);
      }
    }
  }

  section(dryRun ? "Env lines (dry run placeholders)" : "Paste into .env.local, then restart the dev server");
  console.log(`RETELL_LLM_ID=${llmId}`);
  for (const l of langs) if (agentIds[l.envVar]) console.log(`${l.envVar}=${agentIds[l.envVar]}`);
  if (failures.length) {
    console.error(`\n${failures.length} step(s) failed:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
