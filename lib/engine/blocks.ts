// Block-by-block evacuation (PRD: "the gentlest response that still works"). Pure functions: no database, safe on
// the server, in the browser and in scripts. lib/engine/plans.ts stores plans and runs the wave clock.
//
// 1. Blocks: a square grid of patches about half a mile (800 m) on a side, clipped to the zone polygon; slivers
//    under 15% of a cell merge into a neighbor. A patch with more cars than its best road carries in one wave is cut
//    into equal strips, so the wave length stays short. Ids are the zone's short code plus a rank from the hazard edge
//    (SM-01 is nearest), using the same distance the edge-first call sweep uses.
// 2. Waves: blocks are placed nearest-to-hazard first. Each takes the earliest wave on an exit road with room
//    (roads within 4 km of its nearest one), no road gets more cars in a wave than it carries in the wave's length
//    (less the cars another zone's running plan puts on the same street then), and on every road a nearer block never
//    goes after a farther one. So no block ever waits because of a farther block. Several patches go in each wave.
// 3. Safety: the fire model (or a person) can pull a block forward to "go now" at any time and later waves reflow;
//    "Everyone go now" is always one click; the zone's legal Order is untouched. The plan only orders calls and route advice.
import {
  area, bbox, centroid, featureCollection, intersect, lineString, point, pointOnFeature, pointToLineDistance, polygon as turfPolygon, union,
} from "@turf/turf";
import { BLOCK_TEMPLATES, fillBlockTemplate } from "@/lib/directives";
import { edgeDistanceM, pointInPolygon } from "@/lib/geo";
import type { BlockStatus, EvacBlock, EvacPlan, EvacRoute, EvacTemplates, EvacWave, Household, Zone } from "@/lib/types";

/** Grid cell side: about 800 m (half a mile). */
export const CELL_M = 800;
/** A clipped cell smaller than this share of a full cell merges into a neighbor. */
export const SLIVER_SHARE = 0.15;
/** Planning assumptions (shown on screen with every number they produce). */
export const PEOPLE_PER_HOUSEHOLD = 2.5;
export const CARS_PER_HOUSEHOLD = 1;
/** Cars per outbound lane per hour on an exit road: half the HCM base saturation flow (1,900 per lane per hour of green). */
export const PER_LANE_VPH = 950;
export const DEFAULT_WAVE_MINUTES = 15;
const WAVE_STEP_MINUTES = 5;
const MAX_WAVE_MINUTES = 60;
/** A block may take a road up to this much farther than its nearest one when the nearest is full. */
const ROUTE_REACH_M = 4000;
/** A patch is cut into at most this many strips to fit one wave on its road. */
const MAX_SPLIT = 6;

export const ASSUMPTIONS =
  `Planning assumptions, not counts: ${PEOPLE_PER_HOUSEHOLD} people and ${CARS_PER_HOUSEHOLD} car per household ` +
  "(the US average household is about 2.5 people, Census Bureau); people are shared out by area from the zone's population estimate. " +
  `Road capacity: ${PER_LANE_VPH} cars per outbound lane per hour, half the Highway Capacity Manual's base saturation flow ` +
  "of 1,900 per lane per hour of green (FHWA HPMS Field Manual), as at a signal; lane counts from OpenStreetMap.";

/** The words approved with a plan. extra_time and get_ready_directive came later: plans stored before them use the defaults. */
export type PlanTemplates = EvacTemplates & { extra_time?: string; get_ready_directive?: string };
export type TemplateKey = keyof Required<PlanTemplates>;
export const TEMPLATE_KEYS: TemplateKey[] = ["go_now", "get_ready", "get_ready_directive", "extra_time", "all_go"];
export const DEFAULT_TEMPLATES: Required<PlanTemplates> = { ...BLOCK_TEMPLATES };

/** A plan's approved words, with the defaults for any it was stored without. */
export function templatesOf(plan: Pick<EvacPlan, "templates">): Required<PlanTemplates> {
  return { ...DEFAULT_TEMPLATES, ...(plan.templates as PlanTemplates) };
}

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

/**
 * A polygon cut into k patches of equal area, near-square: columns across its longer side, each cut into 1 or 2
 * patches (k = 2: 2x1, 3: 2+1, 4: 2x2, 5: 2+2+1, 6: 2x2x2). Cut by area, so each patch holds the same share of people.
 */
function splitEqual(geom: GeoJSON.Polygon, k: number, cellM: number): GeoJSON.Polygon[] {
  const cols = Math.ceil(k / 2);
  const counts = Array.from({ length: cols }, (_, i) => (i < k - cols ? 2 : 1));
  const [w, s, e, n] = bbox(geom);
  const wide = (e - w) * Math.cos((((s + n) / 2) * Math.PI) / 180) >= n - s;
  const columns = stripsOf(geom, counts, wide, cellM);
  return columns.flatMap((parts, i) => {
    // A column that came out in several parts (a concave zone edge): its largest part is cut, the rest stay whole.
    const big = [...parts].sort((a, b) => area(b) - area(a))[0];
    return parts.flatMap((g) => (g === big && counts[i] > 1 ? stripsOf(g, Array(counts[i]).fill(1), cols === 1 ? wide : !wide, cellM).flat() : [g]));
  });
}

/** A polygon cut into strips side by side (west to east when wide, else south to north), with areas in the ratio of the weights. */
function stripsOf(geom: GeoJSON.Polygon, weights: number[], wide: boolean, cellM: number): GeoJSON.Polygon[][] {
  if (weights.length <= 1) return [[geom]];
  const [w, s, e, n] = bbox(geom);
  const feat = turfPolygon(geom.coordinates);
  const total = area(geom);
  const sum = weights.reduce((t, x) => t + x, 0);
  const pad = 1e-6;
  const slab = (a: number, b: number) => {
    const r = wide
      ? [[a, s - pad], [b, s - pad], [b, n + pad], [a, n + pad], [a, s - pad]]
      : [[w - pad, a], [e + pad, a], [e + pad, b], [w - pad, b], [w - pad, a]];
    return intersect(featureCollection([turfPolygon([r]), feat]));
  };
  const [lo0, hi0] = wide ? [w - pad, e + pad] : [s - pad, n + pad];
  const cuts = [lo0];
  let acc = 0;
  for (let i = 1; i < weights.length; i++) {
    acc += weights[i - 1];
    let lo = cuts[i - 1];
    let hi = hi0;
    for (let it = 0; it < 16; it++) {
      const mid = (lo + hi) / 2;
      const got = slab(lo0, mid);
      if ((got ? area(got) : 0) < (total * acc) / sum) lo = mid;
      else hi = mid;
    }
    cuts.push((lo + hi) / 2);
  }
  cuts.push(hi0);
  return weights.map((_, i) => polygonsOf(slab(cuts[i], cuts[i + 1])?.geometry).filter((g) => area(g) > cellM * cellM * 0.005));
}

/**
 * The zone's polygon cut into evacuation blocks (no plan data yet: route, wave and status come from planWaves).
 * With `maxCarsAt` (max: the most cars one wave carries on every road near a point; fill: on its nearest road), a patch
 * with more cars than max is cut into equal patches, so one big patch on a narrow road never stretches every wave.
 */
export function makeBlocks(
  zone: Zone, households: Household[], cellM = CELL_M, maxCarsAt?: (at: [number, number]) => { max: number; fill: number },
): EvacBlock[] {
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

  const residents = households.filter((h) => h.zone_id === zone.id && (h.role === "resident" || h.role === "staff"));
  if (maxCarsAt) {
    // People are shared by area, so equal strips carry equal cars. 8 cars leave room for rounding the estimates.
    const zoneArea = pieces.reduce((t, p) => t + p.area, 0) || 1;
    const carsIn = (p: Piece) =>
      (zone.population_est
        ? (zone.population_est * p.area) / zoneArea / PEOPLE_PER_HOUSEHOLD
        : residents.filter((h) => pointInPolygon(h.lng, h.lat, p.geom)).length) * CARS_PER_HOUSEHOLD;
    pieces = pieces.flatMap((p) => {
      const { max, fill } = maxCarsAt(centroid(p.geom).geometry.coordinates as [number, number]);
      const cars = carsIn(p);
      const least = Math.min(MAX_SPLIT, Math.ceil(cars / Math.max(1, max - 8)));
      // A big patch (over half a wave on its nearest road): of the counts that fit, the one whose patches fill a wave on
      // that road best (each more cut must gain 5%).
      const fillShare = (k: number) => {
        const each = cars / k + 8;
        return fill > 0 && each <= fill ? (Math.floor(fill / each) * each) / fill : 0;
      };
      let k = least;
      if (cars > fill / 2) for (let more = least + 1; more <= Math.min(MAX_SPLIT, least + 2); more++) if (fillShare(more) > fillShare(k) + 0.05) k = more;
      if (!(k > 1)) return [p];
      return splitEqual(p.geom, k, cellM).map((g) => ({ geom: g, area: area(g), cells: p.cells }));
    });
  }

  const totalArea = pieces.reduce((t, p) => t + p.area, 0) || 1;
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

/** The roads a point may take: its nearest, and any within ROUTE_REACH_M of that, nearest first. */
function routesNear(at: [number, number], routes: EvacRoute[]): EvacRoute[] {
  const ranked = routes.map((r) => ({ r, d: routeDistanceM(r, at) })).sort((a, b) => a.d - b.d);
  if (!ranked.length) return [];
  return ranked.filter((x) => x.d <= ranked[0].d + ROUTE_REACH_M).map((x) => x.r);
}

/** The roads a block may take: its nearest, and any within ROUTE_REACH_M of that, nearest first. */
export function candidateRoutes(block: EvacBlock, routes: EvacRoute[]): EvacRoute[] {
  return routesNear(block.centroid, routes);
}

/** Cars a road can carry in one wave of `minutes`. */
export const capPerWave = (route: EvacRoute, minutes: number) => Math.floor((route.capacity_vph * minutes) / 60);

/**
 * The street a route runs on. Zones next to each other can share one (Lincoln Blvd and Centinela Ave on the Westside,
 * Avenida Pico in San Clemente): the plans then share its room. Keyed by the street's short name.
 */
export const roadKey = (route: Pick<EvacRoute, "short">) => route.short.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

type Loads = Map<number, Record<string, number>>;

function addLoads(a: Loads, b: Loads): Loads {
  const out: Loads = new Map([...a].map(([w, l]) => [w, { ...l }]));
  for (const [w, l] of b) {
    const t = out.get(w) ?? {};
    for (const [k, v] of Object.entries(l)) t[k] = (t[k] ?? 0) + v;
    out.set(w, t);
  }
  return out;
}

/**
 * Cars other zones' running plans put on this plan's streets during each of its waves, keyed by this plan's route ids.
 * Wave `fromWave` starts at `startMs`; each later wave `minutes` after. A wave of another plan spreads its cars evenly
 * over its own length (everyone-go-now puts all its remaining cars in the wave going now).
 */
export function sharedLoads(
  routes: EvacRoute[], minutes: number, startMs: number, fromWave: number, others: EvacPlan[], zoneId?: string,
): Loads {
  const out: Loads = new Map();
  const step = minutes * 60_000;
  for (const q of others) {
    if (q.zone_id === zoneId || (q.status !== "active" && q.status !== "all_go")) continue;
    const qStep = q.wave_minutes * 60_000;
    const mine = new Map<string, string>(); // q route id -> this plan's route id on the same street
    for (const r of q.routes) {
      const same = routes.find((x) => roadKey(x) === roadKey(r));
      if (same) mine.set(r.id, same.id);
    }
    if (!mine.size) continue;
    const allGo = q.status === "all_go";
    for (const w of refresh(q).waves) {
      if (q.status === "active" && w.n < q.current_wave) continue;
      const t0 = allGo || w.n === q.current_wave ? Date.parse(q.wave_started_at ?? w.planned_at) : Date.parse(w.planned_at);
      const t1 = t0 + qStep;
      for (const [qid, cars] of Object.entries(w.load)) {
        const rid = mine.get(qid);
        if (!rid || !cars) continue;
        const first = Math.max(fromWave, fromWave + Math.floor((t0 - startMs) / step));
        for (let n = first; ; n++) {
          const s = startMs + (n - fromWave) * step;
          if (s >= t1) break;
          const overlap = Math.min(t1, s + step) - Math.max(t0, s);
          if (overlap <= 0) continue;
          const l = out.get(n) ?? {};
          l[rid] = (l[rid] ?? 0) + Math.ceil((cars * overlap) / qStep);
          out.set(n, l);
        }
      }
    }
  }
  return out;
}

/** Streets this plan shares with another zone's plan in use: the street, and the zones whose plans also use it. */
export function sharedRoads(plan: Pick<EvacPlan, "zone_id" | "routes">, others: Pick<EvacPlan, "zone_id" | "routes" | "status">[]): { route: EvacRoute; zones: string[] }[] {
  return plan.routes
    .map((route) => ({
      route,
      zones: others
        .filter((q) => q.zone_id !== plan.zone_id && (q.status === "active" || q.status === "all_go") && q.routes.some((r) => roadKey(r) === roadKey(route)))
        .map((q) => q.zone_id),
    }))
    .filter((x) => x.zones.length);
}

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
export function pullForward(
  plan: EvacPlan, blockIds: string[], why: string, now = new Date().toISOString(), others: EvacPlan[] = [],
): { plan: EvacPlan; moved: string[] } {
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
  const from = running ? plan.current_wave + 1 : 1;
  const step = plan.wave_minutes * 60_000;
  const fromMs = running && plan.wave_started_at ? Date.parse(plan.wave_started_at) + step : Date.parse(now);
  const shared = sharedLoads(plan.routes, plan.wave_minutes, fromMs, from, others, plan.zone_id);
  packWaves(rest, plan.routes, plan.wave_minutes, from, addLoads(loads({ blocks: fixed }), shared));
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
  /** Other zones' plans in use: cars their running waves put on the same streets are counted (wave 1 starts at `at`). */
  others?: EvacPlan[];
}): EvacPlan {
  const at = o.at ?? new Date().toISOString();
  const requested = Math.min(MAX_WAVE_MINUTES, Math.max(WAVE_STEP_MINUTES, o.wave_minutes ?? DEFAULT_WAVE_MINUTES));
  // Patches too big for one wave on their best road are cut first, so the wave length stays as asked.
  const blocks = makeBlocks(o.zone, o.households, CELL_M, (c) => {
    const near = routesNear(c, o.routes).map((r) => r.capacity_vph);
    if (!near.length) return { max: Infinity, fill: 0 };
    return { max: (Math.min(...near) * requested) / 60, fill: (near[0] * requested) / 60 };
  });
  const minutes = fitWaveMinutes(blocks, o.routes, requested);
  packWaves(blocks, o.routes, minutes, 1, sharedLoads(o.routes, minutes, Date.parse(at), 1, o.others ?? [], o.zone.id));
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

export type BlockMessageKind = "go_now" | "get_ready" | "all_go" | "extra_time";

/**
 * Which approved message a block's residents hear right now. `extraTime`: the household needs extra time to leave
 * (access and functional needs, or an open help row). They never wait for a wave: a few cars barely change a road's load.
 */
export function messageKind(plan: EvacPlan, block: EvacBlock, extraTime = false): BlockMessageKind {
  if (plan.status === "all_go") return "all_go";
  if (statusFor(plan, block) === "go_now") return "go_now";
  return extraTime && plan.status === "active" ? "extra_time" : "get_ready";
}

function fillFor(plan: EvacPlan, block: EvacBlock, zone: Pick<Zone, "name" | "evac_point">, template: string, timeZone?: string): string {
  const route = plan.routes.find((r) => r.id === block.route_id);
  const wave = plan.waves.find((w) => w.n === block.wave);
  return fillBlockTemplate(template, {
    block: block.id,
    wave: block.wave,
    time: wave ? clockTime(wave.planned_at, timeZone) : "later",
    route: route?.name ?? "the nearest open road away from the fire",
    evac_point: zone.evac_point,
    zone: zone.name,
  });
}

/** The approved template filled from the approved plan: the exact words the agent reads as the route line. */
export function blockMessage(plan: EvacPlan, block: EvacBlock, zone: Pick<Zone, "name" | "evac_point">, kind = messageKind(plan, block), timeZone?: string): string {
  return fillFor(plan, block, zone, templatesOf(plan)[kind], timeZone);
}

/**
 * Both texts a call reads under a running plan. A block still waiting hears the approved get-ready directive in place
 * of the zone's Order text (an Order covers the zone; the block leaves in its wave; leave at once if unsafe), so one
 * call never says "leave now" and "wait for your wave" together. Everyone else hears the zone's own Order.
 */
export function blockWords(
  plan: EvacPlan, block: EvacBlock, zone: Pick<Zone, "name" | "evac_point" | "directive_text">, kind = messageKind(plan, block), timeZone?: string,
): { kind: BlockMessageKind; directive_text: string; move_text: string } {
  return {
    kind,
    directive_text: kind === "get_ready" ? fillFor(plan, block, zone, templatesOf(plan).get_ready_directive, timeZone) : (zone.directive_text ?? ""),
    move_text: blockMessage(plan, block, zone, kind, timeZone),
  };
}

/**
 * When the wave clock ends a hold on the next wave: one wave length after that wave was due (a hold delays a wave by
 * one wave length at most, so a forgotten hold never keeps later waves waiting). Null when nothing is held.
 */
export function holdReleaseAt(plan: Pick<EvacPlan, "held" | "wave_started_at" | "wave_minutes">): number | null {
  if (!plan.held || !plan.wave_started_at) return null;
  return Date.parse(plan.wave_started_at) + 2 * plan.wave_minutes * 60_000;
}

/** Minutes from the plan's start to the start of its last wave. */
export const lastWaveStartMin = (plan: Pick<EvacPlan, "blocks" | "wave_minutes">) => Math.max(0, waveCount(plan) - 1) * plan.wave_minutes;

/** Hours the roads need at full capacity for every car in the plan: no plan can clear faster. */
export function roadFloorH(plan: Pick<EvacPlan, "blocks" | "routes">): number {
  const cap = plan.routes.reduce((t, r) => t + r.capacity_vph, 0);
  return cap ? plan.blocks.reduce((t, b) => t + b.vehicles_est, 0) / cap : 0;
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
