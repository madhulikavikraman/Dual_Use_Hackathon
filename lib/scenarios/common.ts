// Shared helpers for the synthetic scenarios. Everything here is deterministic so every reset
// produces the same map. None of these people or addresses are real residents.
import { areaSqMi, centroidOf, pointInPolygon, zoneForPoint } from "@/lib/geo";
import type { Household, Need, Scenario, SimProfile, Zone, ZoneState } from "@/lib/types";

export type Lang = { language: string; lang_code: string };
export const EN: Lang = { language: "English", lang_code: "en-US" };
export const ES: Lang = { language: "Spanish", lang_code: "es-US" };
export const HY: Lang = { language: "Armenian", lang_code: "hy-AM" };
export const ZH: Lang = { language: "Chinese (Mandarin)", lang_code: "zh-CN" };
export const KO: Lang = { language: "Korean", lang_code: "ko-KR" };
export const TL: Lang = { language: "Tagalog", lang_code: "fil-PH" };
export const HI: Lang = { language: "Hindi", lang_code: "hi-IN" };
export const FR: Lang = { language: "French", lang_code: "fr-FR" };
export const LANG_BY_CODE: Record<string, Lang> = {
  "en-US": EN, "es-US": ES, "hy-AM": HY, "zh-CN": ZH, "ko-KR": KO, "fil-PH": TL, "hi-IN": HI, "fr-FR": FR,
};

/** Stable ids: device QR codes keep working across re-seeds. */
export const hid = (n: number) => `00000000-0000-4000-a000-${n.toString().padStart(12, "0")}`;

/** Mulberry32 PRNG. */
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function person(
  scenario: Scenario,
  over: Partial<Household> & Pick<Household, "id" | "name" | "lat" | "lng">,
): Household {
  return {
    address: null,
    has_device: false,
    device_label: null,
    synthetic: true,
    ...EN,
    afn_flags: [] as Need[],
    memory_note: null,
    linked_contact_household_id: null,
    linked_contact_name: null,
    can_drive_neighbors: false,
    seats: 0,
    phone_e164: null,
    role: "resident",
    channel: "voice",
    zone_id: null,
    on_post: false,
    reliability: 0.9,
    last_heard: null,
    presence_at: null,
    scenario,
    sim_profile: "leaving" as SimProfile,
    ...over,
  };
}

/** n deterministic random points inside a polygon (rejection sampling in its bounding box). */
export function pointsIn(geom: GeoJSON.Polygon, n: number, r: () => number): [number, number][] {
  const ring = geom.coordinates[0];
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
  const out: [number, number][] = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 200) {
    const x = minX + r() * (maxX - minX);
    const y = minY + r() * (maxY - minY);
    if (pointInPolygon(x, y, geom)) out.push([+x.toFixed(6), +y.toFixed(6)]);
  }
  return out;
}

/** A point part-way from a polygon vertex toward its centroid (f = 0 vertex, 1 centroid). */
export function inset(geom: GeoJSON.Polygon, vertex: number, f = 0.18): [number, number] {
  const [cx, cy] = centroidOf(geom);
  const [vx, vy] = geom.coordinates[0][vertex];
  return [+(vx + (cx - vx) * f).toFixed(6), +(vy + (cy - vy) * f).toFixed(6)];
}

export function poly(coords: [number, number][]): GeoJSON.Polygon {
  const ring = coords.map((c) => [c[0], c[1]]);
  const [a, b] = [ring[0], ring[ring.length - 1]];
  if (a[0] !== b[0] || a[1] !== b[1]) ring.push([a[0], a[1]]);
  return { type: "Polygon", coordinates: [ring] };
}

export interface ZoneSeed {
  id: string;
  name: string;
  coords: [number, number][];
  state: ZoneState;
  directive_text: string | null;
  move_text: string | null;
  evac_point: string | null;
  evac: [number, number] | null; // [lng, lat]
  fact_sheet: string | null;
  population_est: number;
  hazard_origin: [number, number] | null;
}

export function mkZones(scenario: Scenario, seeds: ZoneSeed[], approver: string, at: string): Zone[] {
  return seeds.map((s) => {
    const geom = poly(s.coords);
    return {
      id: s.id,
      name: s.name,
      scenario,
      geom,
      state: s.state,
      directive_text: s.directive_text,
      move_text: s.move_text,
      evac_point: s.evac_point,
      evac_point_lng: s.evac ? s.evac[0] : null,
      evac_point_lat: s.evac ? s.evac[1] : null,
      fact_sheet: s.fact_sheet,
      population_est: s.population_est,
      area_sq_mi: +areaSqMi(geom).toFixed(2),
      hazard_origin: s.hazard_origin,
      source: s.state === "monitor" ? "seed" : "human",
      approved_by: s.state === "monitor" ? null : approver,
      approved_at: s.state === "monitor" ? null : at,
      version: 1,
      updated_at: at,
    };
  });
}

/** Assign zone_id to every household by point-in-polygon. */
export function assignZones(households: Household[], zones: Zone[]): Household[] {
  return households.map((h) => ({ ...h, zone_id: zoneForPoint(h.lng, h.lat, zones)?.id ?? null }));
}

/** Approved move text and evacuation point per zone and state (the approve dialog's defaults). */
export type MovePresets = Record<string, Partial<Record<ZoneState, { move_text: string; evac_point: string | null; evac: [number, number] | null }>>>;
