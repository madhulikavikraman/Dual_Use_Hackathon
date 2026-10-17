import "server-only";
import { serverEnv, type ServerEnv } from "@/lib/env";
import { LANGUAGES } from "@/lib/languages";
import { RetellApiError, retellRequest, toE164 } from "./api";

// Retell AI client (owned by the Retell lane). The engine's dispatcher calls placeRetellCall for
// volunteer devices with a phone number when RETELL_API_KEY is set. Signature is fixed.
// API facts (docs.retellai.com, spec revision 2026-10-16):
//   POST /v2/create-phone-call {from_number, to_number, override_agent_id, metadata,
//        retell_llm_dynamic_variables (string values only)} -> 201 {call_id, call_status, ...}
//   POST /v2/stop-call/{call_id} -> 204

export interface PlaceRetellCallInput {
  call_id: string; // our call id; send it as metadata.call_id so webhooks and tools map back
  to_number: string; // E.164
  lang_code: string; // picks the Retell agent for that language (falls back to English)
  dynamic_variables: Record<string, string>;
}

export interface RetellAgentChoice {
  agent_id: string;
  env: string; // which env var supplied it
  fallback: boolean; // true when the language has no agent of its own and English is used
}

/** The Retell agent for a language: LANGUAGES[].retellEnv, else RETELL_AGENT_ID_EN. */
export function retellAgentFor(langCode: string | null | undefined, env: ServerEnv = serverEnv()): RetellAgentChoice | null {
  const code = (langCode ?? "").trim();
  const prefix = code.split("-")[0]?.toLowerCase();
  const lang =
    LANGUAGES.find((l) => l.code.toLowerCase() === code.toLowerCase()) ??
    LANGUAGES.find((l) => l.code.split("-")[0].toLowerCase() === prefix);
  const vars = env as unknown as Record<string, string | undefined>;
  if (lang?.retellEnv && vars[lang.retellEnv]) {
    return { agent_id: vars[lang.retellEnv] as string, env: lang.retellEnv, fallback: false };
  }
  if (env.RETELL_AGENT_ID_EN) return { agent_id: env.RETELL_AGENT_ID_EN, env: "RETELL_AGENT_ID_EN", fallback: true };
  return null;
}

function stringValues(vars: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) out[k] = v === null || v === undefined ? "" : String(v);
  return out;
}

export async function placeRetellCall(input: PlaceRetellCallInput): Promise<{ retell_call_id: string }> {
  const env = serverEnv();
  if (!env.RETELL_API_KEY) throw new Error("placeRetellCall: Retell not configured (RETELL_API_KEY is not set)");
  if (!env.RETELL_FROM_NUMBER) {
    throw new Error("placeRetellCall: RETELL_FROM_NUMBER is not set (buy a number in the Retell dashboard, see docs/RETELL.md)");
  }
  const from = toE164(env.RETELL_FROM_NUMBER);
  if (!from) throw new Error(`placeRetellCall: RETELL_FROM_NUMBER "${env.RETELL_FROM_NUMBER}" is not an E.164 number`);
  const to = toE164(input.to_number);
  if (!to) throw new Error(`placeRetellCall: to_number "${input.to_number}" is not an E.164 number (e.g. +12135550142)`);
  const agent = retellAgentFor(input.lang_code, env);
  if (!agent) {
    throw new Error("placeRetellCall: no Retell agent (set RETELL_AGENT_ID_EN; run `npx tsx scripts/retell-setup.ts`)");
  }

  try {
    const res = await retellRequest<{ call_id?: string; call_status?: string }>(env.RETELL_API_KEY, "POST", "/v2/create-phone-call", {
      from_number: from,
      to_number: to,
      override_agent_id: agent.agent_id,
      metadata: { call_id: input.call_id, lang_code: input.lang_code, agent_env: agent.env },
      retell_llm_dynamic_variables: stringValues(input.dynamic_variables),
    });
    if (!res?.call_id) throw new Error("Retell returned no call_id");
    if (agent.fallback) console.warn(`[retell] no agent for ${input.lang_code}; call ${input.call_id} uses the English agent`);
    return { retell_call_id: res.call_id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`placeRetellCall (call ${input.call_id} to ${to}): ${msg}`);
  }
}

/** End a live Retell call (used after end_call). A call that already ended is not an error. */
export async function stopRetellCall(retellCallId: string): Promise<boolean> {
  const apiKey = serverEnv().RETELL_API_KEY;
  if (!apiKey) return false;
  try {
    await retellRequest(apiKey, "POST", `/v2/stop-call/${encodeURIComponent(retellCallId)}`);
    return true;
  } catch (e) {
    if (e instanceof RetellApiError && e.status !== null && [400, 404, 422].includes(e.status)) return false;
    throw e;
  }
}
