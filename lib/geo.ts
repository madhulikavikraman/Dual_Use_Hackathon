// Geometry helpers (Turf). Pure functions, safe on server and client. Coordinates are GeoJSON [lng, lat].
import {
  area as turfArea,
  booleanPointInPolygon,
  centroid as turfCentroid,
  distance as turfDistance,
  lineString,
  point,
  pointToLineDistance,
} from "@turf/turf";

export type LngLat = [number, number];

export const SQ_M_PER_SQ_MI = 2_589_988;

export function pointInPolygon(lng: number, lat: number, geom: GeoJSON.Polygon): boolean {
  try {
    return booleanPointInPolygon(point([lng, lat]), geom);
  } catch {
    return false;
  }
}

export function areaSqMi(geom: GeoJSON.Polygon): number {
  return turfArea(geom) / SQ_M_PER_SQ_MI;
}

export function centroidOf(geom: GeoJSON.Polygon): LngLat {
  const c = turfCentroid(geom).geometry.coordinates;
  return [c[0], c[1]];
}

/** Meters between two [lng, lat] points. */
export function metersBetween(a: LngLat, b: LngLat): number {
  return turfDistance(point(a), point(b), { units: "kilometers" }) * 1000;
}

/** The first zone (smallest area wins on overlap) containing the point. */
export function zoneForPoint<Z extends { id: string; geom: GeoJSON.Polygon }>(lng: number, lat: number, zones: Z[]): Z | null {
  const hits = zones.filter((z) => pointInPolygon(lng, lat, z.geom));
  if (!hits.length) return null;
  return hits.sort((a, b) => turfArea(a.geom) - turfArea(b.geom))[0];
}

/**
 * The polygon's "hazard edge": the boundary segments nearest the hazard origin (within 400 m of the
 * nearest one). Edge-first ordering sweeps inward from this line.
 */
export function hazardEdge(geom: GeoJSON.Polygon, origin: LngLat): GeoJSON.Feature<GeoJSON.LineString>[] {
  const ring = geom.coordinates[0];
  const segs: { line: GeoJSON.Feature<GeoJSON.LineString>; d: number }[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const line = lineString([ring[i], ring[i + 1]]);
    const d = pointToLineDistance(point(origin), line, { units: "kilometers" }) * 1000;
    segs.push({ line, d });
  }
  if (!segs.length) return [];
  const min = Math.min(...segs.map((s) => s.d));
  return segs.filter((s) => s.d <= min + 400).map((s) => s.line);
}

/** Meters from a point to the polygon's hazard edge (edge-first ordering, PRD section 8.2). */
export function edgeDistanceM(lng: number, lat: number, geom: GeoJSON.Polygon, origin: LngLat | null): number {
  const o = origin ?? centroidOf(geom);
  const edge = hazardEdge(geom, o);
  if (!edge.length) return metersBetween([lng, lat], o);
  return Math.min(...edge.map((l) => pointToLineDistance(point([lng, lat]), l, { units: "kilometers" }) * 1000));
}

export const RING_M = 200;

/**
 * Sentinel selection for a hold (PRD 8.1): three at the polygon's far extremes from the hazard origin
 * (where polygon errors live), spread apart, and one or two near the hazard edge.
 */
export function pickSentinels<C extends { id: string; lat: number; lng: number }>(
  geom: GeoJSON.Polygon,
  origin: LngLat | null,
  candidates: C[],
  opts: { far?: number; near?: number } = {},
): { far: C[]; near: C[] } {
  const farN = opts.far ?? 3;
  const nearN = opts.near ?? 1;
  const o = origin ?? centroidOf(geom);
  const inside = candidates.filter((c) => pointInPolygon(c.lng, c.lat, geom));
  if (!inside.length) return { far: [], near: [] };
  const byEdge = [...inside].sort(
    (a, b) => edgeDistanceM(a.lng, a.lat, geom, o) - edgeDistanceM(b.lng, b.lat, geom, o),
  );
  const near = byEdge.slice(0, Math.min(nearN, Math.max(0, inside.length - 1)));
  const pool = inside.filter((c) => !near.includes(c));
  const far: C[] = [];
  // Greedy max-min spread, seeded by the candidate farthest from the hazard origin.
  const dFromOrigin = (c: C) => metersBetween([c.lng, c.lat], o);
  while (far.length < farN && pool.length) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      const spread = far.length ? Math.min(...far.map((f) => metersBetween([c.lng, c.lat], [f.lng, f.lat]))) : 0;
      const score = far.length ? spread + 0.25 * dFromOrigin(c) : dFromOrigin(c);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    far.push(pool.splice(best, 1)[0]);
  }
  return { far, near };
}

/**
 * Hex bin key for pattern watch: pointy-top axial hexes with a ~520 m edge (about 0.7 km^2 per cell,
 * comparable to H3 resolution 8). Returns the key and the cell center.
 */
export function hexCell(lat: number, lng: number): { key: string; lat: number; lng: number } {
  const size = 520; // meters, hex edge
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((34 * Math.PI) / 180); // LA latitude; fine for a demo region
  const x = lng * mPerDegLng;
  const y = lat * mPerDegLat;
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;
  // Cube rounding
  let rx = Math.round(q);
  let rz = Math.round(r);
  const ry = Math.round(-q - r);
  const dx = Math.abs(rx - q);
  const dy = Math.abs(ry - (-q - r));
  const dz = Math.abs(rz - r);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (!(dy > dz)) rz = -rx - ry;
  const cx = size * (Math.sqrt(3) * rx + (Math.sqrt(3) / 2) * rz);
  const cy = size * ((3 / 2) * rz);
  return { key: `h${rx}_${rz}`, lat: cy / mPerDegLat, lng: cx / mPerDegLng };
}

/** Hexagon polygon for a cell center (for feeds and the map). */
export function hexPolygon(lat: number, lng: number): GeoJSON.Polygon {
  const size = 520;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((34 * Math.PI) / 180);
  const ring: number[][] = [];
  for (let i = 0; i < 6; i++) {
    const ang = ((60 * i - 30) * Math.PI) / 180;
    ring.push([lng + (size * Math.cos(ang)) / mPerDegLng, lat + (size * Math.sin(ang)) / mPerDegLat]);
  }
  ring.push(ring[0]);
  return { type: "Polygon", coordinates: [ring] };
}

/** Compass direction from a to b, e.g. "north-west". */
export function compass(from: LngLat, to: LngLat): string {
  const dx = (to[0] - from[0]) * Math.cos((from[1] * Math.PI) / 180);
  const dy = to[1] - from[1];
  const deg = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  const names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  return names[Math.round(deg / 45) % 8];
}
