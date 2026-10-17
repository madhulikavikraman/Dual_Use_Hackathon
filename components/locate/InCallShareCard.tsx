"use client";

// The in-call card on the browser phone (/phone/[id]): when the person said yes to the live-location link on the
// call, the "text message" arrives here. Tapping Share runs the same share as /l/[token], on this phone, so the room
// sees a real GPS pin on the board.

import Link from "next/link";
import { useState } from "react";
import { useLiveShare, useNow } from "./useLiveShare";

export function InCallShareCard({ token }: { token: string }) {
  const s = useLiveShare(token);
  const now = useNow(s.sharing);
  const [hidden, setHidden] = useState(false);
  const v = s.view;
  if (hidden || s.missing || !v) return null;
  const active = v.status === "sent" || v.status === "live";
  if (!active && !s.sharing) return null;

  return (
    <section
      aria-labelledby={`share-${token.slice(0, 6)}`}
      className="mx-4 mb-2 rounded-2xl bg-slate-900 p-4 ring-2 ring-sky-500/60"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">Text message (simulated) · response team</p>
      <h2 id={`share-${token.slice(0, 6)}`} className="mt-1 text-lg font-semibold leading-snug">
        Share live location with the response team?
      </h2>
      <p className="mt-1 text-sm text-slate-300">
        You said “{v.consent_quote}”. It stays on only until help reaches you. You can stop at any time.
      </p>
      {v.helper_assigned ? <p className="mt-2 text-sm font-semibold text-emerald-300">A responder has your location.</p> : null}
      {s.sharing ? (
        <div className="mt-3 flex items-center justify-between gap-3" aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-slate-200">
            <span className="relative flex size-3" aria-hidden="true">
              <span className="absolute inline-flex size-full rounded-full bg-sky-400 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-3 rounded-full bg-sky-400" />
            </span>
            {s.lastSentAt ? `Sharing live · ${Math.max(0, Math.round((now - s.lastSentAt) / 1000))} s ago · ${s.accuracy ?? "?"} m` : "Finding your position…"}
          </p>
          <button
            type="button"
            onClick={() => void s.stop()}
            className="min-h-11 shrink-0 rounded-xl bg-slate-800 px-4 text-sm font-semibold active:bg-slate-700"
          >
            Stop sharing
          </button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={s.start}
            className="min-h-12 flex-1 rounded-xl bg-sky-500 px-4 text-base font-semibold text-slate-950 active:scale-[0.98]"
          >
            Share my live location
          </button>
          <button
            type="button"
            onClick={() => setHidden(true)}
            className="min-h-12 rounded-xl bg-slate-800 px-4 text-sm font-medium active:bg-slate-700"
          >
            Not now
          </button>
        </div>
      )}
      {s.geo === "insecure" ? (
        <p role="alert" className="mt-2 text-sm text-amber-200">
          Location needs the https link (the tunnel URL).
        </p>
      ) : s.geo === "denied" ? (
        <p role="alert" className="mt-2 text-sm text-amber-200">
          Location is blocked for this page. Allow it in the browser settings, or say where you are on the call.
        </p>
      ) : s.geo ? (
        <p role="status" className="mt-2 text-sm text-amber-200">
          Still finding your position…
        </p>
      ) : null}
      <Link href={`/l/${token}`} target="_blank" className="mt-2 inline-block text-xs text-slate-400 underline underline-offset-2">
        Open the full page
      </Link>
    </section>
  );
}
