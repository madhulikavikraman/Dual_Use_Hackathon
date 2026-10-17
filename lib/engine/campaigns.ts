import "server-only";
import { db, isoIn, nowIso, uid } from "@/lib/db";
import { STATE_LABEL, stateLabelFor } from "@/lib/directives";
import { RING_M, edgeDistanceM } from "@/lib/geo";
import { jurisdictionFor } from "@/lib/jurisdictions";
import type {
  Call, CallPurpose, CallVars, Campaign, CampaignKind, EvacPlan, Household, HouseholdStatus, Meta, Stage, Status, Zone,
} from "@/lib/types";
import { blockAt, blockMessage, messageKind, refresh } from "./blocks";
import { getMeta, ledger } from "./log";

// Campaigns and calls: who gets called, in what order, with which variables (PRD 8.2).

const LEGACY_STAGE: Partial<Record<CampaignKind, Stage>> = {
  warning: "warning", order: "order", all_clear: "all_clear", checkin: "checkin", test: "checkin",
};

export function stageLabel(kind: CampaignKind, wave: number | null): string {
  if (kind === "warning") return wave === 2 ? "2" : "1";
  if (kind === "order") return "3";
  if (kind === "shelter") return "shelter";
  if (kind === "checkin") return "watch";
  return kind;
}

/** The variables every agent sees (PRD 8): the approved texts of the person's zone, verbatim. */
export function buildVars(opts: {
  zone: Zone | null;
  household: Household | null;
  purpose: CallPurpose;
  stage: string;
  meta: Meta;
  alert_text?: string | null;
  subject?: Household | null;
}): CallVars {
  const { zone, household, purpose, stage, meta } = opts;
  return {
    purpose,
    zone_id: zone?.id ?? "",
    zone_name: zone?.name ?? "",
    zone_state: zone?.state ?? "",
    directive_text: zone?.directive_text ?? "",
    move_text: zone?.move_text ?? "",
    evac_point: zone?.evac_point ?? "",
    alert_text: opts.alert_text ?? "",
    stage,
    language: household?.language ?? "English",
    lang_code: household?.lang_code ?? "en-US",
    person_name: household?.name ?? "",
    subject_name: opts.subject?.name ?? "",
    callback_number: meta.callback_number,
    verification_phrase: meta.verification_phrase,
    memory_note: (opts.subject ?? household)?.memory_note ?? "",
    simulated: "true",
    mode: meta.mode,
    emergency_number: jurisdictionFor(meta.jurisdiction).call_now,
    collection_note: (opts.subject ?? household)?.collection_note ?? "",
  };
}

export function newCall(p: {
  campaign_id: string | null;
  household: Household;
  purpose: CallPurpose;
  vars: CallVars;
  planned_at?: string;
  attempt?: number;
  subject_household_id?: string | null;
  hold_id?: string | null;
  order_index?: number;
  ring_index?: number;
  edge_distance_m?: number | null;
}): Call {
  const now = nowIso();
  return {
    id: uid(),
    campaign_id: p.campaign_id,
    household_id: p.household.id,
    subject_household_id: p.subject_household_id ?? null,
    purpose: p.purpose,
    called_party: p.purpose === "linked_contact" ? "linked_contact" : "resident",
    attempt: p.attempt ?? 1,
    state: "queued",
    transport: p.household.synthetic ? "sim" : "browser",
    retell_call_id: null,
    outcome: null,
    messages: [],
    transcript: null,
    summary: null,
    analysis: null,
    vars: p.vars,
    order_index: p.order_index ?? 0,
    ring_index: p.ring_index ?? 0,
    edge_distance_m: p.edge_distance_m ?? null,
    hold_id: p.hold_id ?? null,
    planned_at: p.planned_at ?? now,
    started_at: null,
    answered_at: null,
    ended_at: null,
    last_activity_at: null,
    simulated: true,
    sim: null,
    created_at: now,
  };
}

export function blankStatus(campaign_id: string, household_id: string, status: Status): HouseholdStatus {
  return {
    campaign_id, household_id, status, understood: null, destination: null, needs: [], needs_note: null,
    device_battery_hours: null, animals: null, people: null, refusal_reason: null, seats_for_neighbors: null,
    hazard_seen: null, hazard_type: null, hazard_direction: null, hazard_distance: null, distress: false,
    human_requested: false, human_reason: null, via: "resident", assigned_run: null, location_text: null,
    updated_at: nowIso(), simulated: true,
  };
}

/** Latest status per household across all campaigns. */
export async function latestStatuses(): Promise<Map<string, HouseholdStatus>> {
  const out = new Map<string, HouseholdStatus>();
  for (const st of await db().all("household_status")) {
    const prev = out.get(st.household_id);
    if (!prev || prev.updated_at < st.updated_at) out.set(st.household_id, st);
  }
  return out;
}

const FINAL_LEFT: Status[] = ["safe"];

/** Heat line: people who live alone or have no air conditioning are called first. */
export const heatRisk = (h: Household) => Boolean(h.heat_profile?.lives_alone || h.heat_profile?.no_ac);

/** Who a campaign calls (PRD 8.2 protocol table). */
async function rosterFor(zone: Zone, kind: CampaignKind, wave: number | null, mode: Meta["mode"]): Promise<Household[]> {
  const people = await db().where("households", { zone_id: zone.id });
  const residents = people.filter((h) => h.role === "resident");
  if (kind === "test") return people.filter((h) => h.role === "sentinel");
  if (mode === "heat") {
    // Heat watch: check in with seniors who live alone. Extreme Heat Warning: call everyone again, including people who
    // said earlier they were home and cool (an air conditioner can fail). Heat Advisory: every registered senior.
    if (kind === "checkin") return residents.filter((h) => h.heat_profile?.lives_alone);
    if (kind === "order") return residents;
  }
  const latest = await latestStatuses();
  const st = (h: Household) => latest.get(h.id)?.status ?? "pending";
  if (kind === "warning" && wave === 2) {
    return residents.filter((h) => {
      const s = latest.get(h.id);
      return ["wont_leave", "unclear", "no_answer", "pending", "queued"].includes(s?.status ?? "pending") || s?.understood === false;
    });
  }
  if (kind === "order") return residents.filter((h) => !FINAL_LEFT.includes(st(h)));
  if (kind === "rollcall") return residents.filter((h) => ["pending", "queued", "no_answer", "unclear", "ringing"].includes(st(h)));
  return residents;
}

/**
 * Start a wave of calls for a zone, edge-first: sorted by distance to the hazard edge, in ~200 m rings,
 * people with access and functional needs first within a ring. Calls are queued; the dispatcher rings
 * them at most five at a time.
 */
export async function startCampaign(opts: {
  zone: Zone;
  kind: CampaignKind;
  wave: 1 | 2 | 3 | null;
  started_by: string;
  reason?: string;
  hold_id?: string | null;
}): Promise<Campaign> {
  const { zone, kind, wave, started_by } = opts;
  const meta = await getMeta();
  const campaign: Campaign = {
    id: uid(),
    kind,
    stage: LEGACY_STAGE[kind] ?? (kind === "order" ? "order" : "warning"),
    mode: meta.mode,
    zone_id: zone.id,
    zone_name: zone.name,
    polygon: zone.geom,
    alert_text: zone.directive_text ?? "",
    directive_text: zone.directive_text,
    move_text: zone.move_text,
    evac_point: zone.evac_point,
    wave,
    order_rule: kind === "test" ? "none" : "edge_first",
    started_by,
    verification_phrase: meta.verification_phrase,
    callback_number: meta.callback_number,
    hold_id: opts.hold_id ?? null,
    status: "running",
    created_at: nowIso(),
  };
  await db().insert("campaigns", campaign);

  const roster = await rosterFor(zone, kind, wave, meta.mode);
  const heat = meta.mode === "heat";
  // Block-by-block plan (Order relay only): the blocks going now are called first, later waves hear when to get
  // ready, and edge-first ordering still applies inside each wave. Without an approved plan everyone hears the full Order.
  const plan = kind === "order" && !heat ? await runningPlan(zone.id) : null;
  const ranked = roster
    .map((h) => {
      const d = edgeDistanceM(h.lng, h.lat, zone.geom, zone.hazard_origin);
      const block = plan ? blockAt(plan, h.lng, h.lat) : null;
      const goNow = !plan || !block || messageKind(plan, block) !== "get_ready";
      // Heat has no hazard edge: "ring" 0 is the people who live alone or have no air conditioning, ring 1 everyone else.
      const ring = heat ? (heatRisk(h) ? 0 : 1) : Math.floor(d / RING_M);
      return { h, d, ring, block, wave: goNow ? 0 : block!.wave };
    })
    .sort((a, b) => a.wave - b.wave || a.ring - b.ring || Number(b.h.afn_flags.length > 0) - Number(a.h.afn_flags.length > 0) || a.d - b.d);

  const purpose: CallPurpose = kind === "test" ? "test" : "resident";
  const stage = stageLabel(kind, wave);
  let group = -1;
  let last = "";
  const calls: Call[] = ranked.map(({ h, d, ring, block, wave: w }, i) => {
    // Each ring (and each later wave) goes out a beat after the previous one so the sweep is visible from the hazard side.
    if (`${w}:${ring}` !== last) {
      group++;
      last = `${w}:${ring}`;
    }
    const vars = buildVars({ zone, household: h, purpose, stage, meta, alert_text: zone.directive_text });
    if (plan && block) vars.move_text = blockMessage(plan, block, zone);
    return newCall({
      campaign_id: campaign.id,
      household: h,
      purpose,
      vars,
      planned_at: isoIn((plan ? Math.min(group, 24) : Math.min(ring, 12)) * 2500),
      order_index: i,
      ring_index: ring,
      edge_distance_m: Math.round(d),
    });
  });
  if (calls.length) await db().insert("calls", calls);
  if (purpose === "resident" && ranked.length) {
    await db().upsert("household_status", ranked.map(({ h }) => blankStatus(campaign.id, h.id, "queued")));
  }
  const what = heat
    ? kind === "checkin" ? "heat watch check-ins with seniors who live alone"
      : kind === "warning" ? "Heat Advisory calls to every registered senior"
      : kind === "order" ? "Extreme Heat Warning calls to everyone"
      : `${kind} calls`
    : kind === "warning" ? `Stage ${wave === 2 ? "2 check" : "1 warning"} calls` :
    kind === "order" ? "Stage 3 order relay calls" :
    kind === "shelter" ? "Shelter-in-place calls" :
    kind === "rollcall" ? "Roll call" :
    kind === "test" ? "Monthly test calls" : `${kind} calls`;
  await ledger({
    actor: started_by,
    action: `start ${what} (${calls.length})`,
    target: zone.name,
    reason: opts.reason ?? (heat
      ? `${stateLabelFor(zone.state, meta.mode)}; people who live alone or have no air conditioning first`
      : `${STATE_LABEL[zone.state]}; edge-first from the hazard side`),
    kind: started_by === "system" || started_by === "timer" ? "system" : "decision",
  });
  return campaign;
}

// ---------- block-by-block plans (lib/engine/plans.ts runs them; the words come from lib/engine/blocks.ts) ----------

/** The zone's approved, running block plan (active or everyone go now), or null. Never throws (before migration 005). */
async function runningPlan(zoneId: string): Promise<EvacPlan | null> {
  const rows = await db().where("evac_plans", { zone_id: zoneId }).catch(() => [] as EvacPlan[]);
  const p = rows.filter((x) => x.status === "active" || x.status === "all_go").sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  return p ? refresh(p) : null;
}

/**
 * The plan was just approved (or changed) while Order calls wait in the queue: each queued call takes its block's
 * approved words, and the blocks going now ring first. Calls already made said "leave now" (the full Order); that stands.
 */
export async function applyPlanToQueuedCalls(zone: Zone, plan: EvacPlan): Promise<number> {
  let n = 0;
  const now = Date.now();
  for (const c of await db().where("campaigns", { zone_id: zone.id, status: "running" })) {
    if (c.kind !== "order") continue;
    for (const call of await db().where("calls", { campaign_id: c.id, state: "queued" })) {
      if (call.purpose !== "resident" || !call.household_id) continue;
      const h = await db().get("households", call.household_id);
      const block = h ? blockAt(plan, h.lng, h.lat) : null;
      if (!block) continue;
      const kind = messageKind(plan, block);
      await db().update("calls", call.id, {
        vars: { ...call.vars, move_text: blockMessage(plan, block, zone) },
        // Go-now calls keep their place; get-ready calls move behind them, a wave at a time.
        planned_at: new Date(Math.max(Date.parse(call.planned_at), now + (kind === "get_ready" ? 2500 * Math.min(block.wave, 12) : 0))).toISOString(),
      });
      n++;
    }
  }
  return n;
}

/**
 * Blocks whose wave just started (or that were pulled forward, or everyone at once): their residents hear "leave now"
 * on their block's road. A get-ready call still in the queue takes the go-now words; everyone else not confirmed out
 * gets a new call. Edge-first inside the wave.
 */
export async function startBlockCalls(zone: Zone, plan: EvacPlan, blockIds: string[], started_by: string, reason: string): Promise<Campaign | null> {
  const ids = new Set(blockIds);
  if (!ids.size) return null;
  const meta = await getMeta();
  const latest = await latestStatuses();
  const queued = new Map<string, Call>();
  for (const c of await db().where("campaigns", { zone_id: zone.id, status: "running" })) {
    if (c.kind !== "order") continue;
    for (const call of await db().where("calls", { campaign_id: c.id, state: "queued" })) if (call.household_id) queued.set(call.household_id, call);
  }
  const people = (await db().where("households", { zone_id: zone.id }))
    .filter((h) => h.role === "resident" && !FINAL_LEFT.includes(latest.get(h.id)?.status ?? "pending"))
    .map((h) => ({ h, block: blockAt(plan, h.lng, h.lat) }))
    .filter((x): x is { h: Household; block: NonNullable<typeof x.block> } => Boolean(x.block && ids.has(x.block.id)));
  const fresh: typeof people = [];
  for (const p of people) {
    const call = queued.get(p.h.id);
    if (call) {
      await db().update("calls", call.id, { vars: { ...call.vars, move_text: blockMessage(plan, p.block, zone) }, planned_at: nowIso() });
    } else fresh.push(p);
  }
  if (!fresh.length) return null;
  const campaign: Campaign = {
    id: uid(), kind: "order", stage: "order", mode: meta.mode, zone_id: zone.id, zone_name: zone.name, polygon: zone.geom,
    alert_text: zone.directive_text ?? "", directive_text: zone.directive_text, move_text: zone.move_text, evac_point: zone.evac_point,
    wave: 3, order_rule: "edge_first", started_by, verification_phrase: meta.verification_phrase, callback_number: meta.callback_number,
    hold_id: null, status: "running", created_at: nowIso(),
  };
  await db().insert("campaigns", campaign);
  const ranked = fresh
    .map((p) => {
      const d = edgeDistanceM(p.h.lng, p.h.lat, zone.geom, zone.hazard_origin);
      return { ...p, d, ring: Math.floor(d / RING_M) };
    })
    .sort((a, b) => a.ring - b.ring || Number(b.h.afn_flags.length > 0) - Number(a.h.afn_flags.length > 0) || a.d - b.d);
  const calls = ranked.map(({ h, block, d, ring }, i) => {
    const vars = buildVars({ zone, household: h, purpose: "resident", stage: "3", meta, alert_text: zone.directive_text });
    vars.move_text = blockMessage(plan, block, zone);
    return newCall({
      campaign_id: campaign.id, household: h, purpose: "resident", vars, planned_at: isoIn(Math.min(ring, 12) * 2500),
      order_index: i, ring_index: ring, edge_distance_m: Math.round(d),
    });
  });
  await db().insert("calls", calls);
  await db().upsert("household_status", ranked.map(({ h }) => blankStatus(campaign.id, h.id, "queued")));
  await ledger({
    actor: started_by, action: `start go-now calls for ${[...ids].join(", ")} (${calls.length})`, target: zone.name, reason,
    kind: started_by === "system" || started_by === "timer" ? "system" : "decision",
  });
  return campaign;
}

/** Cancel calls still waiting in a zone's campaigns (e.g. the zone was lifted). */
export async function cancelQueued(zoneId: string): Promise<number> {
  const campaigns = await db().where("campaigns", { zone_id: zoneId, status: "running" });
  let n = 0;
  for (const c of campaigns) {
    n += await db().updateWhere("calls", { campaign_id: c.id, state: "queued" }, { state: "cancelled", ended_at: nowIso() });
    await db().update("campaigns", c.id, { status: "cancelled" });
  }
  return n;
}

/** The single running "inbound" campaign that public-line calls attach to. */
export async function inboundCampaign(): Promise<Campaign> {
  const existing = (await db().where("campaigns", { kind: "inbound" }))[0];
  if (existing) return existing;
  const meta = await getMeta();
  const c: Campaign = {
    id: uid(), kind: "inbound", stage: "checkin", mode: meta.mode, zone_id: null, zone_name: null, polygon: null,
    alert_text: "", directive_text: null, move_text: null, evac_point: null, wave: null, order_rule: "none",
    started_by: "system", verification_phrase: meta.verification_phrase, callback_number: meta.callback_number,
    hold_id: null, status: "running", created_at: nowIso(),
  };
  await db().insert("campaigns", c);
  return c;
}
