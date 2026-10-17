"use client";

import { useSyncExternalStore } from "react";

// One shared ticking clock for countdowns and the header clock. The current time is only read
// inside the interval callback, never during render, so prerendering stays deterministic and the
// first client render matches the server (both see null).

const TICK_MS = 250;
let current: number | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = () => current;
const getServerSnapshot = () => null;

/** Client clock in ms, updated four times a second; null until mounted. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
