"use client";

// Which view the supervisor board shows, whether the phone-width drawer is open, whether the sidebar is folded
// to its icon rail, and which zone the Map view details. A tiny external store, so the sidebar, the views, the
// guided tour and "Play the full fire" all switch the same state without a provider.
import { useSyncExternalStore } from "react";
import { ICON } from "./icons";

export type BoardView = "map" | "calls" | "help" | "ledger" | "feed" | "ask";

export interface ViewDef {
  id: BoardView;
  icon: string;
  label: string;
  /** What the view holds, for the nav item's tooltip. */
  hint: string;
}

export const BOARD_VIEWS: ViewDef[] = [
  { id: "map", icon: ICON.map, label: "Map", hint: "The map, the zones and the hold" },
  { id: "calls", icon: ICON.calls, label: "Calls", hint: "Live calls, waves and recent outcomes" },
  { id: "help", icon: ICON.help, label: "Help", hint: "Everyone who asked for a person" },
  { id: "ledger", icon: ICON.ledger, label: "Ledger", hint: "Every human decision and every refusal" },
  { id: "feed", icon: ICON.feed, label: "Feed", hint: "Everything the system noticed" },
  { id: "ask", icon: ICON.ask, label: "Ask", hint: "Ask the board a question" },
];

export const isBoardView = (v: string | null): v is BoardView => BOARD_VIEWS.some((d) => d.id === v);

interface ViewState {
  view: BoardView;
  drawer: boolean;
  rail: boolean;
  /** The zone the Map view details; null picks the most urgent zone. */
  zoneId: string | null;
}

const RAIL_KEY = "voiceflare.board.rail";

function readRail(): boolean {
  try {
    return window.localStorage.getItem(RAIL_KEY) === "1";
  } catch {
    return false;
  }
}

const INITIAL: ViewState = { view: "map", drawer: false, rail: false, zoneId: null };
let state: ViewState = INITIAL;
let hydrated = false;
const listeners = new Set<() => void>();

function set(patch: Partial<ViewState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  if (!hydrated) {
    hydrated = true;
    // Once per page load: the folded rail is remembered, and ?view=calls opens a view directly.
    let view: BoardView = state.view;
    try {
      const asked = new URLSearchParams(window.location.search).get("view");
      if (isBoardView(asked)) view = asked;
    } catch {
      // No URL to read: keep the Map view.
    }
    state = { ...state, rail: readRail(), view };
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBoardView(): ViewState {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}

export const getBoardView = (): BoardView => state.view;

export const getSelectedZoneId = (): string | null => state.zoneId;

export function setBoardView(view: BoardView) {
  if (state.view !== view || state.drawer) set({ view, drawer: false });
}

export function setDrawer(open: boolean) {
  if (state.drawer !== open) set({ drawer: open });
}

export function setRail(rail: boolean) {
  try {
    window.localStorage.setItem(RAIL_KEY, rail ? "1" : "0");
  } catch {
    // Storage blocked: the rail still folds, it is just not remembered.
  }
  set({ rail });
}

export function selectZone(zoneId: string | null) {
  if (state.zoneId !== zoneId) set({ zoneId });
}

/** Note the view on screen, and hand back how to return to it (the tour and autoplay put the board back). */
export function captureView(): () => void {
  const before = state.view;
  return () => setBoardView(before);
}

/** True below the width where the sidebar becomes a drawer (Tailwind's lg). */
export const isDrawerWidth = () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023.98px)").matches;

/**
 * Opens the drawer at phone and tablet width so a sidebar element can be pointed at, and hands back how to close
 * it again (only if this call opened it). Does nothing on a desktop, where the sidebar is always on screen.
 */
export function revealSidebar(): () => void {
  if (!isDrawerWidth() || state.drawer) return () => undefined;
  set({ drawer: true });
  return () => setDrawer(false);
}

// ---------- What the tour and autoplay point at ----------

/** The old side-panel tabs, as the autoplay script names them, mapped to views. */
export function viewForTab(tab: "zones" | "registry" | "feed" | "ledger"): BoardView {
  return tab === "zones" ? "map" : tab === "registry" ? "help" : tab;
}

const TARGET_VIEW: [string, BoardView][] = [
  ['[data-tour="calls"]', "calls"],
  ['[data-tour="hold"]', "map"],
  ['[data-tour="hold-actions"]', "map"],
  ['[data-tour="last-hold"]', "map"],
  ['[data-tour="compose-order"]', "map"],
  ['[data-tour="zones"]', "map"],
  ['[data-tour="zone-detail"]', "map"],
  ['[data-tour="block-plan"]', "map"],
  ['[data-tour="ask"]', "ask"],
  ['[data-tour="registry"]', "help"],
  ['[data-tour="ledger"]', "ledger"],
];

/**
 * Scrolls `el` into its own scrolling column (the view column beside the map, or the page at phone width) without
 * moving anything else. scrollIntoView also scrolls overflow-hidden ancestors, which shifts the whole board.
 */
export function scrollIntoColumn(el: Element, align: "start" | "nearest" = "nearest") {
  let box: HTMLElement | null = el.parentElement;
  while (box && box !== document.body) {
    const oy = getComputedStyle(box).overflowY;
    if ((oy === "auto" || oy === "scroll") && box.scrollHeight > box.clientHeight) break;
    box = box.parentElement;
  }
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const r = el.getBoundingClientRect();
  if (!box || box === document.body) {
    // The page itself scrolls (phone width).
    const top = align === "start" || r.top < 0 ? r.top - 8 : r.bottom > window.innerHeight ? r.bottom - window.innerHeight + 8 : 0;
    if (top) window.scrollBy({ top, behavior: smooth ? "smooth" : "auto" });
    return;
  }
  const b = box.getBoundingClientRect();
  let delta = 0;
  if (align === "start" || r.top < b.top || r.height > b.height) delta = r.top - b.top - 8;
  else if (r.bottom > b.bottom) delta = r.bottom - b.bottom + 8;
  if (delta) box.scrollBy({ top: delta, behavior: smooth ? "smooth" : "auto" });
}

/** The view a spotlight target lives in, or null when it is on screen in every view (the map, the sidebar). */
export function viewForTarget(selector: string): BoardView | null {
  return TARGET_VIEW.find(([s]) => selector.includes(s))?.[1] ?? null;
}
