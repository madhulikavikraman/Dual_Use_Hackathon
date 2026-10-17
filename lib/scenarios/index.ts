import { directiveFor } from "@/lib/directives";
import type { Mode, Scenario, Zone, ZoneState } from "@/lib/types";
import { ALTADENA_PRESETS, buildAltadena } from "./altadena";
import type { MovePresets } from "./common";
import { USC_PRESETS, buildUsc } from "./usc";
import { WESTSIDE_PRESETS, buildWestside, type ScenarioBuild } from "./westside";

export { COUNTYWIDE_POLYGON, COUNTYWIDE_POPULATION } from "./westside";
export type { ScenarioBuild } from "./westside";

export const SCENARIOS: { id: Scenario; label: string; mode: Mode }[] = [
  { id: "westside", label: "Westside Fire (LA)", mode: "civilian" },
  { id: "usc", label: "USC DPS (ordinary Tuesday)", mode: "campus" },
  { id: "altadena", label: "West Altadena (Eaton fire framing)", mode: "civilian" },
];

export function modeFor(s: Scenario): Mode {
  return SCENARIOS.find((x) => x.id === s)?.mode ?? "civilian";
}

export function buildScenario(s: Scenario, at: string, devicePhones: (string | null)[] = []): ScenarioBuild {
  if (s === "usc") return buildUsc(at, devicePhones);
  if (s === "altadena") return buildAltadena(at, devicePhones);
  return buildWestside(at, devicePhones);
}

function presetsFor(s: Scenario): MovePresets {
  return s === "usc" ? USC_PRESETS : s === "altadena" ? ALTADENA_PRESETS : WESTSIDE_PRESETS;
}

/** What the approve dialog pre-fills for a zone moving to `state` (a human still edits and approves). */
export function zoneDefaults(zone: Zone, state: ZoneState, mode: Mode) {
  const p = presetsFor(zone.scenario)[zone.id]?.[state];
  return {
    directive_text: directiveFor(state, mode, zone.name),
    move_text: p?.move_text ?? (state === zone.state ? zone.move_text ?? "" : ""),
    evac_point: p?.evac_point ?? (state === zone.state ? zone.evac_point : null),
    evac_point_lng: p?.evac ? p.evac[0] : null,
    evac_point_lat: p?.evac ? p.evac[1] : null,
  };
}
