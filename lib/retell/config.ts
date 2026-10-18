// What scripts/retell-setup.ts creates in Retell: one Retell LLM (the shared prompt template and the eight
// tools as custom functions) and one voice agent per language. Pure module: relative imports only and
// no server-only code, so `npx tsx scripts/retell-setup.ts` can load it.
// Field names and enums follow the Retell API reference (spec revision 2026-10-16):
//   POST /create-retell-llm, POST /create-agent, PATCH /update-phone-number/{number}.
import { PROMPT_TEMPLATE, retellPromptTemplate } from "../agent/prompt";
import { TOOL_DEFS, retellDescription, retellParameters, type ToolDef } from "../agent/tools";
import { jurisdictionFor } from "../jurisdictions";
import { LANGUAGES, type LanguageInfo } from "../languages";
import { NEEDS, PRIMARY_INTENTS } from "../types";

/** Retell LLM models include Claude; Haiku keeps the phone brain the same family as the browser's. */
export const DEFAULT_RETELL_LLM_MODEL = "claude-5.5-haiku";
export const DEFAULT_RETELL_ANALYSIS_MODEL = "claude-5.5-sonnet";
export const RETELL_LLM_MODELS = [
  "claude-5.5-haiku", "claude-4.5-haiku", "claude-5.5-sonnet", "claude-5-sonnet", "claude-4.6-sonnet", "claude-5.5-opus",
  "claude-5-opus", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-4.1", "gpt-4.1-mini", "gemini-3.5-flash",
];

/** Languages Retell's `language` field accepts (subset we may use). Retell has no es-US: es-419 is Latin American Spanish. */
const RETELL_LANGUAGE: Record<string, string> = {
  "en-US": "en-US", "es-US": "es-419", "ko-KR": "ko-KR", "zh-CN": "zh-CN", "hi-IN": "hi-IN", "fr-FR": "fr-FR",
  "hy-AM": "hy-AM", "fil-PH": "fil-PH",
};

export interface RetellLang {
  lang: LanguageInfo;
  envVar: string; // RETELL_AGENT_ID_XX
  suffix: string; // XX
  retellLanguage: string;
  voiceEnv: string; // RETELL_VOICE_XX overrides the voice
  accents: string[]; // accent annotations to look for in /list-voices
}

const ACCENTS: Record<string, string[]> = {
  EN: ["american"],
  ES: ["latin", "mexican", "spanish", "colombian", "argentin", "hispanic"],
  KO: ["korean"],
  ZH: ["chinese", "mandarin"],
  HI: ["indian", "hindi"],
  FR: ["french", "parisian"],
  HY: ["armenian"],
  TL: ["filipino", "tagalog", "philippine"],
};

/** One agent per language that has a RETELL_AGENT_ID_* env var: EN, ES, KO, ZH, HI, FR, HY (Armenian), TL (Tagalog). */
export const RETELL_LANGS: RetellLang[] = LANGUAGES.filter((l) => l.retellEnv).map((lang) => {
  const envVar = lang.retellEnv as string;
  const suffix = envVar.replace("RETELL_AGENT_ID_", "");
  return {
    lang,
    envVar,
    suffix,
    retellLanguage: RETELL_LANGUAGE[lang.code] ?? lang.code,
    voiceEnv: `RETELL_VOICE_${suffix}`,
    accents: ACCENTS[suffix] ?? [],
  };
});

export const RETELL_LANG_LIST_HELP = RETELL_LANGS.map((l) => `${l.suffix.toLowerCase()} (${l.lang.name})`).join(", ");

export const toolUrl = (baseUrl: string, name: string) => `${baseUrl.replace(/\/+$/, "")}/api/retell/tools/${name}`;
export const webhookUrl = (baseUrl: string) => `${baseUrl.replace(/\/+$/, "")}/api/retell/webhook`;
export const inboundUrl = (baseUrl: string) => `${baseUrl.replace(/\/+$/, "")}/api/retell/inbound`;

/** Every {{placeholder}} the shared prompt uses. */
export function promptPlaceholders(): string[] {
  return [...new Set([...PROMPT_TEMPLATE.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
}

/**
 * Fallbacks Retell uses when a call arrives without variables (for example the inbound webhook failed, or a dashboard
 * test call). Retell leaves a placeholder raw ("{{zone_name}}") when no value is supplied, so every one gets a value.
 * The life-safety numbers are never "(none)": "Hang up and call ... now" must always name a real number. Retell runs
 * the US line (China uses a domestic platform, lib/jurisdictions.ts), so the default jurisdiction is Los Angeles.
 */
export function defaultDynamicVariables(opts: { verificationPhrase: string; callbackNumber: string; jurisdiction?: string }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of promptPlaceholders()) out[k] = "(none)";
  const j = jurisdictionFor(opts.jurisdiction ?? "US-CA");
  return {
    ...out,
    purpose: "inbound",
    stage: "inbound",
    language: "the caller's language",
    mode: "civilian",
    emergency_number: j.call_now,
    medical_number: j.emergency.medical,
    simulated: "true",
    verification_phrase: opts.verificationPhrase,
    callback_number: opts.callbackNumber,
  };
}

/** Tools that can take a few seconds (a geocode of a stated place, or a text message): a typing sound fills the line. */
const SLOW_WRITES = new Set(["record_status", "report_hazard", "share_live_location"]);

function customTool(t: ToolDef, baseUrl: string) {
  const isLookup = t.name === "lookup_zone";
  // share_live_location writes the consent and sends a text (a provider round trip): allow a little longer.
  const isShare = t.name === "share_live_location";
  return {
    type: "custom" as const,
    name: t.name,
    description: retellDescription(t),
    url: toolUrl(baseUrl, t.name),
    method: "POST" as const,
    parameters: retellParameters(t),
    // The server needs the {name, call, args} wrapper: the call object maps the request to our call ("Payload: args only" off).
    args_at_root: false,
    // lookup_zone geocodes (a second or two) and says it is checking. record_status and report_hazard may geocode a
    // stated place too (up to about 5 s) and share_live_location sends a text: a typing sound fills that, no extra words.
    speak_during_execution: isLookup,
    ...(SLOW_WRITES.has(t.name) ? { enable_typing_sound: true } : {}),
    ...(isLookup
      ? {
          execution_message_type: "prompt" as const,
          execution_message_description:
            "One short sentence in the language of the call saying you are checking the instructions for that place.",
        }
      : {}),
    // Every tool, end_call included, gives the model another turn: after end_call it calls hang_up.
    speak_after_execution: true,
    timeout_ms: isLookup ? 20_000 : isShare ? 15_000 : 10_000,
    max_retry: 0, // tools write rows; a retry could write twice
  };
}

/**
 * Our end_call only records the outcome; the line is disconnected by Retell's built-in end-call tool.
 * Tool names must be unique, so the built-in one is called hang_up. (The tools route also stops the
 * call through the API if it is still up a few seconds after end_call with no further tool use.)
 */
export const HANG_UP_TOOL = {
  type: "end_call" as const,
  name: "hang_up",
  description:
    "Disconnect the phone line. Call this right after end_call has returned, once the goodbye has been said. Never call it before end_call.",
  speak_during_execution: false,
};

/** POST /create-retell-llm (or PATCH /update-retell-llm/{llm_id}) body. */
export function buildLlmPayload(opts: { baseUrl: string; model?: string; verificationPhrase: string; callbackNumber: string }) {
  return {
    model: opts.model ?? DEFAULT_RETELL_LLM_MODEL,
    model_temperature: 0.2,
    start_speaker: "agent" as const, // the agent speaks first (outbound and inbound); no begin_message: it follows the prompt
    general_prompt: retellPromptTemplate(),
    general_tools: [...TOOL_DEFS.map((t) => customTool(t, opts.baseUrl)), HANG_UP_TOOL],
    default_dynamic_variables: defaultDynamicVariables(opts),
  };
}

/** Retell post-call analysis (PRD section 10, layer 3). Field names are what call_analysis.custom_analysis_data carries. */
export const POST_CALL_ANALYSIS = [
  {
    type: "enum" as const,
    name: "primary_intent",
    description:
      "The caller's main situation. needs_help_now: life safety (medical, trapped, fire at the house). " +
      "needs_help_leaving: can leave only with help (wheelchair, oxygen, no car, children alone). leaving: will leave. " +
      "staying: refuses or undecided. already_left: out of the zone. hazard_report: reports smoke, fire, damage or injury, " +
      "or a sentinel says the alert matches what they see. no_hazard_seen: a sentinel sees nothing. info_request: only asked a question. " +
      "wrong_number, not_in_zone, unclear, voicemail, silence: no usable answer. " +
      "On the heat check-in line (mode heat): needs_help_now = heat-stroke warning signs or feeling unwell in the heat; " +
      "needs_help_leaving = needs a ride to a cooling center; leaving = going to a cooling center or somewhere cool; " +
      "already_left = at home and cool; staying = staying home and declining help (or wants a check-in visit). " +
      "Block-by-block evacuation: a resident told their block's wave is later who will go with it is leaving, not staying.",
    choices: [...PRIMARY_INTENTS],
    required: false,
  },
  {
    type: "string" as const,
    name: "needs",
    description: `Access and functional needs mentioned, comma-separated, using only these words: ${NEEDS.join(", ")}. Empty if none.`,
    required: false,
  },
  {
    type: "number" as const,
    name: "people",
    description: "Number of people at the address including the speaker, if stated.",
    required: false,
  },
  {
    type: "boolean" as const,
    name: "can_leave",
    description: "Whether the person said they can leave on their own.",
    required: false,
  },
  {
    type: "string" as const,
    name: "location_text",
    description: "Where the person said they are right now, in their words (address, intersection or landmark). Empty if not said.",
    required: false,
  },
  {
    type: "boolean" as const,
    name: "live_location_consent",
    description:
      "True only if the agent asked whether it may text a link that shares the person's live location with the response team " +
      "and the person clearly said yes. False if they said no or were never asked clearly. A maybe is false. A yes to sharing " +
      "the place they named (no text link) is false.",
    required: false,
  },
  {
    type: "string" as const,
    name: "live_location_quote",
    description: "If live_location_consent is true: the person's own words saying yes, verbatim. Empty otherwise.",
    required: false,
  },
];

/**
 * Voicemail: leave only approved text (PRD 8.2 / 13: the directive, the route, the evacuation point and the callback
 * number). Approved texts are read in full: a block's get-ready route ends with the leave-right-away line.
 */
export const VOICEMAIL_PROMPT =
  "Leave a short voicemail in {{language}}; keep your own words brief. Say this is the emergency information line (if the mode {{mode}} is heat: the heat check-in line; if base: the installation's emergency line) and the verification phrase " +
  "{{verification_phrase}}. If {{simulated}} is true, say this is a simulated call for a hackathon demonstration. " +
  "If the purpose {{purpose}} is resident or linked_contact, read exactly and in full, translated faithfully if needed, adding nothing and cutting nothing, " +
  "even if that makes the message long: \"{{directive_text}}\" then \"{{move_text}}\" then the evacuation point \"{{evac_point}}\", skipping any that is (none) " +
  "and skipping the evacuation point if the route text already names it. " +
  "For any other purpose do not read an alert or a directive. Never say anyone is safe and never give a time. End with the official callback number {{callback_number}}.";

/** POST /create-agent (or PATCH /update-agent/{agent_id}) body for one language. */
export function buildAgentPayload(l: RetellLang, opts: { llmId: string; voiceId: string; baseUrl: string; analysisModel?: string }) {
  return {
    agent_name: `VoiceFlare ${l.lang.name} (${l.retellLanguage})`,
    response_engine: { type: "retell-llm" as const, llm_id: opts.llmId },
    voice_id: opts.voiceId,
    language: l.retellLanguage,
    webhook_url: webhookUrl(opts.baseUrl),
    webhook_events: ["call_started", "call_ended", "call_analyzed"],
    post_call_analysis_data: POST_CALL_ANALYSIS,
    post_call_analysis_model: opts.analysisModel ?? DEFAULT_RETELL_ANALYSIS_MODEL,
    begin_message_delay_ms: 800, // a beat after pickup before the agent speaks
    end_call_after_silence_ms: 30_000,
    max_call_duration_ms: 300_000, // calls are meant to be under 90 s; cap cost at 5 min
    ring_duration_ms: 30_000,
    voicemail_option: { action: { type: "prompt" as const, text: VOICEMAIL_PROMPT } },
    timezone: "America/Los_Angeles",
  };
}

/** PATCH /update-phone-number/{number}: bind the English agent both ways and set the inbound webhook. */
export function buildPhoneNumberPayload(opts: { agentId: string; baseUrl: string }) {
  return {
    inbound_agents: [{ agent_id: opts.agentId, weight: 1 }],
    outbound_agents: [{ agent_id: opts.agentId, weight: 1 }],
    inbound_webhook_url: inboundUrl(opts.baseUrl),
    nickname: "VoiceFlare public line",
  };
}

export interface RetellVoice {
  voice_id: string;
  voice_name?: string;
  provider?: string;
  accent?: string;
  gender?: string;
}

/** Platform voices are tuned for telephony; used when no accent matches (test Armenian and Tagalog before relying on it). */
export const DEFAULT_RETELL_VOICE = "retell-Cimo";

/** Pick a voice for a language from GET /list-voices: accent match, platform voices first. */
export function pickVoice(l: RetellLang, voices: RetellVoice[], fallback: string): { voice_id: string; why: string } {
  const providerRank = (p?: string) => ["platform", "elevenlabs", "cartesia", "minimax"].indexOf(p ?? "") >>> 0;
  const matches = voices
    .filter((v) => l.accents.some((a) => (v.accent ?? "").toLowerCase().includes(a)))
    .sort((a, b) => providerRank(a.provider) - providerRank(b.provider));
  if (matches[0]) return { voice_id: matches[0].voice_id, why: `${matches[0].voice_name ?? matches[0].voice_id}, ${matches[0].accent}, ${matches[0].provider}` };
  return { voice_id: fallback, why: "no accent match; default voice" };
}
