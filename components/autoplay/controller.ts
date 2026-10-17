"use client";

// The board's autoplay, outside React: one run at a time per page, shared by the header button that opens it
// and the overlay that shows it. Starting it from a click (or once per page load for ?autoplay=1) keeps Strict
// Mode's double effects from starting two runs; leaving the board stops it and puts autopilot back.
import { useSyncExternalStore } from "react";
import type { BoardSnapshot } from "@/lib/contracts";
import { WORDING } from "@/lib/client/labels";
import {
  BEATS, abortError, api, isAbort, newMemo, recap, restoreAfterAutoplay, type AutoplayEnv, type Beat, type Rung, type SideTab,
} from "@/lib/autoplay/script";
import { runScript, type BeatLine, type BeatResult } from "@/lib/autoplay/runner";
import { BOARD_TOUR, captureTab } from "@/components/tour/boardSteps";
import { stopTour } from "@/components/tour/store";

export type AutoplayStatus = "closed" | "intro" | "running" | "end";

export interface AutoplayState {
  status: AutoplayStatus;
  paused: boolean;
  speed: 1 | 2;
  collapsed: boolean;
  /** The beat on screen (index into BEATS), or null before the first one shows. */
  shown: number | null;
  /** How many beats have been shown in this run, the one on screen included. */
  shownCount: number;
  /** Quiet beats that applied in this run (they add to "of M"). */
  extraShown: number;
  line: BeatLine | null;
  frac: number;
  waiting: boolean;
  results: BeatResult[];
  startedAt: number | null;
  endedAt: number | null;
  /** Goes up when the header button is pressed again during a run (the card unfolds). */
  nonce: number;
}

const INITIAL: AutoplayState = {
  status: "closed", paused: false, speed: 1, collapsed: false, shown: null, shownCount: 0, extraShown: 0, line: null,
  frac: 0, waiting: false, results: [], startedAt: null, endedAt: null, nonce: 0,
};

let state: AutoplayState = INITIAL;
const listeners = new Set<() => void>();

function set(patch: Partial<AutoplayState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAutoplay(): AutoplayState {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}

// ---------- The browser environment: the board's own poll is the clock ----------

let latest: BoardSnapshot | null = null;
const waiters = new Set<(snap: BoardSnapshot) => void>();
let refreshBoard: (() => void) | null = null;

const env: AutoplayEnv = {
  base: "",
  board: (signal) => api<BoardSnapshot>(env, "GET", "/api/board", undefined, signal),
  next: (signal) =>
    new Promise<BoardSnapshot>((resolve, reject) => {
      if (signal?.aborted) return reject(abortError());
      let settled = false;
      const finish = (snap: BoardSnapshot) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(snap);
      };
      const onAbort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(abortError());
      };
      // The board polls every second; if it stalls, fetch one ourselves.
      const fallback = setTimeout(() => {
        env.board(signal).then(finish, (e) => (isAbort(e) ? onAbort() : latest ? finish(latest) : onAbort()));
      }, 2500);
      const cleanup = () => {
        clearTimeout(fallback);
        waiters.delete(finish);
        signal?.removeEventListener("abort", onAbort);
      };
      waiters.add(finish);
      signal?.addEventListener("abort", onAbort, { once: true });
    }),
};

// ---------- Run state ----------

let abort: AbortController | null = null;
let memo = newMemo();
let skipPressed = false;
let undoTab: (() => void) | null = null;
let detachTimer: ReturnType<typeof setTimeout> | null = null;
let autoStarted = false;

const SIDE_PANEL = '[data-tour="side-panel"]';

function tabLabel(tab: SideTab): string {
  if (tab === "registry") return WORDING[latest?.meta.mode ?? "civilian"].registry;
  return tab === "zones" ? "Zones" : tab === "feed" ? "Feed" : "Ledger";
}

/** Opens a side-panel tab by its label (the label is followed by a count badge in the same button). */
function showTab(tab: SideTab) {
  const label = tabLabel(tab);
  const el = Array.from(document.querySelectorAll<HTMLButtonElement>(`${SIDE_PANEL} [role="tab"]`)).find((t) =>
    (t.textContent ?? "").trim().startsWith(label),
  );
  if (el && el.getAttribute("aria-selected") !== "true") el.click();
}

function stripQuery() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("autoplay")) return;
    url.searchParams.delete("autoplay");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  } catch {
    // Leave the address alone if it cannot be rewritten.
  }
}

async function run() {
  abort?.abort();
  const controller = new AbortController();
  abort = controller;
  skipPressed = false;
  stopTour(BOARD_TOUR);
  if (!undoTab) undoTab = captureTab();
  set({
    status: "running", paused: false, collapsed: false, shown: null, shownCount: 0, extraShown: 0, line: null, frac: 0,
    waiting: false, results: [], startedAt: Date.now(), endedAt: null,
  });
  try {
    await runScript(BEATS, env, memo, {
      speed: () => state.speed,
      paused: () => state.paused,
      takeSkip: () => {
        const s = skipPressed;
        skipPressed = false;
        return s;
      },
      onShow: (i, beat: Beat) => {
        set({
          shown: i, shownCount: state.shownCount + 1, extraShown: state.extraShown + (beat.quiet ? 1 : 0), line: null, frac: 0,
          waiting: false,
        });
        if (beat.focus?.tab) showTab(beat.focus.tab);
      },
      onLine: (_i, line) => set({ line }),
      onTick: (_i, frac, waiting) => {
        if (Math.abs(frac - state.frac) > 0.01 || waiting !== state.waiting) set({ frac, waiting });
      },
      onResult: (_i, _beat, result) => set({ results: [...state.results, result] }),
      afterAction: () => refreshBoard?.(),
    }, controller.signal);
    if (abort === controller) set({ status: "end", endedAt: Date.now(), paused: false, line: null });
  } catch (e) {
    if (!isAbort(e) && abort === controller) set({ status: "end", endedAt: Date.now(), paused: false, line: null });
  } finally {
    if (abort === controller) abort = null;
  }
}

export const autoplay = {
  /** Header button: show the intro card; during a run, unfold the card. */
  open() {
    if (state.status === "closed") set({ status: "intro", collapsed: false });
    else set({ collapsed: false, nonce: state.nonce + 1 });
  },
  /** Start (or start over) the run. */
  start() {
    void run();
  },
  /** ?autoplay=1: start once per page load, however often effects re-run. The link starts it once, not every reload. */
  autoStart() {
    if (autoStarted) return;
    autoStarted = true;
    stripQuery();
    void run();
  },
  /** The end card's recap, with this run's numbers. */
  recap(): Record<Rung, string> {
    return recap(memo);
  },
  togglePause() {
    if (state.status === "running") set({ paused: !state.paused });
  },
  skip() {
    if (state.status !== "running") return;
    skipPressed = true;
    if (state.paused) set({ paused: false });
  },
  setSpeed(speed: 1 | 2) {
    set({ speed });
  },
  setCollapsed(collapsed: boolean) {
    set({ collapsed });
  },
  /** Stop, put back what autoplay changed (autopilot, an unused Wrong polygon, the tab), and close. */
  async exit(keepalive = false) {
    abort?.abort();
    abort = null;
    const wasOpen = state.status !== "closed";
    set({ ...INITIAL, speed: state.speed, nonce: state.nonce });
    undoTab?.();
    undoTab = null;
    stripQuery();
    if (!wasOpen) return;
    const done = memo;
    memo = newMemo();
    await restoreAfterAutoplay(env, done, keepalive).catch(() => undefined);
    refreshBoard?.();
  },
  // ---------- wiring from the overlay ----------
  attach(refresh: () => void) {
    refreshBoard = refresh;
    if (detachTimer) clearTimeout(detachTimer);
    detachTimer = null;
  },
  /** The overlay unmounted. A remount right after (Strict Mode, Fast Refresh) keeps the run; leaving the board stops it. */
  detach() {
    if (detachTimer) clearTimeout(detachTimer);
    detachTimer = setTimeout(() => {
      detachTimer = null;
      refreshBoard = null;
      if (state.status !== "closed") void autoplay.exit(true);
    }, 400);
  },
  pushSnapshot(snap: BoardSnapshot) {
    if (snap === latest) return;
    latest = snap;
    for (const w of [...waiters]) w(snap);
  },
};

/** Closing the tab mid-run: put autopilot back (best effort; keepalive lets the request outlive the page). */
export function exitOnPageHide() {
  if (state.status !== "closed") void autoplay.exit(true);
}
