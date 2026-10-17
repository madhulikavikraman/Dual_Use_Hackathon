import "server-only";
import { db, nowIso, uid } from "@/lib/db";
import { LEAVE_IF_UNSAFE } from "@/lib/directives";
import { HttpError } from "@/lib/http";
import type { EvacPlan, EvacTemplates, Scenario, Zone } from "@/lib/types";
import { buildPlan, firstWave, pullForward, refresh, waveCount } from "./blocks";
import { startBlockCalls, applyPlanToQueuedCalls } from "./campaigns";
import { routesFor } from "./evacRoutes";
import { feed, ledger } from "./log";

// Block-by-block evacuation plans: proposed by the system, approved by a named human with a reason, run on a wave
// clock. The zone's legal state is never touched here (an Order stays the zone's Order): the plan orders the calls
// and the route advice. "Everyone go now" is always one click. The fire model may pull a block forward at any time.

export const PLANNER_ACTOR = "system (block planner)";
export const CLOCK_ACTOR = "wave clock";
const LIVE: EvacPlan["status"][] = ["proposed", "standby", "active", "all_go"];

/** The zone's plan in use (proposed, standby, active or all go), newest first. Null before migration 005 on Supabase. */
export async function planFor(zoneId: string): Promise<EvacPlan | null> {
  const rows = await db().where("evac_plans", { zone_id: zoneId }).catch(() => [] as EvacPlan[]);
  return rows.filter((p) => LIVE.includes(p.status)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] ?? null;
}

/** Every plan in use for the zones of the current scenario (the board's map and panel). */
export async function plansNow(): Promise<EvacPlan[]> {
  const zones = new Set((await db().all("zones")).map((z) => z.id));
  const rows = await db().all("evac_plans").catch(() => [] as EvacPlan[]);
  const latest = new Map<string, EvacPlan>();
  for (const p of rows) {
    if (!zones.has(p.zone_id) || !LIVE.includes(p.status)) continue;
    const prev = latest.get(p.zone_id);
    if (!prev || prev.created_at < p.created_at) latest.set(p.zone_id, p);
  }
  return [...latest.values()].map((p) => refresh(p));
}

async function save(plan: EvacPlan): Promise<EvacPlan> {
  const next = refresh({ ...plan, updated_at: nowIso() });
  await db().upsert("evac_plans", next);
  return next;
}

async function zoneOrThrow(zoneId: string): Promise<Zone> {
  const zone = await db().get("zones", zoneId);
  if (!zone) throw new HttpError(404, "zone not found");
  return zone;
}

async function livePlanOrThrow(zoneId: string): Promise<EvacPlan> {
  const plan = await planFor(zoneId);
  if (!plan) throw new HttpError(404, "This zone has no block plan");
  return plan;
}

const needName = (actor: string, reason: string) => {
  if (!actor.trim() || !reason.trim()) throw new HttpError(400, "A name and a reason are required");
};

/** Build a plan for the zone (status "proposed"). Returns the plan in use when there is one, or null without exit roads. */
export async function proposePlan(zoneId: string, by = PLANNER_ACTOR, opts: { wave_minutes?: number; quiet?: boolean } = {}): Promise<EvacPlan | null> {
  const zone = await zoneOrThrow(zoneId);
  const existing = await planFor(zoneId);
  if (existing) return existing;
  const routes = routesFor(zone.id);
  if (!routes.length) return null;
  const households = await db().where("households", { zone_id: zone.id });
  const plan = buildPlan({ zone, households, routes, proposed_by: by, wave_minutes: opts.wave_minutes });
  await db().insert("evac_plans", plan);
  if (!opts.quiet) {
    const w1 = firstWave(plan);
    await feed({
      kind: "proposal", severity: "warn", zone_id: zone.id,
      title: `Block plan proposed for ${zone.name}: ${plan.blocks.length} blocks in ${waveCount(plan)} waves of ${plan.wave_minutes} min`,
      detail: `Wave 1 now: about ${w1.people.toLocaleString("en-US")} people in ${w1.blocks} block${w1.blocks === 1 ? "" : "s"}, on ${plan.routes.length} exit roads. Needs a named human. Until then every call reads the full Order.`,
    });
    await ledger({ actor: by, action: "propose block plan", kind: "system", target: zone.name, reason: `${plan.blocks.length} blocks, ${waveCount(plan)} waves of ${plan.wave_minutes} min; nearest the hazard first` });
  }
  return plan;
}

const TEMPLATE_RULES: { key: keyof EvacTemplates; need: string[] }[] = [
  { key: "go_now", need: ["{block}", "{route}"] },
  { key: "get_ready", need: ["{block}", "{wave}", "{route}"] },
  { key: "all_go", need: ["{block}", "{route}"] },
];

function checkTemplates(t: EvacTemplates) {
  for (const { key, need } of TEMPLATE_RULES) {
    const missing = need.filter((x) => !t[key].includes(x));
    if (missing.length) throw new HttpError(400, `The ${key.replace("_", " ")} message needs ${missing.join(", ")}`);
  }
  // A "wait for your wave" message must always tell people to go at once if they are in danger.
  if (!/leave right away/i.test(t.get_ready)) throw new HttpError(400, `The get-ready message must keep: "${LEAVE_IF_UNSAFE}"`);
}

/** A named human approves the plan (and its message templates). Under an Order it starts at once; else it stands by. */
export async function approvePlan(zoneId: string, body: {
  approved_by: string; reason: string; wave_minutes?: number; templates?: Partial<EvacTemplates>;
}): Promise<EvacPlan> {
  needName(body.approved_by, body.reason);
  const zone = await zoneOrThrow(zoneId);
  let plan = (await planFor(zoneId)) ?? (await proposePlan(zoneId, PLANNER_ACTOR, { quiet: true }));
  if (!plan) throw new HttpError(409, "No exit roads are set up for this zone, so there is no block plan to approve");
  if (plan.status !== "proposed") throw new HttpError(409, `The block plan is already ${plan.status === "all_go" ? "everyone go now" : plan.status}`);
  const templates = { ...plan.templates, ...Object.fromEntries(Object.entries(body.templates ?? {}).filter(([, v]) => typeof v === "string" && v.trim())) } as EvacTemplates;
  checkTemplates(templates);
  if (body.wave_minutes && body.wave_minutes !== plan.wave_minutes) {
    // A different wave length re-packs the waves (and is raised if a block would not fit its road).
    const households = await db().where("households", { zone_id: zone.id });
    const rebuilt = buildPlan({ zone, households, routes: plan.routes, proposed_by: plan.proposed_by, wave_minutes: body.wave_minutes, id: plan.id, at: plan.created_at });
    plan = { ...rebuilt, created_at: plan.created_at };
  }
  const at = nowIso();
  const order = zone.state === "order";
  plan = await save({
    ...plan, templates, approved_by: body.approved_by, approved_at: at, reason: body.reason,
    status: order ? "active" : "standby", current_wave: order ? 1 : 0, wave_started_at: order ? at : null,
  });
  await ledger({
    actor: body.approved_by, action: `approve block plan: ${plan.blocks.length} blocks, ${waveCount(plan)} waves of ${plan.wave_minutes} min${order ? ", wave 1 goes now" : " (stands by until an Order)"}`,
    target: zone.name, reason: body.reason,
  });
  if (order) await onWaveStart(zone, plan, body.approved_by, `Block plan approved: wave 1 goes now`, true);
  else await feed({ kind: "info", zone_id: zone.id, title: `Block plan approved for ${zone.name} (stands by)`, detail: `Approved by ${body.approved_by}. It starts with wave 1 when an Order is sent.` });
  return plan;
}

export async function rejectPlan(zoneId: string, actor: string, reason: string): Promise<EvacPlan> {
  needName(actor, reason);
  const zone = await zoneOrThrow(zoneId);
  const plan = await livePlanOrThrow(zoneId);
  if (plan.status !== "proposed") throw new HttpError(409, "Only a proposed plan can be rejected; use Everyone go now instead");
  const next = await save({ ...plan, status: "rejected", reason });
  await ledger({ actor, action: "reject block plan (every call reads the full Order)", target: zone.name, reason });
  return next;
}

/** The zone moved to Order (the hold sent): an approved plan starts with wave 1. A proposed one waits for a human. */
export async function activatePlan(zone: Zone, actor: string): Promise<EvacPlan | null> {
  const plan = await planFor(zone.id);
  if (!plan || plan.status !== "standby") return plan;
  const at = nowIso();
  const next = await save({ ...plan, status: "active", current_wave: 1, wave_started_at: at, held: false });
  await ledger({ actor, action: "block plan starts: wave 1 goes now", kind: actor === "timer" || actor === "system" ? "system" : "decision", target: zone.name, reason: `Order sent; plan approved by ${plan.approved_by}` });
  return next;
}

/** Start the next wave now (a person, or the wave clock). */
export async function advanceWave(zoneId: string, actor: string, reason: string): Promise<EvacPlan> {
  needName(actor, reason);
  const zone = await zoneOrThrow(zoneId);
  const plan = await livePlanOrThrow(zoneId);
  if (plan.status !== "active") throw new HttpError(409, plan.status === "all_go" ? "Everyone is already going now" : "The plan is not running (it starts when the Order is sent)");
  const total = waveCount(plan);
  if (plan.current_wave > total) throw new HttpError(409, "Every wave has started");
  const next = await save({ ...plan, current_wave: plan.current_wave + 1, wave_started_at: nowIso(), held: false, held_by: null, held_reason: null });
  await ledger({
    actor, action: next.current_wave > total ? "block plan: last wave done" : `start wave ${next.current_wave} of ${total}`, target: zone.name, reason,
    kind: actor === CLOCK_ACTOR ? "system" : "decision",
  });
  if (next.current_wave <= total) await onWaveStart(zone, next, actor, reason, false);
  return next;
}

/** Hold the next wave (the current wave keeps going: a hold never stops anyone who is leaving), or release it. */
export async function holdWave(zoneId: string, actor: string, reason: string, release = false): Promise<EvacPlan> {
  needName(actor, reason);
  const zone = await zoneOrThrow(zoneId);
  const plan = await livePlanOrThrow(zoneId);
  if (plan.status !== "active") throw new HttpError(409, "Only a running plan has a next wave to hold");
  if (release === !plan.held) return refresh(plan);
  const next = await save({ ...plan, held: !release, held_by: release ? null : actor, held_reason: release ? null : reason });
  await ledger({
    actor, action: release ? `release hold: wave ${plan.current_wave + 1} may start` : `hold wave ${plan.current_wave + 1} (wave ${plan.current_wave} keeps going)`,
    target: zone.name, reason,
  });
  await feed({
    kind: "info", severity: release ? "info" : "warn", zone_id: zone.id,
    title: release ? `${zone.name}: wave ${plan.current_wave + 1} released by ${actor}` : `${zone.name}: wave ${plan.current_wave + 1} held by ${actor}`,
    detail: release ? reason : `${reason}. Residents waiting still hear: ${LEAVE_IF_UNSAFE}`,
  });
  return next;
}

/** Everyone in the zone goes now, on their block's road. One click for the named human; logged. */
export async function everyoneGoNow(zoneId: string, actor: string, reason: string): Promise<EvacPlan> {
  needName(actor, reason);
  const zone = await zoneOrThrow(zoneId);
  const plan = await livePlanOrThrow(zoneId);
  if (zone.state !== "order") throw new HttpError(409, `${zone.name} is not under an Order. Send the Order first (an IC order skips the hold).`);
  if (plan.status === "all_go") return refresh(plan);
  // Blocks not yet told to go: later waves of a running plan, or every block of a plan that had not started.
  const waiting = plan.blocks.filter((b) => plan.status !== "active" || b.wave > plan.current_wave).map((b) => b.id);
  const next = await save({
    ...plan, status: "all_go", current_wave: Math.max(1, plan.current_wave), wave_started_at: plan.wave_started_at ?? nowIso(),
    approved_by: plan.approved_by ?? actor, approved_at: plan.approved_at ?? nowIso(), reason: plan.reason ?? reason, held: false,
  });
  await ledger({ actor, action: `everyone go now: all ${plan.blocks.length} blocks at once`, target: zone.name, reason });
  await feed({ kind: "send", severity: "critical", zone_id: zone.id, title: `Everyone go now: ${zone.name}`, detail: `${actor}: ${reason}. Every block leaves now on its own road.` });
  // Every call still queued takes the all-go words; blocks not yet told to go get new calls.
  await applyPlanToQueuedCalls(zone, next);
  await startBlockCalls(zone, next, waiting, actor, `Everyone go now: ${reason}`);
  return next;
}

/** The fire model (or a person) moves blocks up to "go now"; later waves reflow. Safety only ever moves people sooner. */
export async function pullBlocksForward(zoneId: string, blockIds: string[], actor: string, why: string): Promise<{ plan: EvacPlan; moved: string[] } | null> {
  const zone = await db().get("zones", zoneId);
  const plan = await planFor(zoneId);
  if (!zone || !plan || plan.status === "all_go") return null;
  const r = pullForward(plan, blockIds, why);
  if (!r.moved.length) return { plan, moved: [] };
  const next = await save(r.plan);
  const running = next.status === "active";
  await ledger({
    actor, action: `pull block${r.moved.length === 1 ? "" : "s"} forward to ${running ? "go now" : "wave 1"}: ${r.moved.join(", ")}`,
    kind: actor.startsWith("model") || actor === "system" ? "system" : "decision", target: zone.name, reason: `${why}. Later waves reflowed.`,
  });
  await feed({
    kind: "info", severity: "warn", zone_id: zone.id,
    title: `${zone.name}: ${r.moved.join(", ")} pulled forward to ${running ? "go now" : "wave 1"}`,
    detail: `${why}. Later waves reflowed; now ${waveCount(next)} waves.`,
  });
  if (running) await startBlockCalls(zone, next, r.moved, actor === "system" ? "system" : actor, why);
  return { plan: next, moved: r.moved };
}

/** Calls for a wave that just started: everyone in its blocks hears "leave now"; queued calls take the plan's words. */
async function onWaveStart(zone: Zone, plan: EvacPlan, actor: string, reason: string, first: boolean) {
  if (first) {
    // Approved while the Order relay is running: the calls still queued take the plan's words. Everyone already called
    // heard the full Order ("leave now"), which is what wave 1 hears anyway, so nobody is called twice for it.
    const running = (await db().where("campaigns", { zone_id: zone.id, status: "running" })).some((c) => c.kind === "order");
    if (running) {
      await applyPlanToQueuedCalls(zone, plan);
      return;
    }
  }
  const ids = plan.blocks.filter((b) => b.wave === plan.current_wave).map((b) => b.id);
  await startBlockCalls(zone, plan, ids, actor === CLOCK_ACTOR ? "system" : actor, reason);
}

/** The wave clock: once approved and running, the next wave starts every `wave_minutes` unless a human holds it. */
export async function planTick(now: string): Promise<number> {
  let n = 0;
  const rows = await db().where("evac_plans", { status: "active" }).catch(() => [] as EvacPlan[]);
  for (const plan of rows) {
    if (plan.held || !plan.wave_started_at) continue;
    if (plan.current_wave > waveCount(plan)) continue;
    if (Date.parse(now) - Date.parse(plan.wave_started_at) < plan.wave_minutes * 60_000) continue;
    const zone = await db().get("zones", plan.zone_id);
    if (!zone || zone.state !== "order") continue;
    await advanceWave(plan.zone_id, CLOCK_ACTOR, `${plan.wave_minutes} min wave clock`);
    n++;
  }
  return n;
}

/** The zone left the Order ladder (lifted, back to monitor): its plan is closed. */
export async function closePlan(zoneId: string, actor: string, why: string) {
  const plan = await planFor(zoneId).catch(() => null);
  if (!plan) return;
  await save({ ...plan, status: "closed", reason: plan.reason ?? why });
  await ledger({ actor, action: "close block plan", kind: "system", target: zoneId, reason: why });
}

// ---------- seed (scenario reset) ----------

export const SEED_ACTOR = "Duty officer (seed)";

/**
 * Westside start: Santa Monica (an Order) runs an approved plan, its early waves done, the current one going now;
 * Venice and Mar Vista (a Warning) has an approved plan standing by. Norte: Forster Ranch (an Order) runs one too.
 */
export async function seedPlans(scenario: Scenario, at: string) {
  const zones = await db().all("zones");
  const households = await db().all("households");
  const seeds: { id: string; done: number }[] =
    scenario === "westside" ? [{ id: "LA-SM", done: 3 }, { id: "LA-VN", done: 0 }] : scenario === "norte" ? [{ id: "NOR-FR", done: 1 }] : [];
  for (const s of seeds) {
    const zone = zones.find((z) => z.id === s.id);
    const routes = routesFor(s.id);
    if (!zone || !routes.length) continue;
    const base = buildPlan({ zone, households: households.filter((h) => h.zone_id === zone.id), routes, proposed_by: PLANNER_ACTOR, at, id: uid() });
    const order = zone.state === "order";
    const current = order ? Math.min(waveCount(base), s.done + 1) : 0;
    // The current wave began a few minutes ago; earlier waves ran on the clock before it.
    const startedAt = order ? new Date(Date.parse(at) - 4 * 60_000).toISOString() : null;
    const plan = refresh(
      {
        ...base, status: order ? "active" : "standby", current_wave: current, wave_started_at: startedAt,
        approved_by: SEED_ACTOR, approved_at: at, reason: "Scenario start (seeded)",
      },
      at,
    );
    await db().insert("evac_plans", plan);
    await ledger({
      actor: SEED_ACTOR,
      action: `approve block plan: ${plan.blocks.length} blocks, ${waveCount(plan)} waves of ${plan.wave_minutes} min${order ? `, wave ${current} going now` : " (stands by until an Order)"}`,
      target: zone.name, reason: "Scenario start (seeded)",
    });
  }
}
