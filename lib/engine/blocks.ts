// Block-by-block evacuation (PRD: "the gentlest response that still works"). Pure functions: no database, safe on
// the server, in the browser and in scripts. lib/engine/plans.ts stores plans and runs the wave clock.
//
// 1. Blocks: a square grid of about 800 m cells (about 10 to 12 LA city blocks) clipped to the zone polygon; slivers
//    under 15% of a cell merge into a neighbor. Ids are the zone's short code plus a rank from the hazard edge
//    (SM-01 is nearest), using the same distance the edge-first call sweep uses.
// 2. Waves: blocks are placed nearest-to-hazard first. Each takes the earliest wave on the nearest exit road with room
//    (roads within 1.5 km of its nearest one), no road gets more cars in a wave than it carries in the wave's length,
//    and on every road a nearer block never goes after a farther one. So no block ever waits because of a farther block.
//    The wave length starts at 10 minutes and is raised (5-minute steps) until every block fits one of its roads.
// 3. Safety: the fire model (or a person) can pull a block forward to "go now" at any time and later waves reflow;
//    "Everyone go now" is always one click; the zone's legal Order is untouched. The plan only orders calls and route advice.
import {
  area, centroid, featureCollection, intersect, lineString, point, pointOnFeature, pointToLineDistance, polygon as turfPolygon, union,
} from "@turf/turf";
import { BLOCK_TEMPLATES, fillBlockTemplate } from "@/lib/directives";
import { edgeDistanceM, pointInPolygon } from "@/lib/geo";
import type { BlockStatus, EvacBlock, EvacPlan, EvacRoute, EvacTemplates, EvacWave, Household, Zone } from "@/lib/types";

/** Grid cell side: about 800 m, roughly 10 to 12 Los Angeles city blocks. */
export const CELL_M = 800;
/** A clipped cell smaller than this share of a full cell merges into a neighbor. */
export const SLIVER_SHARE = 0.15;
/** Planning assumptions (shown on screen with every number they produce). */
export const PEOPLE_PER_HOUSEHOLD = 2.5;
export const CARS_PER_HOUSEHOLD = 1;
/** Cars per outbound lane per hour on an exit road: half the HCM base saturation flow (1,900 per lane per hour of green). */
export const PER_LANE_VPH = 950;
export const DEFAULT_WAVE_MINUTES = 10;
const WAVE_STEP_MINUTES = 5;
const MAX_WAVE_MINUTES = 60;
/** A block may take a road up to this much farther than its nearest one when the nearest is full. */
const ROUTE_REACH_M = 1500;

export const ASSUMPTIONS =
  `Planning assumptions, not counts: ${PEOPLE_PER_HOUSEHOLD} people and ${CARS_PER_HOUSEHOLD} car per household ` +
  "(the US average household is about 2.5 people, Census Bureau); people are shared out by area from the zone's population estimate. " +
  `Road capacity: ${PER_LANE_VPH} cars per outbound lane per hour, half the Highway Capacity Manual's base saturation flow ` +
  "of 1,900 per lane per hour of green (FHWA HPMS Field Manual), as at a signal; lane counts from OpenStreetMap. Simulated.";

export const DEFAULT_TEMPLATES: EvacTemplates = { ...BLOCK_TEMPLATES };

/** "LA-SM" -> "SM", "NOR-RMV" -> "RMV". */
export function shortCode(zoneId: string): string {
  const parts = zoneId.split("-");
  return (parts.length > 1 ? parts.slice(1).join("") : zoneId).toUpperCase();
}

const round5 = (x: number) => Math.round(x * 1e5) / 1e5;
const roundTo = (x: number, step: number) => Math.round(x / step) * step;

function cleanRing(ring: number[][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [x, y] of ring) {
    const p: [number, number] = [round5(x), round5(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  if (out.length && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) out.push(out[0]);
  return out;
}

const cleanPolygon = (g: GeoJSON.Polygon): GeoJSON.Polygon => ({ type: "Polygon", coordinates: g.coordinates.map(cleanRing) });

function polygonsOf(g: GeoJSON.Polygon | GeoJSON.MultiPolygon | null | undefined): GeoJSON.Polygon[] {
  if (!g) return [];
  if (g.type === "Polygon") return [g];
  return g.coordinates.map((coordinates) => ({ type: "Polygon", coordinates }));
}

interface Piece {
  geom: GeoJSON.Polygon;
  area: number; // m^2
  cells: Set<string>; // grid cells "i,j" this piece covers
}

const touching = (a: Piece, b: Piece) => {
  for (const k of a.cells) {
    const [i, j] = k.split(",").map(Number);
    for (const n of [k, `${i + 1},${j}`, `${i - 1},${j}`, `${i},${j + 1}`, `${i},${j - 1}`]) if (b.cells.has(n)) return true;
  }
  return false;
};

/** The zone's polygon cut into evacuation blocks (no plan data yet: route, wave and status come from planWaves). */
export function makeBlocks(zone: Zone, households: Household[], cellM = CELL_M): EvacBlock[] {
  const ring = zone.geom.coordinates[0];
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const [w, s, e, n] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const dLat = cellM / 111_320;
  const dLng = cellM / (111_320 * Math.cos((((s + n) / 2) * Math.PI) / 180));
  const zoneFeat = turfPolygon(zone.geom.coordinates);
  const full = cellM * cellM;

  let pieces: Piece[] = [];
  for (let i = 0; w + i * dLng < e; i++) {
    for (let j = 0; s + j * dLat < n; j++) {
      const x0 = w + i * dLng;
      const y0 = s + j * dLat;
      const cell = turfPolygon([[[x0, y0], [x0 + dLng, y0], [x0 + dLng, y0 + dLat], [x0, y0 + dLat], [x0, y0]]]);
      const clipped = intersect(featureCollection([cell, zoneFeat]));
      for (const g of polygonsOf(clipped?.geometry)) {
        const a = area(g);
        if (a > full * 0.005) pieces.push({ geom: g, area: a, cells: new Set([`${i},${j}`]) });
      }
    }
  }

  // Merge slivers into a touching neighbor (the smallest one that is not itself a sliver, so sizes stay even).
  for (let guard = 0; guard < 500; guard++) {
    const slivers = pieces.filter((p) => p.area < full * SLIVER_SHARE).sort((a, b) => a.area - b.area);
    let merged = false;
    for (const sl of slivers) {
      const near = pieces
        .filter((p) => p !== sl && touching(sl, p))
        .sort((a, b) => Number(a.area < full * SLIVER_SHARE) - Number(b.area < full * SLIVER_SHARE) || a.area - b.area);
      for (const nb of near) {
        const u = union(featureCollection([turfPolygon(nb.geom.coordinates), turfPolygon(sl.geom.coordinates)]));
        if (u?.geometry.type !== "Polygon") continue; // touching only at a corner: try another neighbor
        nb.geom = u.geometry;
        nb.area = area(u.geometry);
        for (const c of sl.cells) nb.cells.add(c);
        pieces = pieces.filter((p) => p !== sl);
        merged = true;
        break;
      }
      if (merged) break;
    }
    if (!merged) break;
  }

  const totalArea = pieces.reduce((t, p) => t + p.area, 0) || 1;
  const residents = households.filter((h) => h.zone_id === zone.id && (h.role === "resident" || h.role === "staff"));
  const code = shortCode(zone.id);
  const ranked = pieces
    .map((p) => {
      const c = centroid(p.geom).geometry.coordinates as [number, number];
      // A concave block's centroid can fall outside it: label it at a point on the block instead.
      const inside = pointInPolygon(c[0], c[1], p.geom) ? c : (pointOnFeature(p.geom).geometry.coordinates as [number, number]);
      return { p, c: [round5(inside[0]), round5(inside[1])] as [number, number], d: edgeDistanceM(c[0], c[1], zone.geom, zone.hazard_origin) };
    })
    .sort((a, b) => a.d - b.d || a.c[0] - b.c[0] || a.c[1] - b.c[1]);

  return ranked.map(({ p, c, d }, i) => {
    const people = zone.population_est
      ? (zone.population_est * p.area) / totalArea
      : residents.filter((h) => pointInPolygon(h.lng, h.lat, p.geom)).length * PEOPLE_PER_HOUSEHOLD;
    const people_est = Math.max(10, roundTo(people, 10));
    return {
      id: `${code}-${String(i + 1).padStart(2, "0")}`,
      zone_id: zone.id,
      geom: cleanPolygon(p.geom),
      centroid: c,
      hazard_m: Math.round(d),
      area_km2: +(p.area / 1e6).toFixed(2),
      households: residents.filter((h) => pointInPolygon(h.lng, h.lat, p.geom)).length,
      people_est,
      vehicles_est: Math.max(10, roundTo((people_est / PEOPLE_PER_HOUSEHOLD) * CARS_PER_HOUSEHOLD, 10)),
      route_id: "",
      wave: 0,
      status: "ready" as BlockStatus,
      pulled_forward: null,
    };
  });
}

// ---------- roads ----------

/** Meters from a point to a road's polyline. */
export function routeDistanceM(route: EvacRoute, at: [number, number]): number {
  if (route.line.length < 2) return Infinity;
  return pointToLineDistance(point(at), lineString(route.line), { units: "kilometers" }) * 1000;
}

/** The roads a block may take: its nearest, and any within ROUTE_REACH_M of that, nearest first. */
export function candidateRoutes(block: EvacBlock, routes: EvacRoute[]): EvacRoute[] {
  const ranked = routes.map((r) => ({ r, d: routeDistanceM(r, block.centroid) })).sort((a, b) => a.d - b.d);
  if (!ranked.length) return [];
  return ranked.filter((x) => x.d <= ranked[0].d + ROUTE_REACH_M).map((x) => x.r);
}

/** Cars a road can carry in one wave of `minutes`. */
export const capPerWave = (route: EvacRoute, minutes: number) => Math.floor((route.capacity_vph * minutes) / 60);

/**
 * The wave length to use: the requested one, raised (in 5-minute steps, up to 60) until every block fits one of its
 * roads in a single empty wave. Otherwise one block would put more cars on a road than it carries in a wave.
 */
export function fitWaveMinutes(blocks: EvacBlock[], routes: EvacRoute[], requested = DEFAULT_WAVE_MINUTES): number {
  let need = Math.max(WAVE_STEP_MINUTES, requested);
  for (const b of blocks) {
    const best = Math.max(0, ...candidateRoutes(b, routes).map((r) => r.capacity_vph));
    if (!best) continue;
    need = Math.max(need, Math.ceil(((b.vehicles_est / best) * 60) / WAVE_STEP_MINUTES) * WAVE_STEP_MINUTES);
  }
  return Math.min(MAX_WAVE_MINUTES, need);
}

/**
 * Pack blocks (already in hazard order) into waves from `startWave`. `preload` carries cars already planned on each
 * road per wave (blocks that keep their wave). Mutates and returns the blocks.
 */
export function packWaves(
  blocks: EvacBlock[],
  routes: EvacRoute[],
  minutes: number,
  startWave = 1,
  preload: Map<number, Record<string, number>> = new Map(),
): EvacBlock[] {
  const load = new Map([...preload].map(([w, l]) => [w, { ...l }]));
  // Nearest to the hazard first, on every road: a block never goes before a nearer block on the same road. Blocks are
  // placed in hazard order and each takes the earliest wave any of its roads has room for, so no block ever waits
  // because of a farther one (a farther block on another, emptier road may go sooner: it takes nobody's place).
  const lastOn = new Map<string, number>();
  for (const b of blocks) {
    const cands = candidateRoutes(b, routes);
    if (!cands.length) {
      b.route_id = "";
      b.wave = startWave;
      continue;
    }
    let best: { r: EvacRoute; w: number } | null = null;
    // Roads this block fits in one wave. Only a block too big for all of them (past the 60-minute cap) goes alone on one.
    const fits = cands.filter((r) => b.vehicles_est <= capPerWave(r, minutes));
    const usable = fits.length ? fits : [...cands].sort((x, y) => y.capacity_vph - x.capacity_vph).slice(0, 1);
    for (const r of usable) {
      const cap = capPerWave(r, minutes);
      for (let w = Math.max(startWave, lastOn.get(r.id) ?? startWave); w < startWave + 1000; w++) {
        const used = load.get(w)?.[r.id] ?? 0;
        if (used + b.vehicles_est <= cap || (!fits.length && used === 0)) {
          if (!best || w < best.w) best = { r, w };
          break;
        }
      }
    }
    const { r, w } = best!;
    b.route_id = r.id;
    b.wave = w;
    const l = load.get(w) ?? {};
    l[r.id] = (l[r.id] ?? 0) + b.vehicles_est;
    load.set(w, l);
    lastOn.set(r.id, w);
  }
  return blocks;
}

// ---------- plan state ----------

export const waveCount = (plan: Pick<EvacPlan, "blocks">) => Math.max(0, ...plan.blocks.map((b) => b.wave));

/** A block's status from the plan's clock. */
export function statusFor(plan: Pick<EvacPlan, "status" | "current_wave" | "held">, block: Pick<EvacBlock, "wave">): BlockStatus {
  if (plan.status === "all_go") return block.wave < plan.current_wave ? "left" : "go_now";
  if (plan.status !== "active") return "ready";
  if (block.wave < plan.current_wave) return "left";
  if (block.wave === plan.current_wave) return "go_now";
  if (block.wave === plan.current_wave + 1) return plan.held ? "hold" : "next";
  return "ready";
}

/** Cars per road per wave, from the blocks. */
export function loads(plan: Pick<EvacPlan, "blocks">): Map<number, Record<string, number>> {
  const out = new Map<number, Record<string, number>>();
  for (const b of plan.blocks) {
    if (!b.route_id || !b.wave) continue;
    const l = out.get(b.wave) ?? {};
    l[b.route_id] = (l[b.route_id] ?? 0) + b.vehicles_est;
    out.set(b.wave, l);
  }
  return out;
}

/**
 * Statuses, wave loads and wave times, recomputed from the blocks and the clock. Waves already started keep their
 * start time; later ones are planned at the current wave's start plus whole waves (or from `now` before the plan runs).
 */
export function refresh(plan: EvacPlan, now = new Date().toISOString()): EvacPlan {
  const blocks = plan.blocks.map((b) => ({ ...b, status: statusFor(plan, b) }));
  const l = loads({ blocks });
  const total = waveCount({ blocks });
  const step = plan.wave_minutes * 60_000;
  const running = (plan.status === "active" || plan.status === "all_go") && plan.wave_started_at && plan.current_wave > 0;
  const anchor = running ? Date.parse(plan.wave_started_at!) : Date.parse(now);
  const anchorWave = running ? plan.current_wave : 1;
  const prev = new Map(plan.waves.map((w) => [w.n, w]));
  const waves: EvacWave[] = [];
  for (let n = 1; n <= total; n++) {
    const old = prev.get(n);
    const clock = new Date(anchor + (n - anchorWave) * step).toISOString();
    let started: string | null = null;
    if (running && n === plan.current_wave) started = plan.wave_started_at;
    else if (running && n < plan.current_wave) started = old?.started_at ?? clock;
    waves.push({ n, planned_at: started ?? clock, started_at: started, load: l.get(n) ?? {} });
  }
  return { ...plan, blocks, waves };
}

/** Move blocks up to "go now" (active plan) or to wave 1 (before it runs), then reflow every wave not yet started. */
export function pullForward(plan: EvacPlan, blockIds: string[], why: string, now = new Date().toISOString()): { plan: EvacPlan; moved: string[] } {
  const running = plan.status === "active" || plan.status === "all_go";
  const target = running ? Math.max(1, plan.current_wave) : 1;
  const ids = new Set(blockIds);
  const moved: string[] = [];
  const blocks = plan.blocks.map((b) => {
    if (!ids.has(b.id) || b.wave <= target) return { ...b };
    moved.push(b.id);
    return { ...b, wave: target, pulled_forward: why };
  });
  if (!moved.length) return { plan, moved };
  // Fixed: waves already started (and the pulled blocks in the target wave). Everything later is packed again.
  const fixedUpTo = running ? plan.current_wave : 0;
  const fixed = blocks.filter((b) => b.wave <= fixedUpTo || (ids.has(b.id) && b.wave === target));
  const rest = blocks.filter((b) => !fixed.includes(b)).sort((a, b) => a.hazard_m - b.hazard_m || a.id.localeCompare(b.id));
  packWaves(rest, plan.routes, plan.wave_minutes, running ? plan.current_wave + 1 : 1, loads({ blocks: fixed }));
  const byId = new Map([...fixed, ...rest].map((b) => [b.id, b]));
  const next = refresh({ ...plan, blocks: plan.blocks.map((b) => byId.get(b.id)!), updated_at: now }, now);
  return { plan: next, moved };
}

/** A fresh plan for a zone (status "proposed": a named human approves it). */
export function buildPlan(o: {
  zone: Zone;
  households: Household[];
  routes: EvacRoute[];
  proposed_by: string;
  wave_minutes?: number;
  at?: string;
  id?: string;
}): EvacPlan {
  const at = o.at ?? new Date().toISOString();
  const blocks = makeBlocks(o.zone, o.households);
  const minutes = fitWaveMinutes(blocks, o.routes, o.wave_minutes ?? DEFAULT_WAVE_MINUTES);
  packWaves(blocks, o.routes, minutes, 1);
  return refresh(
    {
      id: o.id ?? crypto.randomUUID(),
      zone_id: o.zone.id,
      status: "proposed",
      wave_minutes: minutes,
      current_wave: 0,
      wave_started_at: null,
      held: false,
      held_by: null,
      held_reason: null,
      routes: o.routes,
      blocks,
      waves: [],
      templates: { ...DEFAULT_TEMPLATES },
      assumptions: ASSUMPTIONS,
      proposed_by: o.proposed_by,
      approved_by: null,
      approved_at: null,
      reason: null,
      created_at: at,
      updated_at: at,
    },
    at,
  );
}

// ---------- what a block hears ----------

/** The block a point is in (else the nearest block, for a point on the zone's edge). */
export function blockAt(plan: Pick<EvacPlan, "blocks">, lng: number, lat: number): EvacBlock | null {
  const inside = plan.blocks.find((b) => pointInPolygon(lng, lat, b.geom));
  if (inside) return inside;
  let best: EvacBlock | null = null;
  let bestD = Infinity;
  for (const b of plan.blocks) {
    const d = (b.centroid[0] - lng) ** 2 + (b.centroid[1] - lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

export function clockTime(iso: string, timeZone = "America/Los_Angeles"): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
}

export type BlockMessageKind = "go_now" | "get_ready" | "all_go";

/** Which approved message a block's residents hear right now. */
export function messageKind(plan: EvacPlan, block: EvacBlock): BlockMessageKind {
  if (plan.status === "all_go") return "all_go";
  return statusFor(plan, block) === "go_now" ? "go_now" : "get_ready";
}

/** The approved template filled from the approved plan: the exact words the agent reads as the route line. */
export function blockMessage(plan: EvacPlan, block: EvacBlock, zone: Pick<Zone, "name" | "evac_point">, kind = messageKind(plan, block), timeZone?: string): string {
  const route = plan.routes.find((r) => r.id === block.route_id);
  const wave = plan.waves.find((w) => w.n === block.wave);
  return fillBlockTemplate(plan.templates[kind], {
    block: block.id,
    wave: block.wave,
    time: wave ? clockTime(wave.planned_at, timeZone) : "later",
    route: route?.name ?? "the nearest open road away from the fire",
    evac_point: zone.evac_point,
    zone: zone.name,
  });
}

/** Wave 1 (or the wave going now): the people the plan moves first. For the hold's dose preview. */
export function firstWave(plan: EvacPlan): { wave: number; blocks: number; people: number; vehicles: number } {
  const wave = plan.status === "active" || plan.status === "all_go" ? Math.max(1, plan.current_wave) : 1;
  const mine = plan.status === "all_go" ? plan.blocks.filter((b) => b.wave >= wave) : plan.blocks.filter((b) => b.wave === wave);
  return {
    wave,
    blocks: mine.length,
    people: mine.reduce((t, b) => t + b.people_est, 0),
    vehicles: mine.reduce((t, b) => t + b.vehicles_est, 0),
  };
}

/** Roads over capacity in any wave (only possible after a pull-forward, which always wins over the road's limit). */
export function overloads(plan: EvacPlan): { wave: number; route_id: string; cars: number; cap: number }[] {
  const out: { wave: number; route_id: string; cars: number; cap: number }[] = [];
  for (const w of plan.waves) {
    for (const [route_id, cars] of Object.entries(w.load)) {
      const r = plan.routes.find((x) => x.id === route_id);
      if (r && cars > capPerWave(r, plan.wave_minutes)) out.push({ wave: w.n, route_id, cars, cap: capPerWave(r, plan.wave_minutes) });
    }
  }
  return out;
}
