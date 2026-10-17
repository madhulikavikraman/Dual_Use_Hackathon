import { after } from "next/server";
import { onRetellCallAnalyzed, onRetellCallEnded, onRetellCallStarted } from "@/lib/engine/retellEvents";
import { json } from "@/lib/http";
import { readVerifiedRetellBody, resolveCallId } from "@/lib/retell/guard";
import { callDurationMs, parseWebhookEvent, type RetellCall } from "@/lib/retell/payload";

// POST /api/retell/webhook — Retell call events (agent-level webhook_url, set by scripts/retell-setup.ts).
// Retell waits 10 s for a 2xx and retries up to 3 times, so we verify, map the call, answer at once and
// run the engine handler after the response (call_analyzed triggers the post-call Claude pass).

const HANDLED = new Set(["call_started", "call_ended", "call_analyzed"]);

// Retries and duplicate deliveries: event + Retell call id is unique per call (Retell docs).
const g = globalThis as unknown as { __secondKeyRetellSeen?: Map<string, number> };
const seen = (g.__secondKeyRetellSeen ??= new Map<string, number>());
const SEEN_TTL_MS = 60 * 60 * 1000;

function firstTime(key: string): boolean {
  const now = Date.now();
  if (seen.size > 2000) for (const [k, t] of seen) if (now - t > SEEN_TTL_MS) seen.delete(k);
  if (seen.has(key)) return false;
  seen.set(key, now);
  return true;
}

async function dispatch(event: string, callId: string, call: RetellCall): Promise<void> {
  switch (event) {
    case "call_started":
      return onRetellCallStarted(callId, call.call_id);
    case "call_ended":
      return onRetellCallEnded(callId, {
        transcript: call.transcript ?? null,
        disconnection_reason: call.disconnection_reason ?? null,
        duration_ms: callDurationMs(call),
      });
    case "call_analyzed":
      return onRetellCallAnalyzed(callId, {
        transcript: call.transcript ?? null,
        call_analysis: call.call_analysis ?? null,
      });
  }
}

export async function POST(req: Request) {
  const checked = await readVerifiedRetellBody(req);
  if ("response" in checked) return checked.response;

  const parsed = parseWebhookEvent(checked.raw);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const { event, call } = parsed;

  // transcript_updated, transfer_* and anything new: acknowledge and ignore.
  if (!HANDLED.has(event)) return json({ ok: true, ignored: event });

  const key = `${event}:${call.call_id}`;
  if (!firstTime(key)) return json({ ok: true, duplicate: true });

  let callId: string | null;
  try {
    callId = await resolveCallId(call, { createInbound: event === "call_started" });
  } catch (e) {
    seen.delete(key); // let Retell's retry try again
    console.error(`[retell webhook] ${event} ${call.call_id}: could not map the call`, e);
    return json({ error: "could not map the call" }, 500);
  }
  if (!callId) {
    console.warn(`[retell webhook] ${event}: no call of ours for Retell call ${call.call_id} (no metadata.call_id)`);
    return json({ ok: true, unmatched: call.call_id });
  }

  const ourId = callId;
  after(async () => {
    try {
      await dispatch(event, ourId, call);
    } catch (e) {
      console.error(`[retell webhook] ${event} for call ${ourId} failed`, e);
    }
  });
  return json({ ok: true, event, call_id: ourId });
}
