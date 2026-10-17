"use client";

import { autoplay, useAutoplay } from "./controller";

/** Board header: opens "Play the full fire" (an intro card first, since starting resets the run). */
export function PlayFireButton({ className = "" }: { className?: string }) {
  const { status } = useAutoplay();
  const playing = status === "running";
  return (
    <button
      type="button"
      onClick={() => autoplay.open()}
      aria-label={playing ? "Autoplay is playing: show its captions" : "Play the full fire"}
      title="Plays the whole simulated fire on this board, with captions, in about 4 minutes"
      className={`relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/10 hover:ring-vf-flare/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember ${className}`}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 text-vf-flare" fill="currentColor">
        <path d="M4.5 2.8v10.4a.6.6 0 0 0 .92.5l8.1-5.2a.6.6 0 0 0 0-1L5.42 2.3a.6.6 0 0 0-.92.5Z" />
      </svg>
      <span className="hidden xl:inline">{playing ? "Playing the full fire" : "Play the full fire"}</span>
      <span className="xl:hidden">{playing ? "Playing" : "Play"}</span>
      {playing ? (
        <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-vf-flare ring-2 ring-slate-900 motion-safe:animate-pulse" />
      ) : null}
    </button>
  );
}
