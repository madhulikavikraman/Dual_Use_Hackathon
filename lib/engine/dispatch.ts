import "server-only";
import { retellDynamicVariables } from "@/lib/agent/prompt";
import { db } from "@/lib/db";
import { retellEnabled } from "@/lib/env";
import { placeRetellCall } from "@/lib/retell/client";
import type { Call, Meta } from "@/lib/types";
import { endCall, failCall, feedTransport, ringCall } from "./calls";
import { planSim } from "./sim";

// The dispatch queue (PRD backlog 6): ring queued calls when their time comes, at most five resident calls
// at once per campaign (sentinel and canary calls ring in parallel), on the right transport.

const CONCURRENCY = 5;
const BROWSER_RING_MS = 25_000;
const RETELL_RING_MS = 75_000;
const ABANDON_MS = 150_000;
const PRESENCE_MS = 20_000;

const LIVE = new Set(["ringing", "active"]);

export async function dispatchTick(now: string, meta: Meta): Promise<number> {
  const all = await db().all("calls");
  // Follow-ups (retries, linked contacts, response-team call backs) go ahead of first attempts: they are the
  // people the sweep already missed.
  const urgent = (c: Call) => (c.purpose === "linked_contact" || c.purpose === "qrt_callback" || c.attempt > 1 ? 0 : 1);
  const due = all
    .filter((c) => c.state === "queued" && c.planned_at <= now)
    .sort((a, b) => urgent(a) - urgent(b) || (a.planned_at < b.planned_at ? -1 : a.planned_at > b.planned_at ? 1 : a.order_index - b.order_index));
  if (!due.length) return 0;
  const live = new Map<string, number>();
  for (const c of all) if (c.campaign_id && LIVE.has(c.state)) live.set(c.campaign_id, (live.get(c.campaign_id) ?? 0) + 1);
  let n = 0;
  for (const call of due) {
    const capped = call.campaign_id && (call.purpose === "resident" || call.purpose === "linked_contact");
    if (capped && (live.get(call.campaign_id!) ?? 0) >= CONCURRENCY) continue;
    await ring(call, meta);
    if (call.campaign_id) live.set(call.campaign_id, (live.get(call.campaign_id) ?? 0) + 1);
    n++;
  }
  return n;
}

async function ring(call: Call, meta: Meta) {
  const h = call.household_id ? await db().get("households", call.household_id) : null;
  if (!h) {
    await db().update("calls", call.id, { state: "cancelled" });
    return;
  }
  if (h.synthetic || (h.has_device && meta.autopilot_devices)) {
    const ringing: Call = { ...call, transport: "sim" };
    await ringCall(call, { transport: "sim", sim: await planSim(ringing, h, meta) });
    return;
  }
  if (retellEnabled() && h.phone_e164) {
    try {
      const { retell_call_id } = await placeRetellCall({
        call_id: call.id, to_number: h.phone_e164, lang_code: call.vars.lang_code, dynamic_variables: retellDynamicVariables(call.vars),
      });
      await ringCall(call, { transport: "retell", retell_call_id, simulated: false });
      return;
    } catch (e) {
      // Fall back to the browser phone: the same six devices, the same script (PRD 18).
      await feedTransport(`Retell call to ${h.name} failed; ringing the browser phone instead`, e instanceof Error ? e.message : String(e));
    }
  }
  await ringCall(call, { transport: "browser", simulated: false });
}

/** Ring timeouts and abandoned calls on the real transports. */
export async function timeoutTick(now: string): Promise<number> {
  let n = 0;
  const t = Date.parse(now);
  for (const call of (await db().all("calls")).filter((c) => LIVE.has(c.state) && c.transport !== "sim")) {
    if (call.state === "ringing" && call.started_at) {
      const limit = call.transport === "retell" ? RETELL_RING_MS : BROWSER_RING_MS;
      if (t - Date.parse(call.started_at) > limit) {
        const h = call.household_id ? await db().get("households", call.household_id) : null;
        const present = h?.presence_at ? t - Date.parse(h.presence_at) < PRESENCE_MS : false;
        await failCall(call.id, call.transport === "browser" && !present ? "unreachable" : "no_answer",
          call.transport === "browser" && !present ? "phone page not open (no presence heartbeat)" : undefined);
        n++;
      }
    } else if (call.state === "active" && call.transport === "browser") {
      const last = call.last_activity_at ?? call.answered_at;
      if (last && t - Date.parse(last) > ABANDON_MS) {
        await endCall(call.id, "abandoned");
        n++;
      }
    }
  }
  return n;
}

/** Mark campaigns done when nothing is left to ring. */
export async function campaignTick(): Promise<number> {
  let n = 0;
  const running = (await db().where("campaigns", { status: "running" })).filter((c) => c.kind !== "inbound");
  if (!running.length) return 0;
  const calls = await db().all("calls");
  for (const c of running) {
    const mine = calls.filter((x) => x.campaign_id === c.id);
    if (mine.length && mine.every((x) => !["queued", "ringing", "active"].includes(x.state))) {
      await db().update("campaigns", c.id, { status: "done" });
      n++;
    }
  }
  return n;
}
