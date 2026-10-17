import "server-only";
import { serverEnv } from "@/lib/env";

// Text messages: the live-location link to a resident and the helper link to a helper.
// Providers, in order:
//   1. Retell (only with RETELL_SMS=1). Retell documents an outbound SMS endpoint, POST /create-sms-chat, that sends
//      from a Retell number with SMS enabled: https://docs.retellai.com/api-references/create-sms-chat and
//      https://docs.retellai.com/deploy/enable-sms . It has no free-text body field: "The initial SMS message will be
//      automatically generated and sent based on the agent's configuration", and the agent must be in chat mode. So we
//      pass the body as the dynamic variable {{sms_body}} to a chat agent (RETELL_SMS_AGENT_ID) whose opening message is
//      exactly "{{sms_body}}". Custom content needs SMS enabled on your own number (A2P registration in the US).
//      Not tested against a live account; it falls through to Twilio or a simulated send on any error.
//   2. Twilio REST (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER).
//   3. Simulated: nothing leaves the server. The caller labels it (feed + ledger).

export type SmsVia = "retell" | "twilio" | "simulated";

export interface SmsResult {
  via: SmsVia;
  ok: boolean;
  id: string | null;
  /** Why a real provider was skipped or failed (for the ledger), else null. */
  note: string | null;
}

const E164 = /^\+[1-9]\d{6,14}$/;
export const isE164 = (s: string | null | undefined): s is string => Boolean(s && E164.test(s));

async function viaRetell(to: string, body: string): Promise<SmsResult> {
  const env = serverEnv();
  const res = await fetch("https://api.retellai.com/create-sms-chat", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RETELL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from_number: env.RETELL_SMS_FROM_NUMBER ?? env.RETELL_FROM_NUMBER,
      to_number: to,
      override_agent_id: env.RETELL_SMS_AGENT_ID,
      retell_llm_dynamic_variables: { sms_body: body },
      metadata: { kind: "voiceflare_link" },
    }),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => null)) as { chat_id?: string; message?: string } | null;
  if (!res.ok) throw new Error(`Retell SMS ${res.status}: ${data?.message ?? "error"}`);
  return { via: "retell", ok: true, id: data?.chat_id ?? null, note: null };
}

async function viaTwilio(to: string, body: string): Promise<SmsResult> {
  const env = serverEnv();
  const sid = env.TWILIO_ACCOUNT_SID!;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: env.TWILIO_FROM_NUMBER!, Body: body }),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => null)) as { sid?: string; message?: string } | null;
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${data?.message ?? "error"}`);
  return { via: "twilio", ok: true, id: data?.sid ?? null, note: null };
}

/** Send a text. Never throws: a failure or a missing provider comes back as a simulated send with a note. */
export async function sendSms(to: string | null, body: string): Promise<SmsResult> {
  if (!isE164(to)) return { via: "simulated", ok: true, id: null, note: to ? "not an E.164 number" : "no phone number" };
  let env: ReturnType<typeof serverEnv>;
  try {
    env = serverEnv();
  } catch (e) {
    return { via: "simulated", ok: true, id: null, note: e instanceof Error ? e.message : String(e) };
  }
  const notes: string[] = [];
  if (env.RETELL_SMS === "1" && env.RETELL_API_KEY && env.RETELL_SMS_AGENT_ID && (env.RETELL_SMS_FROM_NUMBER ?? env.RETELL_FROM_NUMBER)) {
    try {
      return await viaRetell(to, body);
    } catch (e) {
      notes.push(e instanceof Error ? e.message : String(e));
      console.error("[sms] Retell send failed", e);
    }
  }
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER) {
    try {
      return await viaTwilio(to, body);
    } catch (e) {
      notes.push(e instanceof Error ? e.message : String(e));
      console.error("[sms] Twilio send failed", e);
    }
  }
  return { via: "simulated", ok: true, id: null, note: notes.join("; ") || "no text-message provider configured" };
}

/** The public base URL for links in a text: APP_BASE_URL (the tunnel Retell already uses), else the request origin. */
export function publicBase(origin: string | null | undefined): string {
  let base: string | undefined;
  try {
    base = serverEnv().APP_BASE_URL;
  } catch {
    base = process.env.APP_BASE_URL?.trim() || undefined;
  }
  return (base ?? origin ?? "").replace(/\/+$/, "");
}

/** The request origin, when called inside a route handler; null elsewhere (simulator ticks after a response, scripts). */
export async function requestOrigin(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return null;
    const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.|\[::1\])/.test(host) ? "http" : "https");
    return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
  } catch {
    return null;
  }
}
