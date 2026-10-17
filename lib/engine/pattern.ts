import "server-only";
import { db, nowIso, uid, withLock } from "@/lib/db";
import { STATE_LABEL, STATE_RANK } from "@/lib/directives";
import { centroidOf, hexCell, hexPolygon, metersBetween, pointInPolygon, zoneForPoint } from "@/lib/geo";
import type { Call, Cluster, Hold, Household, Meta, Proposal, Report, ReportType, Zone, ZoneState } from "@/lib/types";
import { feed, getMeta, ledger, setMeta } from "./log";

// Pattern watch (PRD 12 and 13, backlog items 40, 42, 62, 66): reports and help rows -> hex cells and zones ->
// hazard, help, silence and volume clusters -> corroboration (a sentinel "yes" or a USGS event) -> proposals
// for a human, plus feed cards. The hoax mirror: an uncorroborated cluster reads "not confirmed" and never
// proposes anything. Pattern watch never changes a zone. Cheap and idempotent: the tick calls it about once a
// second; it runs at most once every 3 s and only writes rows that changed.

const HAZARD_WINDOW_MS = 5 * 60_000;
const HAZARD_MIN = 3;
const HELP_WINDOW_MS = 15 * 60_000;
const HELP_MIN = 5;
const SILENCE_WINDOW_MS = 5 * 60_000;
const SILENCE_MIN = 3;
const SILENCE_RADIUS_M = 300;
const VOLUME_WINDOW_MS = 15 * 60_000;
const VOLUME_FACTOR = 3;
const CORROBORATION_MS = 30 * 60_000;
const PRIOR_MS = 60 * 60_000; // history used for a cell's baseline
const REJECT_COOLDOWN_MS = 30 * 60_000; // do not re-propose what a human just rejected
const THROTTLE_MS = 3000;
const QUAKE_TYPES = new Set<string>(["shaking", "damage", "injury"]);
const MODEL_ACTOR = "model (call pattern)";

const g = globalThis as unknown as { __skPatternAt?: number };

const t = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Recompute clusters from recent reports and silences; write proposals and feed cards. Returns changes made. */
export async function runPatternWatch(): Promise<number> {
  const now = Date.now();
  if (now - (g.__skPatternAt ?? 0) < THROTTLE_MS) return 0;
  g.__skPatternAt = now;
  return (await withLock("pattern-watch", pass, true)) ?? 0;
}

/** Run pattern watch now, ignoring the throttle (seeders and POST /api/proposals/run). */
export async function runPatternWatchNow(): Promise<number> {
  g.__skPatternAt = Date.now();
  return (await withLock("pattern-watch", pass)) ?? 0;
}

// ---------- detection ----------

interface Member {
  id: string;
  at: string;
  lat: number;
  lng: number;
  cell: string;
  zone: string | null;
  type: string; // a ReportType, or "help" for a registry row
}

/** Inbound calls per 15 minutes a zone normally gets at this hour (seeded for the demo, PRD 12). */
export function inboundBaseline(zone: Pick<Zone, "population_est">): number {
  return Math.max(2, Math.round((zone.population_est ?? 0) / 40_000));
}

function usgsRadiusKm(mag: number): number {
  return Math.max(10, 20 * (mag - 4)); // toy "felt strongly" radius: M5.9 -> 38 km
}

function majority(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [k, c] of counts) if (c > n) [best, n] = [k, c];
  return best;
}

function typeSummary(types: string[]): string {
  const counts = new Map<string, number>();
  for (const x of types) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, c]) => `${c} ${k === "help" ? "help requests" : k}`)
    .join(", ");
}

interface Corroboration {
  corroborated: boolean;
  reads: number;
  by: string[];
  quake: boolean;
}

interface PassCtx {
  now: number;
  meta: Meta;
  zones: Zone[];
  zoneById: Map<string, Zone>;
  yesReads: Map<string, Set<string>>;
}

/** Sentinel "yes" reads per zone in the last 30 minutes: hold answers plus sentinel-sourced reports. */
function sentinelYesReads(holds: Hold[], hh: Map<string, Household>, reports: Report[], reportZone: Map<string, string | null>, now: number) {
  const out = new Map<string, Set<string>>();
  const add = (zone: string | null | undefined, key: string) => {
    if (!zone) return;
    const set = out.get(zone) ?? new Set<string>();
    set.add(key);
    out.set(zone, set);
  };
  for (const h of holds) {
    for (const s of h.sentinels ?? []) {
      if (s.answer !== "yes" || !s.answered_at || now - t(s.answered_at) > CORROBORATION_MS) continue;
      add(hh.get(s.household_id)?.zone_id ?? h.zone_id, s.household_id);
    }
  }
  for (const r of reports) {
    if (r.source !== "sentinel" || now - t(r.created_at) > CORROBORATION_MS) continue;
    add(reportZone.get(r.id), r.household_id ?? `report:${r.id}`);
  }
  return out;
}

function corroborate(ctx: PassCtx, zoneId: string | null, center: [number, number], types: string[]): Corroboration {
  const reads = zoneId ? ctx.yesReads.get(zoneId)?.size ?? 0 : 0;
  const by: string[] = [];
  if (reads) by.push(`${reads} sentinel read${reads > 1 ? "s" : ""} ("yes")`);
  const quakeish = types.filter((x) => QUAKE_TYPES.has(x) || x === "help").length;
  const quakeShare = types.length ? quakeish / types.length : 0;
  const ev = ctx.meta.usgs_event;
  let covers = false;
  if (ev) {
    const age = ctx.now - t(ev.at);
    covers = age <= CORROBORATION_MS && age >= -60_000 && metersBetween(center, [ev.lng, ev.lat]) <= usgsRadiusKm(ev.mag) * 1000;
  }
  const usgsCorroborates = covers && quakeShare >= 0.5;
  if (usgsCorroborates && ev) {
    const mins = Math.round((ctx.now - t(ev.at)) / 60_000);
    by.push(`a USGS M${ev.mag.toFixed(1)} event ${mins < 1 ? "just now" : `${mins} min ago`} (${ev.place.replace(/\s*\(simulated\)/i, ", simulated")})`);
  }
  const quakeTypesOnly = types.filter((x) => QUAKE_TYPES.has(x)).length;
  return {
    corroborated: reads > 0 || usgsCorroborates,
    reads,
    by,
    quake: (types.length > 0 && quakeTypesOnly / types.length >= 0.5) || (covers && quakeTypesOnly > 0),
  };
}

/** Hex-cell clusters (hazard: >= 3 reports in 5 min; help: >= 5 help or hazard reports in 15 min). */
function hexClusters(
  ctx: PassCtx,
  kind: "hazard" | "help",
  members: Member[],
  windowMs: number,
  min: number,
  prev: Map<string, Cluster>,
  needsHelp: boolean,
): { cluster: Cluster; types: string[]; corr: Corroboration }[] {
  const out: { cluster: Cluster; types: string[]; corr: Corroboration }[] = [];
  const byCell = new Map<string, Member[]>();
  for (const m of members) {
    const age = ctx.now - t(m.at);
    if (age > windowMs || age < -60_000) continue;
    const list = byCell.get(m.cell) ?? [];
    list.push(m);
    byCell.set(m.cell, list);
  }
  for (const [cell, recent] of byCell) {
    if (recent.length < min) continue;
    // A help cluster needs at least one person on the registry in the cell, not only hazard reports.
    if (needsHelp && !recent.some((m) => m.type === "help")) continue;
    const id = `${cell}:${kind}`;
    const p = prev.get(id);
    const windowStart = Math.min(...recent.map((m) => t(m.at)));
    const since = p && ctx.now - t(p.last_at) <= windowMs * 2 ? Math.min(t(p.first_at), windowStart) : windowStart;
    const inCell = members.filter((m) => m.cell === cell);
    const all = inCell.filter((m) => t(m.at) >= since && t(m.at) <= ctx.now + 60_000).sort((a, b) => t(a.at) - t(b.at));
    const prior = inCell.filter((m) => t(m.at) < since && t(m.at) >= since - PRIOR_MS).length;
    const baseline = Math.max(1, round1(prior / (PRIOR_MS / windowMs)));
    const c0 = hexCell(all[0].lat, all[0].lng);
    const zone = majority(all.map((m) => m.zone));
    const types = all.map((m) => m.type);
    const corr = corroborate(ctx, zone, [c0.lng, c0.lat], types);
    out.push({
      types,
      corr,
      cluster: {
        id,
        cell,
        zone_id: zone,
        kind,
        count: all.length,
        baseline,
        score: round2(all.length / baseline),
        corroborated: corr.corroborated,
        sentinel_reads: corr.reads,
        status: p?.status ?? "open",
        center_lat: +c0.lat.toFixed(6),
        center_lng: +c0.lng.toFixed(6),
        member_ids: all.map((m) => m.id),
        first_at: all[0].at,
        last_at: all[all.length - 1].at,
      },
    });
  }
  return out;
}

/** Silence clusters (PRD 13): >= 3 households within ~300 m whose latest call went unanswered in the last 5 min. */
function silenceClusters(ctx: PassCtx, calls: Call[], hh: Map<string, Household>, prev: Map<string, Cluster>) {
  const latest = new Map<string, Call>();
  for (const c of calls) {
    if (!c.household_id) continue;
    const p = latest.get(c.household_id);
    if (!p || p.created_at < c.created_at) latest.set(c.household_id, c);
  }
  const silent: { h: Household; at: string }[] = [];
  for (const [hid, c] of latest) {
    const h = hh.get(hid);
    if (!h || h.role !== "resident") continue;
    const unanswered =
      c.state === "no_answer" || c.state === "unreachable" || c.state === "failed" ||
      (c.state === "ended" && (c.outcome === "no_answer" || c.outcome === "failed"));
    if (!unanswered) continue;
    const at = c.ended_at ?? c.started_at ?? c.created_at;
    if (ctx.now - t(at) > SILENCE_WINDOW_MS) continue;
    silent.push({ h, at });
  }
  silent.sort((a, b) => (a.h.id < b.h.id ? -1 : 1));
  const used = new Set<string>();
  const out: { cluster: Cluster; types: string[]; corr: Corroboration }[] = [];
  const recentlyCalled = new Set(calls.filter((c) => c.household_id && ctx.now - t(c.created_at) <= 15 * 60_000).map((c) => c.household_id!));
  for (const seed of silent) {
    if (used.has(seed.h.id)) continue;
    const group = silent.filter(
      (x) => !used.has(x.h.id) && metersBetween([seed.h.lng, seed.h.lat], [x.h.lng, x.h.lat]) <= SILENCE_RADIUS_M,
    );
    if (group.length < SILENCE_MIN) continue;
    for (const x of group) used.add(x.h.id);
    const ids = group.map((x) => x.h.id);
    const lat = group.reduce((s, x) => s + x.h.lat, 0) / group.length;
    const lng = group.reduce((s, x) => s + x.h.lng, 0) / group.length;
    const overlap = [...prev.values()]
      .filter((c) => c.kind === "silence" && c.member_ids.some((m) => ids.includes(m)))
      .sort((a, b) => b.member_ids.filter((m) => ids.includes(m)).length - a.member_ids.filter((m) => ids.includes(m)).length)[0];
    const cell = overlap?.cell ?? hexCell(lat, lng).key;
    const id = overlap?.id ?? `${cell}:silence`;
    const calledNear = [...recentlyCalled].filter((hid) => {
      const h = hh.get(hid);
      return h && h.role === "resident" && metersBetween([lng, lat], [h.lng, h.lat]) <= SILENCE_RADIUS_M;
    }).length;
    const baseline = Math.max(1, round1(calledNear * 0.2)); // a typical no-answer rate of about one in five
    const times = group.map((x) => x.at).sort();
    out.push({
      types: [],
      corr: { corroborated: false, reads: 0, by: [], quake: false },
      cluster: {
        id,
        cell,
        zone_id: majority(group.map((x) => x.h.zone_id)),
        kind: "silence",
        count: group.length,
        baseline,
        score: round2(group.length / baseline),
        corroborated: false,
        sentinel_reads: 0,
        status: prev.get(id)?.status ?? "open",
        center_lat: +lat.toFixed(6),
        center_lng: +lng.toFixed(6),
        member_ids: ids,
        first_at: times[0],
        last_at: times[times.length - 1],
      },
    });
  }
  return out;
}

/** Volume clusters: a zone at >= 3x its seeded inbound baseline in the last 15 minutes. */
function volumeClusters(ctx: PassCtx, reports: Report[], reportZone: Map<string, string | null>, calls: Call[], prev: Map<string, Cluster>) {
  const out: { cluster: Cluster; types: string[]; corr: Corroboration }[] = [];
  const inbound = calls.filter((c) => c.purpose === "inbound" && ctx.now - t(c.created_at) <= VOLUME_WINDOW_MS);
  const inboundIds = new Set(calls.filter((c) => c.purpose === "inbound").map((c) => c.id));
  for (const zone of ctx.zones) {
    const reps = reports.filter(
      (r) =>
        r.source === "inbound" &&
        reportZone.get(r.id) === zone.id &&
        ctx.now - t(r.created_at) <= VOLUME_WINDOW_MS &&
        !(r.call_id && inboundIds.has(r.call_id)),
    );
    const zoneCalls = inbound.filter((c) => c.vars?.zone_id === zone.id);
    const count = reps.length + zoneCalls.length;
    const baseline = inboundBaseline(zone);
    if (count < VOLUME_FACTOR * baseline) continue;
    const id = `zone:${zone.id}:volume`;
    const [lng, lat] = centroidOf(zone.geom);
    const times = [...reps.map((r) => r.created_at), ...zoneCalls.map((c) => c.created_at)].sort();
    const types = reps.map((r) => r.type as string);
    const corr = corroborate(ctx, zone.id, [lng, lat], types);
    out.push({
      types,
      corr,
      cluster: {
        id,
        cell: `zone:${zone.id}`,
        zone_id: zone.id,
        kind: "volume",
        count,
        baseline,
        score: round2(count / baseline),
        corroborated: corr.corroborated,
        sentinel_reads: corr.reads,
        status: prev.get(id)?.status ?? "open",
        center_lat: +lat.toFixed(6),
        center_lng: +lng.toFixed(6),
        member_ids: [...reps.map((r) => r.id), ...zoneCalls.map((c) => c.id)],
        first_at: times[0],
        last_at: times[times.length - 1],
      },
    });
  }
  return out;
}

function differs(a: Cluster, b: Cluster): boolean {
  return (
    a.count !== b.count || a.baseline !== b.baseline || a.score !== b.score || a.corroborated !== b.corroborated ||
    a.sentinel_reads !== b.sentinel_reads || a.status !== b.status || a.zone_id !== b.zone_id || a.first_at !== b.first_at ||
    a.last_at !== b.last_at || a.member_ids.length !== b.member_ids.length || a.center_lat !== b.center_lat || a.center_lng !== b.center_lng
  );
}

// ---------- cards and proposals ----------

type FeedInput = Parameters<typeof feed>[0];

function clusterCard(c: Cluster, zoneName: string, types: string[], corr: Corroboration): FeedInput {
  const geo = { type: "Point", coordinates: [c.center_lng, c.center_lat] };
  const what = typeSummary(types);
  if (c.kind === "silence") {
    return {
      kind: "silence_cluster", severity: "warn", zone_id: c.zone_id, geo,
      title: `Silence cluster in ${zoneName}: ${c.count} households not answering`,
      detail: `Possible tower or power loss — recommend a door-knock team. ${c.count} households within about 300 m stopped answering within 5 minutes (about ${c.baseline} expected). Correlated silence is a signal for a person, not a conclusion.`,
    };
  }
  const confirm = corr.corroborated ? `Corroborated by ${corr.by.join(" and ")}.` : `Not confirmed: reports ${c.count}, sentinel reads ${c.sentinel_reads}.`;
  if (c.kind === "volume") {
    return {
      kind: "cluster", severity: corr.corroborated ? "critical" : "warn", zone_id: c.zone_id, geo,
      title: corr.corroborated
        ? `Call volume in ${zoneName}: ${c.count} inbound in 15 min (${c.score}× baseline), corroborated`
        : `Not confirmed: reports ${c.count}, sentinel reads ${c.sentinel_reads} (${zoneName} call volume ${c.score}× baseline)`,
      detail: `${confirm} Seeded baseline ${c.baseline} inbound per 15 min.${what ? ` Reports: ${what}.` : ""} The hoax mirror: volume triggers Ask, never Send.`,
    };
  }
  if (c.kind === "help") {
    return {
      kind: "cluster", severity: corr.corroborated ? "critical" : "warn", zone_id: c.zone_id, geo,
      title: `Help cluster in ${zoneName}: ${c.count} help or hazard reports in 15 min`,
      detail: `${what}. ${confirm} Registry rows in this cell are on the QRT list.`,
    };
  }
  return corr.corroborated
    ? {
        kind: "cluster", severity: corr.quake ? "critical" : "warn", zone_id: c.zone_id, geo,
        title: `Corroborated cluster in ${zoneName}: ${c.count} reports (${what})`,
        detail: `${c.count} reports in one hex cell (about 0.7 km²). ${confirm} A proposal goes to the supervisor; nothing changes until a human approves.`,
      }
    : {
        kind: "cluster", severity: "warn", zone_id: c.zone_id, geo,
        title: `Not confirmed: reports ${c.count}, sentinel reads ${c.sentinel_reads} (${zoneName})`,
        detail: `${c.count} reports (${what}) in one hex cell within 5 minutes and no sentinel has confirmed. The hoax mirror: a cluster triggers Ask, never Send.`,
      };
}

/** Convex hull (Andrew's monotone chain) of [lng, lat] points, as a closed ring. */
function hull(points: number[][]): number[][] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return [...pts, pts[0]];
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: number[][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: number[][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const ring = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  return [...ring, ring[0]];
}

/** The outline a proposal carries: the cluster's hex cell, or the hull of several cells. */
function envelopeFor(clusters: Cluster[]): GeoJSON.Polygon | null {
  if (!clusters.length) return null;
  if (clusters.length === 1) return hexPolygon(clusters[0].center_lat, clusters[0].center_lng);
  const pts = clusters.flatMap((c) => hexPolygon(c.center_lat, c.center_lng).coordinates[0].slice(0, -1));
  return { type: "Polygon", coordinates: [hull(pts)] };
}

/** Proposals for corroborated hazard clusters, one per zone; marks covered clusters "proposed". Returns rows written. */
async function propose(
  ctx: PassCtx,
  found: { cluster: Cluster; types: string[]; corr: Corroboration }[],
  proposals: Proposal[],
): Promise<number> {
  const byZone = new Map<string, typeof found>();
  for (const f of found) {
    const c = f.cluster;
    if (c.kind !== "hazard" || !c.corroborated || c.status !== "open" || !c.zone_id) continue;
    const list = byZone.get(c.zone_id) ?? [];
    list.push(f);
    byZone.set(c.zone_id, list);
  }
  let writes = 0;
  for (const [zoneId, list] of byZone) {
    const zone = ctx.zoneById.get(zoneId);
    if (!zone) continue;
    const quake = list.some((f) => f.corr.quake);
    const state: ZoneState = quake ? "shelter_in_place" : "watch";
    if (STATE_RANK[zone.state] >= STATE_RANK[state]) continue; // the zone is already there or higher
    const same = (p: Proposal) => p.zone_id === zoneId && p.proposed_state === state;
    const open = proposals.find((p) => same(p) && p.status === "open");
    const rejected = proposals.find((p) => same(p) && p.status === "rejected" && ctx.now - t(p.decided_at) <= REJECT_COOLDOWN_MS);
    for (const f of list) f.cluster.status = "proposed";
    if (open || rejected) continue;

    const clusters = list.map((f) => f.cluster);
    const total = clusters.reduce((s, c) => s + c.count, 0);
    const types = list.flatMap((f) => f.types);
    const first = Math.min(...clusters.map((c) => t(c.first_at)));
    const last = Math.max(...clusters.map((c) => t(c.last_at)));
    const minutes = Math.max(1, Math.round((last - first) / 60_000));
    const by = [...new Set(list.flatMap((f) => f.corr.by))];
    const reads = Math.max(...list.map((f) => f.corr.reads));
    const reason =
      `Call pattern: ${total} reports (${typeSummary(types)}) in ${clusters.length} hex cell${clusters.length > 1 ? "s" : ""} in ${zone.name} within ${minutes} min; ` +
      `corroborated by ${by.join(" and ")}. ${quake ? "Earthquake mode: proposes Shelter in Place." : "Proposes Watch."}`;
    const proposal: Proposal = {
      id: uid(),
      zone_id: zoneId,
      proposed_state: state,
      model: "call_pattern",
      reason,
      score: round2(Math.min(0.95, 0.5 + 0.015 * total + (by.some((b) => b.includes("USGS")) ? 0.1 : 0) + 0.05 * reads)),
      envelope: envelopeFor(clusters),
      status: "open",
      decided_by: null,
      decided_at: null,
      decision_reason: null,
      created_at: nowIso(),
    };
    await db().insert("proposals", proposal);
    proposals.push(proposal);
    await feed({
      kind: "proposal", severity: quake ? "critical" : "warn", zone_id: zoneId, geo: proposal.envelope,
      title: `Model proposes ${STATE_LABEL[state]} for ${zone.name}`,
      detail: `${reason} Needs a human.`,
    });
    await ledger({ actor: MODEL_ACTOR, action: `propose zone: ${STATE_LABEL[state]}`, kind: "system", target: zone.name, reason });
    writes += 3;
  }
  return writes;
}

// ---------- the pass ----------

async function pass(): Promise<number> {
  const s = db();
  const [meta, zones, reports, clusters, holds, calls, households, helps, proposals] = await Promise.all([
    getMeta(), s.all("zones"), s.all("reports"), s.all("clusters"), s.all("holds"), s.all("calls"), s.all("households"),
    s.all("help_requests"), s.all("proposals"),
  ]);
  if (!zones.length) return 0;
  const now = Date.now();
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const hh = new Map(households.map((h) => [h.id, h]));
  const prev = new Map(clusters.map((c) => [c.id, c]));
  const reportZone = new Map<string, string | null>(
    reports.map((r) => [r.id, r.zone_id && zoneById.has(r.zone_id) ? r.zone_id : zoneForPoint(r.lng, r.lat, zones)?.id ?? null]),
  );
  const ctx: PassCtx = { now, meta, zones, zoneById, yesReads: sentinelYesReads(holds, hh, reports, reportZone, now) };

  // Only recent rows can form a cluster; older ones only feed a cell's baseline.
  const horizon = now - HELP_WINDOW_MS - PRIOR_MS - 60_000;
  const reportMembers: Member[] = reports
    .filter((r) => t(r.created_at) >= horizon)
    .map((r) => ({ id: r.id, at: r.created_at, lat: r.lat, lng: r.lng, cell: hexCell(r.lat, r.lng).key, zone: reportZone.get(r.id) ?? null, type: r.type }));
  const helpMembers: Member[] = helps
    .filter((h) => h.last_lat !== null && h.last_lng !== null && h.status !== "closed" && t(h.created_at) >= horizon)
    .map((h) => ({
      id: h.id, at: h.created_at, lat: h.last_lat!, lng: h.last_lng!, cell: hexCell(h.last_lat!, h.last_lng!).key,
      zone: h.zone_id ?? zoneForPoint(h.last_lng!, h.last_lat!, zones)?.id ?? null, type: "help",
    }));

  const found = [
    ...hexClusters(ctx, "hazard", reportMembers, HAZARD_WINDOW_MS, HAZARD_MIN, prev, false),
    ...hexClusters(ctx, "help", [...reportMembers, ...helpMembers], HELP_WINDOW_MS, HELP_MIN, prev, true),
    ...silenceClusters(ctx, calls, hh, prev),
    ...volumeClusters(ctx, reports, reportZone, calls, prev),
  ];
  // A human may have dismissed a cluster: keep it dismissed and never propose from it.
  for (const f of found) if (prev.get(f.cluster.id)?.status === "dismissed") f.cluster.status = "dismissed";

  let changes = await propose(ctx, found, proposals);

  const changed = found.filter((f) => {
    const p = prev.get(f.cluster.id);
    return !p || differs(p, f.cluster);
  });
  if (changed.length) await s.upsert("clusters", changed.map((f) => f.cluster));
  changes += changed.length;

  for (const f of changed) {
    const p = prev.get(f.cluster.id);
    const zoneName = f.cluster.zone_id ? zoneById.get(f.cluster.zone_id)?.name ?? f.cluster.zone_id : "outside the zones";
    if (!p) {
      await feed(clusterCard(f.cluster, zoneName, f.types, f.corr));
      changes++;
    } else if (!p.corroborated && f.cluster.corroborated && f.cluster.kind !== "silence") {
      await feed({
        kind: "cluster", severity: "warn", zone_id: f.cluster.zone_id, geo: { type: "Point", coordinates: [f.cluster.center_lng, f.cluster.center_lat] },
        title: `Cluster now corroborated in ${zoneName}: ${f.cluster.count} reports`,
        detail: `Corroborated by ${f.corr.by.join(" and ")}.`,
      });
      changes++;
    }
  }
  return changes;
}

// ---------- seeders (the /api/demo/sim route calls these) ----------

function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** n points inside one hex cell (within ~200 m of its center), all in `zone`. */
function pointsInCell(cellOf: { key: string; lat: number; lng: number }, zone: Zone, n: number, r: () => number): [number, number][] {
  const out: [number, number][] = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 50) {
    const ang = r() * 2 * Math.PI;
    const dist = Math.sqrt(r()) * 200;
    const lat = cellOf.lat + (dist * Math.sin(ang)) / 111_320;
    const lng = cellOf.lng + (dist * Math.cos(ang)) / (111_320 * Math.cos((cellOf.lat * Math.PI) / 180));
    if (hexCell(lat, lng).key !== cellOf.key || !pointInPolygon(lng, lat, zone.geom)) continue;
    out.push([+lng.toFixed(6), +lat.toFixed(6)]);
  }
  return out;
}

async function westsideZone(id: string, what: string): Promise<Zone | null> {
  const meta = await getMeta();
  const zone = await db().get("zones", id);
  if (meta.scenario === "westside" && zone) return zone;
  await feed({
    kind: "info",
    title: `${what} is scripted for the Westside scenario`,
    detail: `Nothing was seeded: the current scenario is ${meta.scenario}. Reset to westside on /demo first.`,
  });
  return null;
}

function reportRow(type: ReportType, lng: number, lat: number, zoneId: string, source: Report["source"], text: string, at: string): Report {
  return { id: uid(), type, lat, lng, zone_id: zoneId, source, household_id: null, call_id: null, text, synthetic: true, created_at: at };
}

/** Earthquake beat (PRD 12): a seeded USGS-style M5.9 event and ~20 reports in two Mid-City hex cells. */
export async function seedEarthquake(): Promise<void> {
  const zone = await westsideZone("LA-MC", "The earthquake beat");
  if (!zone) return;
  const r = prng(59_0001);
  const now = Date.now();
  const epicenter = { lat: 34.012, lng: -118.355 };
  await setMeta({
    usgs_event: { mag: 5.9, place: "Newport-Inglewood fault near Mid-City (simulated)", lat: epicenter.lat, lng: epicenter.lng, at: new Date(now).toISOString() },
  });
  // Two cells in Mid-City: around Pico and La Brea, and around Pico and Crenshaw (demo choices).
  const anchors: [number, number][] = [[-118.345, 34.04], [-118.325, 34.035]];
  const texts: Record<string, string[]> = {
    shaking: ["strong shaking, items fallen", "shaking, caller frightened", "shaking, glass broken"],
    damage: ["wall collapse on Pico Blvd", "chimney down, debris on sidewalk", "cracked facade, gas smell reported"],
    injury: ["person struck by debris", "fall injury during shaking"],
  };
  const plan: ReportType[] = ["shaking", "damage", "shaking", "damage", "injury", "shaking", "damage", "shaking", "damage", "injury"];
  const rows: Report[] = [];
  for (const [lng, lat] of anchors) {
    const [clng, clat] = centroidOf(zone.geom);
    const cellOf = pointInPolygon(lng, lat, zone.geom) ? hexCell(lat, lng) : hexCell(clat, clng);
    const pts = pointsInCell(cellOf, zone, plan.length, r);
    pts.forEach(([plng, plat], i) => {
      const type = plan[i % plan.length];
      const list = texts[type];
      const at = new Date(now - Math.round(r() * 4 * 60_000)).toISOString();
      rows.push(reportRow(type, plng, plat, zone.id, "seeded", `Seeded CAD (synthetic): ${list[i % list.length]}`, at));
    });
  }
  rows.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  await db().insert("reports", rows);
  await feed({
    kind: "info",
    severity: "critical",
    zone_id: zone.id,
    geo: { type: "Point", coordinates: [epicenter.lng, epicenter.lat] },
    title: "USGS event (simulated): M5.9, Newport-Inglewood fault near Mid-City",
    detail: `Earthquake mode. ${rows.length} seeded 911-style reports (shaking, damage, injury) landed in two Mid-City hex cells over the last 4 minutes. Pattern watch clusters them; any proposal needs a human.`,
  });
  await runPatternWatchNow();
}

/** Hoax flood: ~200 inbound-style reports in one zone with zero sentinel reads. */
export async function seedHoaxFlood(): Promise<void> {
  const zone = await westsideZone("LA-KT", "The hoax flood drill");
  if (!zone) return;
  const r = prng(200_0002);
  const now = Date.now();
  // Two cells in Koreatown (around Wilshire and Normandie, and Olympic and Vermont; demo choices).
  const anchors: { at: [number, number]; n: number; street: string }[] = [
    { at: [-118.297, 34.061], n: 130, street: "Wilshire Blvd" },
    { at: [-118.288, 34.052], n: 70, street: "Olympic Blvd" },
  ];
  const rows: Report[] = [];
  for (const a of anchors) {
    const cellOf = hexCell(a.at[1], a.at[0]);
    const pts = pointsInCell(cellOf, zone, a.n, r);
    for (const [lng, lat] of pts) {
      const type: ReportType = r() < 0.7 ? "smoke" : "fire";
      const at = new Date(now - Math.round(r() * 4.5 * 60_000)).toISOString();
      rows.push(reportRow(type, lng, lat, zone.id, "inbound", `Inbound caller (synthetic): ${type} near ${a.street}`, at));
    }
  }
  rows.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  await db().insert("reports", rows);
  await feed({
    kind: "info",
    severity: "warn",
    zone_id: zone.id,
    geo: { type: "Point", coordinates: anchors[0].at },
    title: `Hoax flood drill (simulated): ${rows.length} inbound reports of smoke in ${zone.name}`,
    detail:
      "Synthetic inbound reports in 5 minutes, with no sentinel confirmation. Watch the hoax mirror: reports high, sentinel reads zero. Clusters trigger Ask, never Send.",
  });
  await runPatternWatchNow();
}
