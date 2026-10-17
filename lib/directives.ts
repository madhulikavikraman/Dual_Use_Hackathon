// Directive vocabularies. The agent reads these verbatim; a named human approves them per zone.
// Civilian: Cal OES standardized evacuation terminology (May 2020). Campus and base are the
// Tuesday and defense skins (PRD section 16).
import type { Mode, ZoneState } from "@/lib/types";

type Vocab = Record<ZoneState, (zone: string) => string>;

const CIVILIAN: Vocab = {
  monitor: () => "",
  watch: () => "Be aware. No action is required right now. We will call again if that changes.",
  warning: () =>
    "Evacuation Warning: potential threat to life and/or property. Those who require additional time to evacuate, and those with pets and livestock, should leave now.",
  order: () =>
    "Evacuation Order: immediate threat to life. This is a lawful order to leave now. The area is lawfully closed to public access.",
  shelter_in_place: () =>
    "Shelter in Place: go indoors. Shut and lock doors and windows. Prepare to self-sustain until further notice and/or contacted by emergency personnel for additional direction.",
  lifted: (zone) => `Evacuation orders for ${zone} are lifted.`,
};

const CAMPUS: Vocab = {
  monitor: () => "",
  watch: (zone) => `Be aware of police activity near ${zone}. No action is required right now.`,
  warning: (zone) => `Avoid the area: stay away from ${zone} until further notice.`,
  order: (zone) => `Leave ${zone} now by the nearest safe exit.`,
  shelter_in_place: () =>
    "Shelter in place: go into the nearest room that locks, lock or barricade the door, silence your phone, and stay away from windows.",
  lifted: (zone) => `All clear for ${zone}.`,
};

const BASE: Vocab = {
  monitor: () => "",
  watch: (zone) => `Be aware: increased security activity near ${zone}. No action is required.`,
  warning: (zone) => `Avoid the area: stay clear of ${zone} until further notice.`,
  order: (zone) => `Evacuate ${zone} now and report to your accountability point.`,
  shelter_in_place: () =>
    "Lockdown: shelter in place in the nearest secure room, lock the door, stay away from windows, and wait for the all clear.",
  lifted: (zone) => `All clear for ${zone}.`,
};

const BY_MODE: Record<Mode, Vocab> = { civilian: CIVILIAN, campus: CAMPUS, base: BASE };

export function directiveFor(state: ZoneState, mode: Mode, zoneName: string): string {
  return BY_MODE[mode][state](zoneName);
}

export const STATE_LABEL: Record<ZoneState, string> = {
  monitor: "Monitor",
  watch: "Watch",
  warning: "Near-Crisis · Evacuation Warning",
  order: "Crisis · Evacuation Order",
  shelter_in_place: "Shelter in Place",
  lifted: "Lifted",
};

export const STATE_SHORT: Record<ZoneState, string> = {
  monitor: "Monitor",
  watch: "Watch",
  warning: "Warning",
  order: "Order",
  shelter_in_place: "Shelter",
  lifted: "Lifted",
};

/** Map colors per state (PRD 6.1): grey, yellow, orange, red, purple, green. */
export const STATE_COLOR: Record<ZoneState, string> = {
  monitor: "#9ca3af",
  watch: "#eab308",
  warning: "#f97316",
  order: "#dc2626",
  shelter_in_place: "#9333ea",
  lifted: "#16a34a",
};

export const STATE_RANK: Record<ZoneState, number> = {
  monitor: 0,
  lifted: 0,
  watch: 1,
  warning: 2,
  shelter_in_place: 3,
  order: 3,
};

/** Ladder rung per state, for the board legend. */
export const STATE_RUNG: Record<ZoneState, string> = {
  monitor: "watch",
  watch: "watch, ask",
  warning: "ask, slow",
  order: "hold, hand to a person",
  shelter_in_place: "hold",
  lifted: "hand to a person",
};
