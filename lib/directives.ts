// Directive vocabularies. The agent reads these verbatim; a named human approves them per zone.
// Civilian: Cal OES standardized evacuation terminology (May 2020). Heat is the ordinary-Tuesday line (a heat
// check-in for older residents who opted in); base is the defense skin (PRD section 16).
import { NWS_HEAT_LEVEL, RANK } from "@/lib/scenarios/heatLadder";
import type { Mode, ZoneState, ZoneWeather } from "@/lib/types";

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

// Heat: the approved heat message. Without a reading it is the plain message; heatDirective() adds the zone's
// reading and any active NWS heat product. 211 is LA County's line for the nearest cooling center (lacounty.gov/heat).
const HEAT_211 = "Call 211 for the nearest cooling center.";
const HEAT_OPEN: Record<ZoneState, (zone: string) => string> = {
  monitor: () => "",
  watch: (zone) => `This is a heat check for ${zone}.`,
  warning: (zone) => `This is a heat check for ${zone}.`,
  order: (zone) => `This is an extreme heat alert for ${zone}.`,
  shelter_in_place: (zone) => `This is a heat alert for ${zone}.`,
  lifted: (zone) => `The heat check for ${zone} is over.`,
};
const HEAT_ACTION: Record<ZoneState, string> = {
  monitor: "",
  watch: "Dangerous heat may come in the next few days. We are checking on older neighbors who live alone.",
  warning: "Dangerous heat is here today. Cooling centers are open.",
  order: "The heat today is extremely dangerous. Get to a cool place now.",
  shelter_in_place: "Stay inside, in the coolest room you have, until we call again.",
  lifted: "Thank you for staying in touch.",
};

const HEAT: Vocab = {
  monitor: () => "",
  watch: (zone) => heatDirective("watch", zone, null),
  warning: (zone) => heatDirective("warning", zone, null),
  order: (zone) => heatDirective("order", zone, null),
  shelter_in_place: (zone) => heatDirective("shelter_in_place", zone, null),
  lifted: (zone) => heatDirective("lifted", zone, null),
};

/**
 * The heat message a human approves: the opening, the zone's reading (labeled when it is the demo heat wave),
 * the NWS heat product if one is active at the zone, what the level means, and 211. Read verbatim on the call.
 */
export function heatDirective(state: ZoneState, zone: string, weather: ZoneWeather | null | undefined): string {
  if (state === "monitor") return "";
  if (state === "lifted") return `${HEAT_OPEN.lifted(zone)} ${HEAT_ACTION.lifted}`;
  const parts = [HEAT_OPEN[state](zone)];
  if (weather) {
    const n = Math.round(weather.feels_like_high_f);
    parts.push(
      weather.basis === "simulated"
        ? `In the demo heat wave, it may feel like ${n} degrees here today.`
        : `It may feel like ${n} degrees here today.`,
    );
    const product = heatProduct(weather);
    if (product) parts.push(`The National Weather Service has issued ${/^[aeiou]/i.test(product) ? "an" : "a"} ${product} for this area.`);
  }
  parts.push(HEAT_ACTION[state], HEAT_211);
  return parts.join(" ");
}

/** The highest active NWS heat product at the zone, by its current name, or null. */
export function heatProduct(weather: ZoneWeather | null | undefined): string | null {
  const names = (weather?.nws ?? []).map((a) => a.event).filter((e) => e in NWS_HEAT_LEVEL);
  return names.sort((a, b) => RANK[NWS_HEAT_LEVEL[b]] - RANK[NWS_HEAT_LEVEL[a]])[0] ?? null;
}

const BASE: Vocab = {
  monitor: () => "",
  watch: (zone) => `Be aware: increased security activity near ${zone}. No action is required.`,
  warning: (zone) => `Avoid the area: stay clear of ${zone} until further notice.`,
  order: (zone) => `Evacuate ${zone} now and report to your accountability point.`,
  shelter_in_place: () =>
    "Lockdown: shelter in place in the nearest secure room, lock the door, stay away from windows, and wait for the all clear.",
  lifted: (zone) => `All clear for ${zone}.`,
};

const BY_MODE: Record<Mode, Vocab> = { civilian: CIVILIAN, heat: HEAT, base: BASE };

export function directiveFor(state: ZoneState, mode: Mode, zoneName: string): string {
  return (BY_MODE[mode] ?? CIVILIAN)[state](zoneName);
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

/** Heat line ladder, mapped onto the same stored states (rung names follow the NWS heat products; demo thresholds). */
export const HEAT_STATE_LABEL: Record<ZoneState, string> = {
  monitor: "Monitor",
  watch: "Heat watch · check on seniors alone",
  warning: "Heat Advisory · call every senior",
  order: "Extreme Heat Warning · call everyone",
  shelter_in_place: "Stay indoors · coolest room",
  lifted: "Heat over",
};

export const HEAT_STATE_SHORT: Record<ZoneState, string> = {
  monitor: "Monitor",
  watch: "Heat watch",
  warning: "Heat Advisory",
  order: "Extreme Heat",
  shelter_in_place: "Stay indoors",
  lifted: "Heat over",
};

/** Server-side wording (ledger, feed) in the run's vocabulary. */
export function stateLabelFor(state: ZoneState, mode: Mode): string {
  return mode === "heat" ? HEAT_STATE_LABEL[state] : STATE_LABEL[state];
}

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

// ---------- Block-by-block evacuation: message templates (a named human approves them with the plan) ----------
// The agent reads the filled text verbatim as the route line. {block}, {wave}, {time}, {route}, {to_evac} and {zone}
// come from the approved plan. Every "wait for your wave" message carries LEAVE_IF_UNSAFE: a plan never holds anyone back.
// A block still waiting also hears get_ready_directive in place of the zone's Order text, so one call never says both
// "leave now" and "wait for your wave". People who need extra time to leave hear extra_time: they never wait for a wave.

export const LEAVE_IF_UNSAFE = "If you see fire or smoke, or feel unsafe, leave right away. Do not wait for your wave.";

export const BLOCK_TEMPLATES = {
  go_now: "Your block, {block}, is in wave {wave}: leave now by {route}{to_evac}.",
  get_ready: `Your block, {block}, is in wave {wave}, planned for about {time}, by {route}{to_evac}. Get ready now. We will call you again when your wave starts. ${LEAVE_IF_UNSAFE}`,
  all_go: "Everyone in {zone} leaves now. Your block, {block}: leave now by {route}{to_evac}.",
  extra_time: "Your block, {block}, is in wave {wave}. People who need extra time to leave should not wait for the wave: leave now by {route}{to_evac}.",
  get_ready_directive: `Evacuation Order for {zone}: immediate threat to life. To keep the roads moving, your block leaves in wave {wave}. ${LEAVE_IF_UNSAFE}`,
} as const;

export function fillBlockTemplate(
  template: string,
  v: { block: string; wave: number | string; time: string; route: string; evac_point: string | null; zone: string },
): string {
  const to = v.evac_point ? ` to ${v.evac_point.replace(/\.$/, "")}` : "";
  return template
    .replaceAll("{block}", v.block)
    .replaceAll("{wave}", String(v.wave))
    .replaceAll("{time}", v.time)
    .replaceAll("{route}", v.route)
    .replaceAll("{to_evac}", to)
    .replaceAll("{zone}", v.zone)
    .replace(/\s+/g, " ")
    .trim();
}
