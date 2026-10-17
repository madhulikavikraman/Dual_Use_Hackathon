"use client";

import { useSyncExternalStore } from "react";

/** Whether a media query matches, kept live. `fallback` is what the server and the first render assume. */
export function useMedia(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    (listener) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}
