import "server-only";

// Engine handlers for Retell webhook events (owned by the engine lane). The Retell lane's webhook route
// verifies the signature, finds our call id (metadata.call_id, or by retell_call_id) and calls these.

export interface RetellEndedInfo {
  transcript: string | null;
  disconnection_reason: string | null; // e.g. "user_hangup", "dial_no_answer", "voicemail_reached"
  duration_ms: number | null;
}

export interface RetellAnalyzedInfo {
  transcript: string | null;
  call_analysis: Record<string, unknown> | null; // Retell post-call analysis (custom fields included)
}

export async function onRetellCallStarted(callId: string, retellCallId: string): Promise<void> {
  void callId; void retellCallId;
}

export async function onRetellCallEnded(callId: string, info: RetellEndedInfo): Promise<void> {
  void callId; void info;
}

export async function onRetellCallAnalyzed(callId: string, info: RetellAnalyzedInfo): Promise<void> {
  void callId; void info;
}

/** Find our call id from a Retell call id (fallback when metadata is missing). */
export async function callIdForRetell(retellCallId: string): Promise<string | null> {
  void retellCallId;
  return null;
}
