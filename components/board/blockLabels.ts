// Words, colors and icons for block-by-block evacuation, shared by the map, the legend and the plan panel.
// Emoji are decorative (aria-hidden) wherever they sit next to these words.
import type { BlockStatus, EvacPlan, EvacPlanStatus } from "@/lib/types";

export const BLOCK_COLOR: Record<BlockStatus, string> = {
  go_now: "#dc2626",
  next: "#f97316",
  ready: "#eab308",
  hold: "#6366f1",
  left: "#94a3b8",
};

export const BLOCK_FILL: Record<BlockStatus, number> = {
  go_now: 0.45,
  next: 0.32,
  ready: 0.18,
  hold: 0.3,
  left: 0.3,
};

export const BLOCK_LABEL: Record<BlockStatus, string> = {
  go_now: "Go now",
  next: "Next wave",
  ready: "Get ready",
  hold: "Wave held",
  left: "Wave done",
};

export const BLOCK_EMOJI: Record<BlockStatus, string> = {
  go_now: "🏃",
  next: "⏭️",
  ready: "🎒",
  hold: "⏸️",
  left: "✅",
};

/** What each status means, for tooltips and the legend. */
export const BLOCK_HINT: Record<BlockStatus, string> = {
  go_now: "This block's wave is on: residents hear “leave now” on their road.",
  next: "The next wave: residents have heard when to go and to leave at once if unsafe.",
  ready: "A later wave: residents get ready and leave at once if they see fire or smoke.",
  hold: "A person held this wave (the wave going now keeps going). Leave-now-if-unsafe still stands.",
  left: "This block's wave window is over. Residents not confirmed out are still called: no answer is never safe.",
};

export const PLAN_STATUS_LABEL: Record<EvacPlanStatus, string> = {
  proposed: "Proposed: needs a named human",
  standby: "Approved: stands by until an Order",
  active: "Running on the wave clock",
  all_go: "Everyone go now",
  rejected: "Rejected",
  closed: "Closed",
};

export const PLAN_STATUS_EMOJI: Record<EvacPlanStatus, string> = {
  proposed: "📝",
  standby: "🕒",
  active: "🚦",
  all_go: "🚨",
  rejected: "✖️",
  closed: "🏁",
};

/** Load color for a road in one wave: calm under 80%, amber to 100%, red over (only after a pull-forward). */
export function loadColor(pct: number): string {
  return pct > 100 ? "#b91c1c" : pct > 80 ? "#ca8a04" : "#0f766e";
}

/** The wave the board shows by default: the one going now, else wave 1. */
export function shownWave(plan: Pick<EvacPlan, "status" | "current_wave">, total: number): number {
  if ((plan.status === "active" || plan.status === "all_go") && plan.current_wave >= 1) return Math.min(plan.current_wave, Math.max(1, total));
  return 1;
}

export const fmtN = (n: number) => Math.round(n).toLocaleString("en-US");
