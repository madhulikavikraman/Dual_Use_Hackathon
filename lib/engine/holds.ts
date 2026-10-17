import "server-only";
import type { HoldDecisionBody, OpenHoldBody } from "@/lib/contracts";
import { db, isoIn, nowIso, uid } from "@/lib/db";
import { directiveFor, stateLabelFor } from "@/lib/directives";
import { areaSqMi, edgeDistanceM, pickSentinels, pointInPolygon } from "@/lib/geo";
import { HttpError } from "@/lib/http";
import { wrongPolygonFor, zoneDefaults } from "@/lib/scenarios";
import type { Call, Canary, Hold, HoldSentinel, HoldTally, Household, Zone, ZoneEvent, ZoneState } from "@/lib/types";
import { firstWave } from "./blocks";
import { buildVars, cancelQueued, newCall, startCampaign } from "./campaigns";
import { feed, getMeta, ledger, setMeta } from "./log";

/** A ladder state in the words of the run's mode (heat mode says "Heat Advisory", not "Evacuation Warning"). */
const labelOf = async (s: ZoneState) => stateLabelFor(s, (await getMeta()).mode);
import { activatePlan, closePlan, planFor, proposePlan } from "./plans";

// The hold (PRD 8.1): before an Order is broadcast, ring sentinels at the polygon's edges for up to
// 90 seconds and show the dose. The machine can delay an alert, never stop one: at 0:00 it sends.

const HOLD_MS = 90_000;
const CAP_MS = 120_000; // the timer may run to 120 s on its own while a sentinel is mid-answer
const HOLD_ONCE_MS = 60_000;
const CANARY_DELAY_MS = 15_000;

function tallyOf(sentinels: HoldSentinel[]): HoldTally {
  const t: HoldTally = { yes: 0, no: 0, unsure: 0, silent: 0, pending: 0 };
  for (const s of sentinels) if (s.position !== "backup" || s.call_id) t[s.answer]++;
  return t;
}

/** Quorum is two answers; silence is an abstention, never a No. */
function readOf(t: HoldTally, sentinels: HoldSentinel[]): Hold["read"] {
  const answers = t.yes + t.no + t.unsure;
  const asked = sentinels.filter((s) => s.call_id);
  if (answers === 0 && asked.length >= 3 && asked.every((s) => s.answer === "silent")) return "dark_zone";
  if (answers < 2) return t.pending === 0 && answers < 2 && asked.length > 0 ? "no_read" : "pending";
  if (t.no > 0 && t.no >= t.yes) return "disputed";
  if (t.yes >= 2 && t.no === 0) return "confirmed";
  return t.no > 0 ? "disputed" : "no_read";
}

async function sentinelCall(hold: Hold, zone: Zone, h: Household, meta: Awaited<ReturnType<typeof getMeta>>): Promise<Call> {
  const call = newCall({
    campaign_id: null, household: h, purpose: "sentinel", hold_id: hold.id,
    vars: buildVars({ zone, household: h, purpose: "sentinel", stage: "hold", meta, alert_text: hold.alert_text }),
  });
  await db().insert("calls", call);
  return call;
}

async function selectSentinels(polygon: GeoJSON.Polygon, zone: Zone): Promise<{ picks: HoldSentinel[]; people: Household[] }> {
  const candidates = (await db().all("households")).filter((h) => h.role === "sentinel" && h.on_post && h.scenario === zone.scenario);
  const { far, near } = pickSentinels(polygon, zone.hazard_origin, candidates, { far: 3, near: 1 });
  const chosen = new Set([...far, ...near].map((h) => h.id));
  const origin = zone.hazard_origin;
  const backups = candidates
    .filter((h) => !chosen.has(h.id) && pointInPolygon(h.lng, h.lat, polygon))
    .sort((a, b) => edgeDistanceM(a.lng, a.lat, polygon, origin) - edgeDistanceM(b.lng, b.lat, polygon, origin))
    .slice(0, 3);
  const mk = (h: Household, position: HoldSentinel["position"]): HoldSentinel => ({
    household_id: h.id, call_id: null, position, answer: "pending", what: null, direction: null, answered_at: null, independent: true,
  });
  return {
    picks: [...far.map((h) => mk(h, "far")), ...near.map((h) => mk(h, "near")), ...backups.map((h) => mk(h, "backup"))],
    people: [...far, ...near, ...backups],
  };
}

/** Open a hold for a zone moving to Order (or a composed broadcast for its polygon). */
export async function openHold(body: OpenHoldBody): Promise<Hold> {
  const zone = await db().get("zones", body.zone_id);
  if (!zone) throw new HttpError(404, "zone not found");
  const open = (await db().where("holds", { zone_id: zone.id, status: "open" }))[0];
  if (open) return open;
  const meta = await getMeta();
  const county = body.polygon === "county" || (body.polygon === undefined && meta.wrong_polygon);
  const wrong = wrongPolygonFor(zone.scenario);
  const polygon = county ? wrong.polygon : zone.geom;
  // The wrong-polygon demo switch is one-shot, so a rehearsal cannot leave it on by mistake.
  if (meta.wrong_polygon) await setMeta({ wrong_polygon: false });
  const defaults = zoneDefaults(zone, body.proposed_state, meta.mode);
  const directive = body.directive_text ?? defaults.directive_text ?? directiveFor(body.proposed_state, meta.mode, zone.name);
  const move = body.move_text ?? defaults.move_text ?? "";
  const evac = body.evac_point === undefined ? defaults.evac_point : body.evac_point;
  const alert = body.alert_text ?? [directive, move, evac ? `Evacuation point: ${evac}.` : ""].filter(Boolean).join(" ");
  const { picks, people } = await selectSentinels(polygon, zone);
  const now = Date.now();
  const hold: Hold = {
    id: uid(),
    zone_id: zone.id,
    proposed_state: body.proposed_state,
    alert_text: alert,
    directive_text: directive,
    move_text: move,
    evac_point: evac,
    polygon,
    polygon_label: county ? wrong.label : zone.name,
    population_est: county ? wrong.population : zone.population_est ?? 0,
    area_sq_mi: +areaSqMi(polygon).toFixed(1),
    started_at: new Date(now).toISOString(),
    deadline: new Date(now + HOLD_MS).toISOString(),
    extended_once: false,
    tally: { yes: 0, no: 0, unsure: 0, silent: 0, pending: 0 },
    sentinels: picks,
    read: "pending",
    decision: null,
    decided_by: null,
    reason: null,
    decided_at: null,
    sent_at: null,
    status: "open",
    handed_off_by: null,
    handed_off_at: null,
    opened_by: body.opened_by,
    open_reason: body.reason,
  };
  await db().insert("holds", hold);
  // Ring the far and near sentinels in parallel; backups ring only when someone is silent.
  for (const s of hold.sentinels) {
    if (s.position === "backup") continue;
    const h = people.find((p) => p.id === s.household_id)!;
    s.call_id = (await sentinelCall(hold, zone, h, meta)).id;
  }
  hold.tally = tallyOf(hold.sentinels);
  await db().update("holds", hold.id, { sentinels: hold.sentinels, tally: hold.tally });
  await ledger({ actor: body.opened_by, action: `open hold: ${await labelOf(body.proposed_state)}`, target: `${zone.name} (${hold.polygon_label})`, reason: body.reason });
  // Block-by-block: an Order for a zone with exit roads gets a proposed plan (or uses the approved one standing by).
  // The dose keeps the zone total; wave 1 is how many move first. The Order itself never waits for the plan.
  const plan = body.proposed_state === "order" ? await proposePlan(zone.id).catch(() => null) : null;
  const w1 = plan && !county ? firstWave(plan) : null;
  await feed({
    kind: "hold", severity: "warn", zone_id: zone.id,
    title: `Hold opened: ${await labelOf(body.proposed_state)} for ${zone.name}`,
    detail: `Wakes about ${hold.population_est.toLocaleString("en-US")} people across ${hold.area_sq_mi} sq mi (estimate).${w1 ? ` ${waveDoseText(w1)}.` : ""} ${hold.sentinels.filter((s) => s.call_id).length} sentinels ringing; sends on time in 90 s.`,
  });
  return hold;
}

/** "Wave 1 now: about 3,280 people in 4 blocks": the hold's dose preview line for a block plan. */
export function waveDoseText(w: { wave: number; blocks: number; people: number }): string {
  return `Wave ${w.wave} now: about ${w.people.toLocaleString("en-US")} people in ${w.blocks} block${w.blocks === 1 ? "" : "s"}`;
}

/** The hold's dose: the zone total, plus wave 1 of the zone's block plan when the hold's polygon is the zone's own. */
export async function holdDose(hold: Hold): Promise<{ total: number; wave1: ReturnType<typeof firstWave> | null; text: string }> {
  const zone = await db().get("zones", hold.zone_id);
  const plan = zone && JSON.stringify(hold.polygon) === JSON.stringify(zone.geom) ? await planFor(zone.id) : null;
  const wave1 = plan ? firstWave(plan) : null;
  const total = `Wakes about ${hold.population_est.toLocaleString("en-US")} people`;
  return { total: hold.population_est, wave1, text: wave1 ? `${total} · ${waveDoseText(wave1)}` : total };
}

/** Supervisor decisions on a hold: Send now, Hold once, Edit polygon, Cancel, Hand to authority. */
export async function decideHold(id: string, body: HoldDecisionBody): Promise<Hold> {
  const hold = await db().get("holds", id);
  if (!hold) throw new HttpError(404, "hold not found");
  if (hold.status !== "open") throw new HttpError(409, `hold is already ${hold.status}`);
  const zone = (await db().get("zones", hold.zone_id))!;
  switch (body.decision) {
    case "send":
      return sendHold(hold, body.actor, body.reason, "send");
    case "hold_once": {
      if (hold.extended_once) throw new HttpError(409, "Hold once was already used");
      const deadline = new Date(Date.parse(hold.deadline) + HOLD_ONCE_MS).toISOString();
      await ledger({ actor: body.actor, action: "hold once (+60 s)", target: zone.name, reason: body.reason });
      return (await db().update("holds", id, { deadline, extended_once: true }))!;
    }
    case "edit": {
      const polygon = body.polygon && body.polygon !== "zone" ? body.polygon : zone.geom;
      const { picks, people } = await selectSentinels(polygon, zone);
      // Keep answers from sentinels who are still inside the new polygon; ring the new ones.
      const kept = new Map(hold.sentinels.filter((s) => s.call_id).map((s) => [s.household_id, s]));
      const meta = await getMeta();
      const sentinels: HoldSentinel[] = [];
      for (const p of picks) {
        const prev = kept.get(p.household_id);
        if (prev) sentinels.push({ ...prev, position: p.position });
        else if (p.position !== "backup") {
          const h = people.find((x) => x.id === p.household_id)!;
          sentinels.push({ ...p, call_id: (await sentinelCall(hold, zone, h, meta)).id });
        } else sentinels.push(p);
      }
      const outside = hold.sentinels.filter((s) => s.call_id && !sentinels.some((x) => x.household_id === s.household_id));
      const tally = tallyOf(sentinels);
      await ledger({ actor: body.actor, action: "edit polygon", target: zone.name,
        reason: `${body.reason} (${hold.polygon_label} → ${zone.name}; ${hold.population_est.toLocaleString("en-US")} → ${(zone.population_est ?? 0).toLocaleString("en-US")} people)` });
      if (outside.length) await feed({ kind: "info", zone_id: zone.id, title: "Polygon edited", detail: `${outside.length} sentinel read(s) from outside the new polygon set aside.` });
      return (await db().update("holds", id, {
        polygon, polygon_label: polygon === zone.geom ? zone.name : `${zone.name} (edited)`,
        population_est: polygon === zone.geom ? zone.population_est ?? 0 : hold.population_est,
        area_sq_mi: +areaSqMi(polygon).toFixed(1), sentinels, tally, read: readOf(tally, sentinels),
      }))!;
    }
    case "cancel": {
      await cancelSentinelCalls(hold);
      await ledger({ actor: body.actor, action: "cancel hold (no send)", target: zone.name, reason: body.reason });
      await feed({ kind: "hold", zone_id: zone.id, title: `Hold cancelled for ${zone.name}`, detail: body.reason });
      return (await db().update("holds", id, { status: "cancelled", decision: "cancel", decided_by: body.actor, reason: body.reason, decided_at: nowIso() }))!;
    }
    case "hand_off": {
      // A hand-off escalates; it never stops the alert. The hold stays open and still sends on time at 0:00
      // unless the authority sends or cancels first (PRD 8.1, 13).
      const t = hold.tally;
      await ledger({ actor: body.actor, action: "hand to authority (hold keeps running; sends on time)", target: zone.name, reason: body.reason });
      await feed({
        kind: "hand_off", severity: "warn", zone_id: zone.id,
        title: `Handed to the duty officer: ${await labelOf(hold.proposed_state)} for ${zone.name}`,
        detail: `Read: ${hold.read} (yes ${t.yes}, no ${t.no}, unsure ${t.unsure}, silent ${t.silent}). Wakes about ${hold.population_est.toLocaleString("en-US")}. Polygon: ${hold.polygon_label}. Still sends at 0:00 unless the authority decides first. ${body.reason}`,
      });
      return (await db().update("holds", id, { handed_off_by: body.actor, handed_off_at: nowIso() }))!;
    }
  }
}

async function cancelSentinelCalls(hold: Hold) {
  for (const s of hold.sentinels) {
    if (s.call_id) await db().updateWhere("calls", { id: s.call_id, state: "queued" }, { state: "cancelled", ended_at: nowIso() });
  }
}

/** The (simulated) broadcast: the zone changes state, Stage 3 calls start, the canary is scheduled. */
export async function sendHold(hold: Hold, actor: string, reason: string, decision: Hold["decision"]): Promise<Hold> {
  const zone = (await db().get("zones", hold.zone_id))!;
  const at = nowIso();
  const next = (await db().update("holds", hold.id, {
    status: "sent", decision, decided_by: actor, reason, decided_at: at, sent_at: at,
  }))!;
  await cancelSentinelCalls(hold);
  await applyZoneState(zone, hold.proposed_state, {
    directive_text: hold.directive_text ?? hold.alert_text, move_text: hold.move_text, evac_point: hold.evac_point,
    actor: actor === "timer" ? `timer (no decision; opened by ${hold.opened_by})` : actor, reason, hold_id: hold.id,
  });
  const fresh = (await db().get("zones", zone.id))!;
  await ledger({
    actor, action: decision === "timer" ? "sent on timer, no decision (simulated)" : decision === "bypass" ? "send, IC order bypassed the hold (simulated)" : "send (simulated)",
    target: `${zone.name} (${hold.polygon_label})`, reason, kind: decision === "timer" ? "system" : "decision",
  });
  await feed({
    kind: "send", severity: "critical", zone_id: zone.id,
    title: `Sent (simulated): ${await labelOf(hold.proposed_state)} for ${zone.name}`,
    detail: `Polygon: ${hold.polygon_label}, about ${hold.population_est.toLocaleString("en-US")} phones. Read at send: ${hold.read}. Canary in 15 s.`,
  });
  await scheduleCanaries(next, fresh);
  if (hold.proposed_state === "order") {
    // An approved block plan starts with wave 1 now; a plan still proposed waits for a human and everyone hears the full Order.
    await activatePlan(fresh, actor === "timer" ? "system" : actor).catch((e) => console.error("[plan]", e));
    await startCampaign({ zone: fresh, kind: "order", wave: 3, started_by: actor === "timer" ? "system" : actor, reason: "Order sent: relay to everyone not confirmed gone", hold_id: hold.id });
  } else if (hold.proposed_state === "shelter_in_place") {
    await startCampaign({ zone: fresh, kind: "shelter", wave: null, started_by: actor === "timer" ? "system" : actor, hold_id: hold.id });
  }
  return next;
}

/** Change a zone's state and texts, with the zone event and version bump. */
export async function applyZoneState(zone: Zone, state: Zone["state"], o: {
  directive_text: string | null; move_text: string | null; evac_point: string | null; actor: string; reason: string; hold_id?: string | null;
  evac_point_lat?: number | null; evac_point_lng?: number | null;
}) {
  const at = nowIso();
  await db().update("zones", zone.id, {
    state, directive_text: o.directive_text, move_text: o.move_text, evac_point: o.evac_point,
    ...(o.evac_point_lat !== undefined ? { evac_point_lat: o.evac_point_lat, evac_point_lng: o.evac_point_lng ?? null } : {}),
    source: "human", approved_by: o.actor, approved_at: at, version: zone.version + 1, updated_at: at,
  });
  const ev: ZoneEvent = {
    id: uid(), zone_id: zone.id, from_state: zone.state, to_state: state, source: "human", actor: o.actor, reason: o.reason,
    hold_id: o.hold_id ?? null, created_at: at,
  };
  await db().insert("zone_events", ev);
  if (state === "lifted" || state === "monitor") {
    await cancelQueued(zone.id);
    await closePlan(zone.id, o.actor, `${zone.name} moved to ${await labelOf(state)}`).catch(() => undefined);
  } else if (state !== zone.state) {
    // Calls still waiting from earlier waves carry the old state's text: cancel them. The new wave started by
    // the caller (Stage 3 after an Order, shelter calls) reaches everyone not confirmed gone.
    for (const c of await db().where("campaigns", { zone_id: zone.id, status: "running" })) {
      if (c.kind === "inbound") continue;
      await db().updateWhere("calls", { campaign_id: c.id, state: "queued" }, { state: "cancelled", ended_at: at });
      await db().update("campaigns", c.id, { status: "done" });
    }
  } else {
    // Same state, corrected texts: calls still waiting read the corrected approval.
    for (const c of await db().where("campaigns", { zone_id: zone.id, status: "running" })) {
      for (const call of await db().where("calls", { campaign_id: c.id, state: "queued" })) {
        await db().update("calls", call.id, {
          vars: { ...call.vars, directive_text: o.directive_text ?? "", move_text: o.move_text ?? "", evac_point: o.evac_point ?? "", zone_state: state },
        });
      }
    }
  }
}

// ---------- canary (PRD 8.1 step 7) ----------

async function scheduleCanaries(hold: Hold, zone: Zone) {
  const meta = await getMeta();
  const canaries = (await db().all("households"))
    .filter((h) => h.role === "canary" && h.scenario === zone.scenario && !pointInPolygon(h.lng, h.lat, zone.geom))
    .sort((a, b) => Number(b.has_device) - Number(a.has_device) || edgeDistanceM(a.lng, a.lat, zone.geom, null) - edgeDistanceM(b.lng, b.lat, zone.geom, null))
    .slice(0, 2);
  for (const h of canaries) {
    const call = newCall({
      campaign_id: null, household: h, purpose: "canary", hold_id: hold.id, planned_at: isoIn(CANARY_DELAY_MS),
      vars: buildVars({ zone, household: h, purpose: "canary", stage: "canary", meta, alert_text: hold.alert_text }),
    });
    await db().insert("calls", call);
    const row: Canary = {
      id: uid(), hold_id: hold.id, household_id: h.id, call_id: call.id, inside: pointInPolygon(h.lng, h.lat, zone.geom),
      result: "pending", flag: null, observed_at: null, created_at: nowIso(),
    };
    await db().insert("canaries", row);
  }
}

/** A canary answered (from received_alert). A yes outside the zone, or a no inside, is a transport failure. */
export async function recordCanary(call: Call, received: "yes" | "no") {
  const row = (await db().where("canaries", { call_id: call.id }))[0];
  if (!row) return;
  const failure = (!row.inside && received === "yes") || (row.inside && received === "no");
  await db().update("canaries", row.id, { result: received, flag: failure ? "transport_failure" : "clear", observed_at: nowIso() });
  const hold = await db().get("holds", row.hold_id);
  const zone = hold ? await db().get("zones", hold.zone_id) : null;
  const who = (await db().get("households", row.household_id))?.name ?? "canary";
  const secs = hold?.sent_at ? Math.round((Date.now() - Date.parse(hold.sent_at)) / 1000) : null;
  if (failure) {
    await feed({
      kind: "canary_result", severity: "critical", zone_id: zone?.id ?? null,
      title: `Transport failure flagged: ${who} ${received === "yes" ? "received" : "did not receive"} the alert`,
      detail: `${row.inside ? "Inside" : "Outside"} ${zone?.name ?? "the zone"}${secs !== null ? `, ${secs} s after the send` : ""}. A flag to the authority, not a stop.`,
    });
    await ledger({ actor: "system", action: "canary: transport failure flagged to the authority", kind: "system", target: zone?.name ?? null, reason: `${who} answered ${received}` });
  } else {
    await feed({
      kind: "canary_result", severity: "info", zone_id: zone?.id ?? null,
      title: `Canary clear: ${who} ${received === "yes" ? "received" : "did not receive"} the alert, as expected`,
      detail: `${row.inside ? "Inside" : "Just outside"} ${zone?.name ?? "the zone"}${secs !== null ? `, answered ${secs} s after the send` : ""}.`,
    });
  }
}

// ---------- tick ----------

export async function holdTick(now: string): Promise<number> {
  let n = 0;
  const holds = await db().where("holds", { status: "open" });
  if (!holds.length) return 0;
  const calls = new Map((await db().all("calls")).map((c) => [c.id, c]));
  const meta = await getMeta();
  for (const hold of holds) {
    const zone = await db().get("zones", hold.zone_id);
    if (!zone) continue;
    let changed = false;
    const sentinels = [...hold.sentinels];
    for (const s of sentinels) {
      if (!s.call_id || s.answer !== "pending") continue;
      const c = calls.get(s.call_id);
      if (!c) continue;
      if (["no_answer", "unreachable", "failed", "voicemail", "cancelled"].includes(c.state) || (c.state === "ended" && s.answer === "pending")) {
        s.answer = "silent";
        changed = true;
        // Silence is an abstention: ring the next backup.
        const backup = sentinels.find((b) => b.position === "backup" && !b.call_id);
        if (backup) {
          const h = await db().get("households", backup.household_id);
          if (h) {
            backup.call_id = (await sentinelCall(hold, zone, h, meta)).id;
            n++;
          }
        }
      }
    }
    const tally = tallyOf(sentinels);
    const read = readOf(tally, sentinels);
    if (changed || JSON.stringify(tally) !== JSON.stringify(hold.tally) || read !== hold.read) {
      await db().update("holds", hold.id, { sentinels, tally, read });
      if (read === "dark_zone" && hold.read !== "dark_zone") {
        await feed({ kind: "dark_zone", severity: "critical", zone_id: zone.id, title: `Dark zone: every sentinel in ${zone.name} is silent`,
          detail: "Probably the network. One action: hand to the duty officer with the dark-zone flag. The alert still sends at 0:00." });
        await ledger({ actor: "system", action: "dark zone flagged", kind: "system", target: zone.name, reason: "all asked sentinels silent" });
      }
      n++;
    }
    // Compare as times, not strings: Supabase returns "+00:00" offsets where the local store keeps "Z".
    if (Date.parse(now) >= Date.parse(hold.deadline)) {
      const mid = sentinels.some((s) => s.call_id && calls.get(s.call_id)?.state === "active");
      const cap = new Date(Date.parse(hold.started_at) + CAP_MS).toISOString();
      if (mid && !hold.extended_once && Date.parse(hold.deadline) < Date.parse(cap)) {
        await db().update("holds", hold.id, { deadline: cap });
        await ledger({ actor: "timer", action: "timer runs to the 120 s cap: a sentinel is mid-answer", kind: "system", target: zone.name });
      } else {
        const fresh = (await db().get("holds", hold.id))!;
        await sendHold(fresh, "timer", "sent on timer, no decision", "timer");
      }
      n++;
    }
  }
  return n;
}

export async function canaryTick(): Promise<number> {
  let n = 0;
  const pending = await db().where("canaries", { result: "pending" });
  for (const row of pending) {
    if (!row.call_id) continue;
    const c = await db().get("calls", row.call_id);
    if (!c || !["no_answer", "unreachable", "failed", "voicemail", "cancelled", "ended"].includes(c.state)) continue;
    await db().update("canaries", row.id, { result: "silent", observed_at: nowIso() });
    n++;
    const all = await db().where("canaries", { hold_id: row.hold_id });
    if (all.every((r) => r.id === row.id || r.result === "silent")) {
      await db().updateWhere("canaries", { hold_id: row.hold_id, result: "silent" }, { flag: "unverified" });
      const hold = await db().get("holds", row.hold_id);
      await feed({ kind: "canary_result", severity: "warn", zone_id: hold?.zone_id ?? null, title: "Delivery unverified: every canary was silent",
        detail: "Flag to the authority; not a stop." });
    }
  }
  return n;
}

/** IC order: skip the hold but keep the record (and the canary). */
export async function bypassHold(zone: Zone, o: { directive_text: string; move_text: string; evac_point: string | null; actor: string; reason: string }) {
  // An IC order replaces any hold already open for the zone (it may hold a wrong polygon or older texts).
  for (const open of await db().where("holds", { zone_id: zone.id, status: "open" })) {
    await cancelSentinelCalls(open);
    await db().update("holds", open.id, { status: "cancelled", decision: "cancel", decided_by: o.actor, reason: "Replaced by an IC order (bypass)", decided_at: nowIso() });
  }
  const hold = await openHold({ zone_id: zone.id, proposed_state: "order", directive_text: o.directive_text, move_text: o.move_text,
    evac_point: o.evac_point, opened_by: o.actor, reason: `IC order, bypass hold: ${o.reason}`, polygon: "zone" });
  return sendHold(hold, o.actor, `IC order, bypass hold: ${o.reason}`, "bypass");
}
