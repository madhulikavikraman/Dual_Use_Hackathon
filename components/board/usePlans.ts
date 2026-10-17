"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { EvacPlan } from "@/lib/types";

// Block-by-block plans for the board, from GET /api/plans. One poller for the whole page (the map layers and the plan
// panel share it), every 2 s while anything is subscribed. The board's own poll runs the tick that moves the waves.
// When the integration adds `plans` to the board snapshot, swap this for snap.plans.

const POLL_MS = 2000;
type State = { plans: EvacPlan[]; at: number };

const EMPTY: State = { plans: [], at: 0 };
let state: State = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<void> | null = null;
let users = 0;

function emit() {
  for (const l of listeners) l();
}

async function load(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/plans", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { plans?: EvacPlan[] };
      const plans = Array.isArray(data.plans) ? data.plans : [];
      // Keep the same object when nothing changed, so the map does not redraw every poll.
      if (JSON.stringify(plans) !== JSON.stringify(state.plans)) {
        state = { plans, at: Date.now() };
        emit();
      }
    } catch {
      // The board keeps working without plans (offline, or before migration 005).
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function loop() {
  timer = setTimeout(async () => {
    await load();
    if (users > 0) loop();
  }, POLL_MS);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Poll now (after an action on a plan). */
export function refreshPlans(): Promise<void> {
  return load();
}

/** Every plan in use for the current scenario's zones. */
export function usePlans(): EvacPlan[] {
  const s = useSyncExternalStore(subscribe, () => state, () => EMPTY);
  useEffect(() => {
    users++;
    if (users === 1) {
      void load();
      if (!timer) loop();
    }
    return () => {
      users--;
      if (users === 0 && timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
  }, []);
  return s.plans;
}

/** The plan for one zone, or null. */
export function useZonePlan(zoneId: string | null | undefined): EvacPlan | null {
  const plans = usePlans();
  return zoneId ? (plans.find((p) => p.zone_id === zoneId) ?? null) : null;
}
