"use client";

// /l/[token]: the page a person opens from the text message after saying yes on the call. Phone first, big type.
// It says what they agreed to, what is shared, with whom, and when it stops; then one button starts sharing.
// Never an arrival time: at most "A responder has your location".

import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLiveShare, useNow, type GeoProblem } from "./useLiveShare";

const fmtClock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min`;
}

const GEO_TEXT: Record<GeoProblem, string> = {
  denied: "Location is turned off for this page. You can allow it in your browser settings, or tell us where you are below.",
  unavailable: "Your phone cannot find its position right now. Keep the page open, or tell us where you are below.",
  timeout: "Still looking for your position. Stay near a window if you can, or tell us where you are below.",
  unsupported: "This browser cannot share location. Tell us where you are below.",
  insecure: "Location needs a secure link (https). Open the link from the text message, or tell us where you are below.",
  coarse: "Waiting for a better position from your phone (the last one was too rough to help).",
};

export function LocateClient({ token }: { token: string }) {
  const s = useLiveShare(token);
  const now = useNow(s.sharing || s.view?.status === "live");
  const [place, setPlace] = useState("");
  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeMsg, setPlaceMsg] = useState<string | null>(null);
  const v = s.view;
  const active = v ? v.status === "sent" || v.status === "live" : false;
  const done = v ? v.reached || v.status === "closed" : false;
  const emergency = v?.emergency_number ?? "911";

  async function submitPlace(e: FormEvent) {
    e.preventDefault();
    const text = place.trim();
    if (text.length < 3 || placeBusy) return;
    setPlaceBusy(true);
    setPlaceMsg(null);
    try {
      const r = await s.sendStated(text);
      setPlaceMsg(r.found ? "Sent. The response team has the place you typed." : "Sent. We could not find it on the map, so a person will call you to check.");
      setPlace("");
    } catch (err) {
      setPlaceMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setPlaceBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-vf-ink text-vf-bone">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3">
          <p className="font-display text-lg font-semibold tracking-tight">VoiceFlare</p>
          <span className="rounded-full bg-amber-400/15 px-3 py-1 text-sm font-semibold text-amber-200 ring-1 ring-amber-400/40">
            {v?.synthetic ? "Demo · synthetic resident" : "Hackathon demo"}
          </span>
        </header>

        {s.missing ? (
          <section className="rounded-2xl bg-vf-coal p-5 ring-1 ring-vf-ash">
            <h1 className="font-display text-3xl font-semibold leading-tight">This link is not valid</h1>
            <p className="mt-3 text-lg text-vf-smoke">It may be from an earlier demo run. If you need help, call {emergency}.</p>
          </section>
        ) : !v ? (
          <p className="py-16 text-center text-xl text-vf-smoke" role="status">
            Opening your link…
          </p>
        ) : (
          <>
            <section aria-labelledby="share-title">
              <h1 id="share-title" className="font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.01em]">
                Share your location with the response team
              </h1>
              <p className="mt-3 text-lg text-vf-smoke">
                On the call at {fmtClock(v.consented_at)} you said: <span className="font-semibold text-vf-bone">“{v.consent_quote}”</span>
              </p>
            </section>

            <dl className="grid gap-3 rounded-2xl bg-vf-coal p-5 text-lg ring-1 ring-vf-ash">
              <div>
                <dt className="text-sm font-semibold uppercase tracking-wider text-vf-smoke">What is shared</dt>
                <dd>Your phone&apos;s position, about every 5 seconds, while this page is open and sharing.</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold uppercase tracking-wider text-vf-smoke">With whom</dt>
                <dd>The response team only. It is not put on any public map.</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold uppercase tracking-wider text-vf-smoke">When it stops</dt>
                <dd>When help reaches you, at {fmtClock(v.expires_at)} (4 hours), or when you tap Stop sharing.</dd>
              </div>
            </dl>

            {v.helper_assigned && active ? (
              <p role="status" className="rounded-2xl bg-emerald-500/15 px-5 py-4 text-xl font-semibold text-emerald-100 ring-1 ring-emerald-400/40">
                A responder has your location.
              </p>
            ) : null}

            {done ? (
              <p role="status" className="rounded-2xl bg-emerald-500/15 px-5 py-4 text-xl font-semibold text-emerald-100 ring-1 ring-emerald-400/40">
                Help has reached you. Sharing has stopped.
              </p>
            ) : !active || s.gone ? (
              <p role="status" className="rounded-2xl bg-vf-coal px-5 py-4 text-xl ring-1 ring-vf-ash">
                {s.gone ?? (v.status === "expired" ? "This link has expired. Nothing more is sent." : "You stopped sharing. Nothing more is sent.")}
              </p>
            ) : s.sharing ? (
              <section aria-live="polite" className="rounded-2xl bg-vf-coal p-5 ring-2 ring-vf-flare">
                <p className="flex items-center gap-3 text-2xl font-semibold">
                  <span className="relative flex size-4" aria-hidden="true">
                    <span className="absolute inline-flex size-full rounded-full bg-vf-flare opacity-60 motion-safe:animate-ping" />
                    <span className="relative inline-flex size-4 rounded-full bg-vf-flare" />
                  </span>
                  Sharing live
                </p>
                <p className="mt-2 text-lg text-vf-smoke">
                  {s.lastSentAt ? `Last sent ${ago(now - s.lastSentAt)} ago, accuracy ${s.accuracy ?? "?"} m` : "Finding your position…"}
                </p>
                <p className="mt-1 text-base text-vf-smoke">
                  Keep this page open.{s.wakeLock ? " The screen stays on while you share." : ""}
                </p>
                <button
                  type="button"
                  onClick={() => void s.stop()}
                  className="mt-4 min-h-14 w-full rounded-xl bg-vf-ash px-5 text-lg font-semibold text-vf-bone ring-1 ring-vf-smoke/40 hover:bg-vf-ash/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-bone"
                >
                  Stop sharing
                </button>
              </section>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={s.start}
                  className="min-h-20 w-full rounded-2xl bg-vf-flare px-6 text-2xl font-semibold text-white shadow-lg shadow-vf-flare/20 hover:bg-vf-ember focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-vf-bone active:scale-[0.99]"
                >
                  Share my live location
                </button>
                {v.status === "live" && v.last_fix_at ? (
                  <p className="text-center text-base text-vf-smoke">
                    The team last got your position {ago(now - Date.parse(v.last_fix_at))} ago. Tap to keep sharing from this page.
                  </p>
                ) : (
                  <p className="text-center text-base text-vf-smoke">Your phone will ask to allow location. Choose Allow.</p>
                )}
                {active && v.status === "live" ? (
                  <button type="button" onClick={() => void s.stop()} className="text-base font-semibold text-vf-smoke underline underline-offset-4">
                    Stop sharing
                  </button>
                ) : null}
              </div>
            )}

            {s.geo ? (
              <p role="alert" className="rounded-2xl bg-amber-500/15 px-5 py-4 text-lg text-amber-100 ring-1 ring-amber-400/40">
                {GEO_TEXT[s.geo]}
              </p>
            ) : null}
            {s.error && !s.gone ? (
              <p role="alert" className="text-base text-amber-200">
                {s.error}
              </p>
            ) : null}

            {!done && v.status !== "expired" ? (
              <form onSubmit={submitPlace} className="rounded-2xl bg-vf-coal p-5 ring-1 ring-vf-ash">
                <label htmlFor="place" className="block text-xl font-semibold">
                  Tell us where you are
                </label>
                <p className="mt-1 text-base text-vf-smoke">A street address, a cross street, or a landmark.</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input
                    id="place"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    autoComplete="street-address"
                    enterKeyHint="send"
                    maxLength={200}
                    className="min-h-14 min-w-0 flex-1 rounded-xl bg-vf-ink px-4 text-lg text-vf-bone ring-1 ring-vf-ash placeholder:text-vf-smoke/70 focus:outline-none focus:ring-2 focus:ring-vf-flare"
                    placeholder="e.g. Venice Blvd and Sepulveda"
                  />
                  <button
                    type="submit"
                    disabled={place.trim().length < 3 || placeBusy}
                    className="min-h-14 rounded-xl bg-vf-bone px-6 text-lg font-semibold text-vf-ink disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-flare"
                  >
                    {placeBusy ? "Sending…" : "Send"}
                  </button>
                </div>
                {placeMsg ? (
                  <p role="status" className="mt-3 text-base text-vf-bone">
                    {placeMsg}
                  </p>
                ) : null}
              </form>
            ) : null}

            <a
              href={`tel:${emergency}`}
              className="flex min-h-16 items-center justify-center rounded-2xl bg-vf-blood px-5 text-xl font-semibold text-white ring-1 ring-vf-flare/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-bone"
            >
              In danger right now? Call {emergency}
            </a>
          </>
        )}

        <p className="text-center text-sm text-vf-smoke">
          VoiceFlare emergency information line. Your position goes to the response team only and stops when help reaches you.
        </p>
      </div>
    </main>
  );
}

/** The page's entry: the token from the route (/l/[token]). */
export function LocateClientFromRoute() {
  const params = useParams<{ token: string }>();
  return <LocateClient token={typeof params?.token === "string" ? params.token : ""} />;
}
