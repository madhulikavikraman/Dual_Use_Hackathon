// One emoji per idea, shared by every board screen (the board, its dialogs and badges, /qrt). Emoji are
// decorative: whatever renders one also renders the words, or an aria-label (see lib/ui/Emoji.tsx).
// Client-safe and free of React, so labels and tests can import it too.
import { fmtPeople } from "@/lib/client/format";
import type { Need, ZoneState } from "@/lib/types";

export const ICON = {
  // The board's views
  map: "🗺️",
  calls: "📞",
  help: "🆘",
  ledger: "📜",
  feed: "📰",
  ask: "💬",
  // Things on the board
  people: "👥",
  phone: "📱",
  hazard: "🔥",
  heat: "🌡️",
  hold: "⏳",
  sentinel: "🎯",
  canary: "🐤",
  pickup: "🚐",
  location: "📍",
  navigate: "🧭",
  gps: "🛰️",
  helper: "🦺",
  senior: "🧓",
  evac: "🏁",
  model: "🤖",
  human: "👤",
  reached: "✅",
  understood: "🧠",
  cost: "💵",
  refusal: "🚫",
  alert: "📣",
  scenario: "🎬",
  qrt: "🚑",
  clock: "🕒",
  wave: "🌊",
  sim: "🧪",
  print: "🖨️",
  csv: "📄",
  menu: "☰",
} as const;

export type IconName = keyof typeof ICON;

/** Zone states on the ladder. */
export const STATE_ICON: Record<ZoneState, string> = {
  monitor: "📡",
  watch: "👀",
  warning: "⚠️",
  order: "🚨",
  shelter_in_place: "🏠",
  lifted: "✅",
};

/** Needs that have an unambiguous emoji; the rest show words only. */
export const NEED_ICON: Partial<Record<Need, string>> = {
  wheelchair: "♿",
  oxygen: "🫁",
  hearing: "🦻",
  vision: "🦯",
  children_alone: "🧒",
  powered_medical_device: "🔌",
};

/** Feed items by kind (lib/types AlertItem["kind"]); a kind added later falls back to the feed's own icon. */
export const FEED_ICON: Record<string, string> = {
  proposal: "🤖",
  cluster: "📍",
  silence_cluster: "🔇",
  dark_zone: "📵",
  canary_result: "🐤",
  hand_off: "🤝",
  needs_help: "🆘",
  hold: "⏳",
  send: "📣",
  transport: "📶",
  info: "ℹ️",
};

/** The hazard's emoji for a mode: a heat wave reads as heat, everything else as fire. */
export function hazardIcon(mode: string): string {
  return mode === "heat" ? ICON.heat : ICON.hazard;
}

/** "~118,000": the dose and zone sizes are estimates, so the short form says so with a tilde. */
export const peopleShort = (n: number) => `~${fmtPeople(n)}`;

/** "about 118,000 people": the words a screen reader hears for the short form. */
export const peopleLong = (n: number) => `about ${fmtPeople(n)} people`;
