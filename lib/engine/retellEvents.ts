import "server-only";
import { db, nowIso, uid } from "@/lib/db";
import type { Intent, Need, PrimaryIntent } from "@/lib/types";
import { NEEDS, PRIMARY_INTENTS } from "@/lib/types";
import { answerCall, endCall, failCall } from "./calls";
import { getMeta, setMeta } from "./log";

// Engine handlers for Retell webhook events. The Retell webhook route verifies the signature, finds our
// call id (metadata.call_id, or by retell_call_id) and calls these.

export interface RetellEndedInfo {
  transcript: string | null;
  disconnection_reason: string | null; // e.g. "user_hangup", "dial_no_answer", "voicemail_reached"
  duration_ms: number | null;
}

export interface RetellAnalyzedInfo {
  transcript: string | null;
  call_analysis: Record<string, unknown> | null; // Retell post-call analysis (custom fields included)
}

const RATE_PER_MIN = 0.1; // estimated all-in Retell minute cost for the cost counter (label: estimate)

export async function onRetellCallStarted(callId: string, retellCallId: string): Promise<void> {
  const call = await db().get("calls", callId);
  if (!call) return;
  if (!call.retell_call_id) await db().update("calls", callId, { retell_call_id: retellCallId });
  if (call.state === "ringing" || call.state === "queued") await answerCall(callId);
}

const NO_CONNECT = new Set(["dial_no_answer", "dial_busy", "dial_failed", "invalid_destination", "telephony_provider_permission_denied", "telephony_provider_unavailable", "sip_routing_error", "marked_as_spam", "user_declined", "no_valid_payment", "concurrency_limit_reached"]);

export async function onRetellCallEnded(callId: string, info: RetellEndedInfo): Promise<void> {
  const call = await db().get("calls", callId);
  if (!call) return;
  if (info.transcript) {
    // Retell's transcript uses "Agent:" / "User:" lines; keep it as the call transcript.
    await db().update("calls", callId, { transcript: info.transcript, last_activity_at: nowIso() });
  }
  if (info.duration_ms) {
    const meta = await getMeta();
    const minutes = info.duration_ms / 60_000;
    await setMeta({ cost_minutes: meta.cost_minutes + minutes, cost_usd: meta.cost_usd + minutes * RATE_PER_MIN });
  }
  const reason = info.disconnection_reason ?? "";
  if (reason === "voicemail_reached") await failCall(callId, "voicemail");
  else if (NO_CONNECT.has(reason) || (!call.answered_at && !info.transcript)) await failCall(callId, reason.startsWith("dial") || reason === "user_declined" ? "no_answer" : "failed", reason || undefined);
  else {
    if (!call.answered_at) await answerCall(callId);
    await endCall(callId, reason || "completed");
  }
}

function asIntent(v: unknown): PrimaryIntent | null {
  return typeof v === "string" && (PRIMARY_INTENTS as string[]).includes(v) ? (v as PrimaryIntent) : null;
}

export async function onRetellCallAnalyzed(callId: string, info: RetellAnalyzedInfo): Promise<void> {
  const call = await db().get("calls", callId);
  if (!call) return;
  await db().update("calls", callId, {
    analysis: { ...(call.analysis ?? {}), retell: info.call_analysis },
    ...(info.transcript ? { transcript: info.transcript } : {}),
  });
  const a = (info.call_analysis ?? {}) as Record<string, unknown>;
  const custom = (a.custom_analysis_data ?? a) as Record<string, unknown>;
  const primary = asIntent(custom.primary_intent ?? custom.intent);
  if (primary) {
    const needs = String(custom.needs ?? "")
      .split(/[,;]\s*/)
      .filter((n): n is Need => (NEEDS as string[]).includes(n));
    const row: Intent = {
      id: uid(), call_id: callId, household_id: call.subject_household_id ?? call.household_id, primary_intent: primary, flags: [], needs,
      people: Number.isFinite(Number(custom.people)) ? Number(custom.people) : null, location_text: (custom.location_text as string) || null,
      destination: null, can_leave: typeof custom.can_leave === "boolean" ? custom.can_leave : null, understood: null,
      language: call.vars.language, confidence: 0.6, summary: (a.call_summary as string) ?? null, source: "retell", review_needed: false,
      created_at: nowIso(),
    };
    await db().insert("intents", row);
  }
  // The Claude post-call pass runs when the call ends (endCall); nothing else to do here.
}

/** Find our call id from a Retell call id (fallback when metadata is missing). */
export async function callIdForRetell(retellCallId: string): Promise<string | null> {
  const c = (await db().where("calls", { retell_call_id: retellCallId }))[0];
  return c?.id ?? null;
}
