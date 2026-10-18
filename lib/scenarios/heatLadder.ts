// The heat check-in line's ladder: the demo threshold table the model proposes from, the NWS heat products it
// recognizes, and the sources behind every real-world fact the line uses. Pure data, client-safe (no imports
// beyond types), so the board and the demo console can show the same table the server used.
import type { ZoneState, ZoneWeather } from "@/lib/types";

/**
 * Demo setting, visible to the supervisor: today's forecast "feels like" high (apparent temperature, °F) at a zone's
 * centre proposes a level. These are NOT National Weather Service criteria (each NWS office sets its own); a named
 * human approves every level, as everywhere else.
 */
export const HEAT_THRESHOLDS: { state: Extract<ZoneState, "watch" | "warning" | "order">; min_f: number; label: string; does: string }[] = [
  { state: "order", min_f: 108, label: "Extreme Heat Warning", does: "Call everyone, offer rides, door knocks for no-answers" },
  { state: "warning", min_f: 100, label: "Heat Advisory", does: "Call every registered senior; cooling centers open" },
  { state: "watch", min_f: 90, label: "Heat watch", does: "Check in with seniors who live alone" },
];

export const HEAT_THRESHOLD_NOTE = "Demo setting, not NWS criteria: today's forecast feels-like high at the zone centre.";

/** The level the threshold table proposes for a feels-like high (°F). */
export function heatLevelFor(feelsLikeHighF: number): ZoneState {
  for (const t of HEAT_THRESHOLDS) if (feelsLikeHighF >= t.min_f) return t.state;
  return "monitor";
}

/**
 * NWS heat products by their current names. On March 4, 2025 the NWS renamed Excessive Heat Watch and Warning to
 * Extreme Heat Watch and Warning; Heat Advisory kept its name (https://www.weather.gov/news/250310-heat-hazard,
 * definitions at https://www.weather.gov/safety/heat-ww). An active product at a zone's centre proposes at least
 * its level.
 */
export const NWS_HEAT_LEVEL: Record<string, Extract<ZoneState, "watch" | "warning" | "order">> = {
  "Extreme Heat Warning": "order",
  "Heat Advisory": "warning",
  "Extreme Heat Watch": "watch",
};

export const RANK: Record<ZoneState, number> = { monitor: 0, lifted: 0, watch: 1, warning: 2, shelter_in_place: 3, order: 3 };

/** The higher of two proposed levels. */
export function higher(a: ZoneState, b: ZoneState): ZoneState {
  return RANK[b] > RANK[a] ? b : a;
}

/**
 * Heat-stroke warning signs, as CDC lists them ("Heat-Related Illnesses: what to look for, what to do",
 * https://www.cdc.gov/disasters/extremeheat/pdf/Heat_Related_Illness.pdf). CDC: "Call 911 right away; heat stroke is
 * a medical emergency." On the line any one of these means: hang up and call 911 now, and a person is flagged (P1).
 */
export const CDC_HEAT_STROKE_SIGNS = [
  "high body temperature (103°F or higher)",
  "hot, red, dry, or damp skin",
  "fast, strong pulse",
  "headache",
  "dizziness",
  "nausea",
  "confusion",
  "losing consciousness (passing out)",
];

export const SOURCES = {
  open_meteo: { label: "Open-Meteo forecast API", url: "https://open-meteo.com/" },
  nws_alerts: { label: "NWS active alerts (api.weather.gov)", url: "https://www.weather.gov/documentation/services-web-api" },
  nws_rename: { label: "NWS: heat product names changed March 4, 2025", url: "https://www.weather.gov/news/250310-heat-hazard" },
  cdc: { label: "CDC: heat-related illnesses", url: "https://www.cdc.gov/disasters/extremeheat/pdf/Heat_Related_Illness.pdf" },
  la_211: { label: "LA County: call 211 for the nearest cooling center", url: "https://lacounty.gov/heat" },
} as const;

/** "2:30 PM" from Open-Meteo's local timestamp ("2026-10-17T14:30", America/Los_Angeles). */
export function localClock(observedLocal: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(observedLocal);
  if (!m) return observedLocal;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** Round °F for speech and display. */
export const deg = (f: number) => `${Math.round(f)}°F`;

/** One line for a zone card: the number the ladder used, whether it is simulated, and the live reading with source and time. */
export function weatherLine(w: ZoneWeather): string {
  const used = `Feels like ${deg(w.feels_like_high_f)} today`;
  const live = w.live
    ? `live ${deg(w.live.feels_like_f)} feels like (${deg(w.live.temp_f)} air) at ${localClock(w.live.observed_local)}, Open-Meteo`
    : `live reading unavailable${w.live_error ? ` (${w.live_error})` : ""}`;
  const nws = !w.nws_checked ? "NWS not reached" : w.nws.length ? `NWS: ${w.nws.map((a) => a.event).join(", ")}` : "NWS: no active alerts";
  return w.basis === "simulated" ? `${used} (DEMO heat wave) · ${live} · ${nws}` : `${used} (live forecast) · ${live} · ${nws}`;
}
