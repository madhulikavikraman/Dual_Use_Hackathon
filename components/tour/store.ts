"use client";

// Which tour is open, shared between the button that starts it and the screen that mounts it, plus a
// per-browser "seen" flag. A tiny external store: no context provider to thread through the board.
import { useSyncExternalStore } from "react";

export interface ActiveTour {
  id: string;
  /** Goes up on every start, so starting again opens the tour fresh at step 1. */
  run: number;
}

let active: ActiveTour | null = null;
let runs = 0;
const listeners = new Set<() => void>();
/** "Seen" for this page load, for browsers that block storage. */
const seenThisSession = new Set<string>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab finishing the tour marks it seen here too.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function startTour(id: string) {
  active = { id, run: ++runs };
  emit();
}

export function stopTour(id: string) {
  if (active?.id !== id) return;
  active = null;
  emit();
}

const readActive = () => active;
const readNone = () => null;

export function useActiveTour(): ActiveTour | null {
  return useSyncExternalStore(subscribe, readActive, readNone);
}

/** Still this run? A cleanup that sees true is an effect re-run (Strict Mode, Fast Refresh), not a close. */
export function isTourActive(id: string, run: number): boolean {
  return active?.id === id && active.run === run;
}

const autoStarted = new Set<string>();

/** True the first time per page load: a ?tour=1 link starts the tour once, however often effects re-run. */
export function claimAutoStart(id: string): boolean {
  if (autoStarted.has(id)) return false;
  autoStarted.add(id);
  return true;
}

const seenKey = (id: string) => `voiceflare.tour.${id}.seen`;

function hasSeenTour(id: string): boolean {
  if (seenThisSession.has(id)) return true;
  try {
    return window.localStorage.getItem(seenKey(id)) !== null;
  } catch {
    return false;
  }
}

/** Remember that this browser has been through (or skipped) the tour. */
export function markTourSeen(id: string) {
  seenThisSession.add(id);
  try {
    window.localStorage.setItem(seenKey(id), new Date().toISOString());
  } catch {
    // Private window or blocked storage: the tour still works, it is just not remembered.
  }
  emit();
}

/** Whether this browser has seen the tour. True on the server, so nothing flashes before hydration. */
export function useTourSeen(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hasSeenTour(id),
    () => true,
  );
}
