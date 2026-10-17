"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PollState<T> {
  data: T | null;
  /** Message of the last failed poll; null once a poll succeeds again. */
  error: string | null;
  /** Client clock (ms) when `data` arrived. */
  receivedAt: number | null;
  /** Poll now (after an action), without waiting for the next interval. */
  refresh: () => void;
}

/**
 * Polls `fetcher` about every `intervalMs`, never overlapping requests. `fetcher` must be stable
 * (a module-level function), since changing it restarts the loop.
 */
export function usePoll<T>(fetcher: () => Promise<T>, intervalMs: number): PollState<T> {
  const [state, setState] = useState<Omit<PollState<T>, "refresh">>({ data: null, error: null, receivedAt: null });
  const kick = useRef<(() => void) | null>(null);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let again = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      if (stopped) return;
      if (inFlight) {
        again = true;
        return;
      }
      clearTimeout(timer);
      inFlight = true;
      const started = Date.now();
      try {
        const data = await fetcher();
        if (!stopped) setState({ data, error: null, receivedAt: Date.now() });
      } catch (e) {
        if (!stopped) setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }));
      } finally {
        inFlight = false;
        if (!stopped) {
          const wait = again ? 0 : Math.max(150, intervalMs - (Date.now() - started));
          again = false;
          timer = setTimeout(run, wait);
        }
      }
    };

    kick.current = () => void run();
    void run();
    return () => {
      stopped = true;
      kick.current = null;
      clearTimeout(timer);
    };
  }, [fetcher, intervalMs]);

  const refresh = useCallback(() => kick.current?.(), []);
  return { ...state, refresh };
}
