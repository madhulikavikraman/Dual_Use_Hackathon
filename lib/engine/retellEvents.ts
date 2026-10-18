import "server-only";
import { db, nowIso, uid } from "@/lib/db";
import type { Intent, Need, PrimaryIntent } from "@/lib/types";
import { NEEDS, PRIMARY_INTENTS } from "@/lib/types";
import { requestOrigin } from "@/lib/sms";
import { answerCall, endCall, failCall } from "./calls";
import { createShare } from "./locate";
import { getMeta, setMeta } from "./log";
import { upsertHelp } from "./registry";

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

// Retell disconnection_reason values (spec revision 2026-10-16) where no person was reached.
const NO_CONNECT = new Set([
  "dial_no_answer", "dial_busy", "dial_failed", "invalid_destination", "telephony_provider_permission_denied", "telephony_provider_unavailable",
  "sip_routing_error", "marked_as_spam", "network_blocked", "user_declined", "no_valid_payment", "credit_exhausted", "budget_reached",
  "concurrency_limit_reached", "no_concurrency_fallback", "scam_detected", "error_user_not_joined", "registered_call_timeout",
]);
/** Reached a phone tree, not a person: no answer (the retry and linked-contact follow-ups run), never a completed call. */
const NO_PERSON = new Set(["dial_no_answer", "dial_busy", "user_declined", "ivr_reached"]);

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
  else if (NO_CONNECT.has(reason) || reason === "ivr_reached" || (!call.answered_at && !info.transcript)) await failCall(callId, NO_PERSON.has(reason) ? "no_answer" : "failed", reason || undefined);
  else {
    if (!call.answered_at) await answerCall(callId);
    await endCall(callId, reason || "completed");
  }
}

function peopleCount(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
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
      // Number(null) and Number("") are 0: only a real number (or numeric text) is a count of people.
      people: peopleCount(custom.people), location_text: (custom.location_text as string) || null,
      destination: null, can_leave: typeof custom.can_leave === "boolean" ? custom.can_leave : null, understood: null,
      language: call.vars.language, confidence: 0.6, summary: (a.call_summary as string) ?? null, source: "retell", review_needed: false,
      created_at: nowIso(),
    };
    await db().insert("intents", row);
    // "Needs help now" from any layer surfaces at once, whatever the confidence (PRD 10).
    const subjectId = call.subject_household_id ?? call.household_id;
    const subject = subjectId ? await db().get("households", subjectId) : null;
    if (primary === "needs_help_now" && subject) {
      await upsertHelp({ household: subject, zone_id: subject.zone_id ?? (call.vars.zone_id || null), priority: 1, needs,
        people: row.people, reason: "Retell post-call analysis: possible life safety", source: "stage1" });
    }
  }
  await postCallShare(callId, custom);
  // The Claude post-call pass runs when the call ends (endCall); nothing else to do here.
}

const LINK_PURPOSES = new Set(["resident", "inbound", "qrt_callback"]);

/**
 * Live location, kept in step with the call: if the analysis heard a clear yes to the link but the agent never called
 * share_live_location (a dropped tool call, a hang-up mid-turn), create the share and text the link now. createShare
 * never makes a second one for the same call or while the person still has a link on.
 */
async function postCallShare(callId: string, custom: Record<string, unknown>) {
  const v = custom.live_location_consent;
  if (!(v === true || v === "true")) return;
  const call = await db().get("calls", callId);
  if (!call?.household_id || !LINK_PURPOSES.has(call.purpose)) return;
  const h = await db().get("households", call.household_id);
  if (!h) return;
  const quote = typeof custom.live_location_quote === "string" && custom.live_location_quote.trim() ? custom.live_location_quote.trim() : "(a clear yes, from the post-call analysis)";
  await createShare({
    household: h, call, consent_quote: quote, consent_source: "post_call", synthetic: call.transport === "sim", actor: "system",
    origin: await requestOrigin(),
  });
}

/** Find our call id from a Retell call id (fallback when metadata is missing). */
export async function callIdForRetell(retellCallId: string): Promise<string | null> {
  const c = (await db().where("calls", { retell_call_id: retellCallId }))[0];
  return c?.id ?? null;
}
