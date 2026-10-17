"use client";

import { startTour, useTourSeen } from "./store";

/** Starts a tour. Until this browser has taken it, a flare dot says there is one waiting. */
export function TourButton({ tour, className = "" }: { tour: string; className?: string }) {
  const seen = useTourSeen(tour);
  return (
    <button
      type="button"
      onClick={() => startTour(tour)}
      title="A short guided tour of this screen"
      className={`relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/10 hover:ring-vf-flare/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember ${className}`}
    >
      <SignalMark />
      Tour
      {seen ? null : (
        <>
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-vf-flare ring-2 ring-slate-900" />
          <span className="sr-only">, not taken yet</span>
        </>
      )}
    </button>
  );
}

/** The emblem's signal arcs, small. */
function SignalMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-4 text-vf-flare"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
    >
      <circle cx="8" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M5.3 8.8a3.8 3.8 0 0 1 5.4 0" />
      <path d="M3.1 6.5a6.9 6.9 0 0 1 9.8 0" />
    </svg>
  );
}
