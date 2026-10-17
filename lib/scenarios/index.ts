import { directiveFor, heatDirective } from "@/lib/directives";
import { jurisdictionForScenario, localDirective } from "@/lib/jurisdictions";
import type { Mode, Scenario, Zone, ZoneState } from "@/lib/types";
import { ALTADENA_PRESETS, buildAltadena } from "./altadena";
import { CENTRAL_CHONGQING_POLYGON, CENTRAL_CHONGQING_POPULATION, CHONGQING_PRESETS, buildChongqing } from "./chongqing";
import type { MovePresets } from "./common";
import { HEAT_PRESETS, buildHeat } from "./heat";
import { NORTE_PRESETS, ORANGE_COUNTY_POLYGON, ORANGE_COUNTY_POPULATION, buildNorte } from "./norte";
import { COUNTYWIDE_POLYGON, COUNTYWIDE_POPULATION, WESTSIDE_PRESETS, buildWestside, type ScenarioBuild } from "./westside";

export { COUNTYWIDE_POLYGON, COUNTYWIDE_POPULATION } from "./westside";
export type { ScenarioBuild } from "./westside";

export const SCENARIOS: { id: Scenario; label: string; mode: Mode }[] = [
  { id: "westside", label: "Westside Fire (LA)", mode: "civilian" },
  { id: "norte", label: "Norte Fire, San Clemente (live location, Oct 2026)", mode: "civilian" },
  { id: "heat", label: "Heat wave: senior check-ins", mode: "heat" },
  { id: "altadena", label: "West Altadena (Eaton fire framing)", mode: "civilian" },
  { id: "chongqing", label: "Chongqing mountain fire (China, Twist 2)", mode: "civilian" },
];

export function modeFor(s: Scenario): Mode {
  return SCENARIOS.find((x) => x.id === s)?.mode ?? "civilian";
}

export function buildScenario(s: Scenario, at: string, devicePhones: (string | null)[] = []): ScenarioBuild {
  if (s === "heat") return buildHeat(at, devicePhones);
  if (s === "altadena") return buildAltadena(at, devicePhones);
  if (s === "chongqing") return buildChongqing(at, devicePhones);
  if (s === "norte") return buildNorte(at, devicePhones);
  return buildWestside(at, devicePhones);
}

function presetsFor(s: Scenario): MovePresets {
  return s === "heat" ? HEAT_PRESETS : s === "altadena" ? ALTADENA_PRESETS : s === "chongqing" ? CHONGQING_PRESETS : s === "norte" ? NORTE_PRESETS : WESTSIDE_PRESETS;
}

/** The deliberately wrong polygon for the hold demo (the January 9 failure, or its local equivalent). */
export function wrongPolygonFor(s: Scenario): { polygon: GeoJSON.Polygon; population: number; label: string } {
  if (s === "chongqing") return { polygon: CENTRAL_CHONGQING_POLYGON, population: CENTRAL_CHONGQING_POPULATION, label: "重庆中心城区 Central Chongqing (wrong polygon)" };
  if (s === "norte") return { polygon: ORANGE_COUNTY_POLYGON, population: ORANGE_COUNTY_POPULATION, label: "All of Orange County (wrong polygon)" };
  return { polygon: COUNTYWIDE_POLYGON, population: COUNTYWIDE_POPULATION, label: "Countywide (wrong polygon)" };
}

/** What the approve dialog pre-fills for a zone moving to `state` (a human still edits and approves). */
export function zoneDefaults(zone: Zone, state: ZoneState, mode: Mode) {
  const p = presetsFor(zone.scenario)[zone.id]?.[state];
  // Heat line: the heat message with the zone's reading (labeled when simulated) and any active NWS heat product.
  // Otherwise the jurisdiction's own vocabulary first (e.g. China's 转移指令), else the mode's (Cal OES, base).
  const local = mode === "heat" ? null : localDirective(jurisdictionForScenario(zone.scenario), state, zone.name.split(/[（( ]/)[0]);
  const directive = mode === "heat" ? heatDirective(state, zone.name, zone.weather) : local ?? directiveFor(state, mode, zone.name);
  return {
    directive_text: directive,
    move_text: p?.move_text ?? (state === zone.state ? zone.move_text ?? "" : ""),
    evac_point: p?.evac_point ?? (state === zone.state ? zone.evac_point : null),
    evac_point_lng: p?.evac ? p.evac[0] : null,
    evac_point_lat: p?.evac ? p.evac[1] : null,
  };
}
