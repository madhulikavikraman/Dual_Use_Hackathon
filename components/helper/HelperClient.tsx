"use client";

// /helper/[token]: what a helper sent by the response team sees. The person's latest location (live while they share
// it), their needs, Navigate and Call, and four status buttons that update the registry row. Polls every 5 s.

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { HelperUpdateBody, HelperView } from "@/lib/contracts";
import { NEED_LABEL, PRIORITY_COLOR, PRIORITY_LABEL } from "@/lib/client/labels";
import type { DispatchStatus } from "@/lib/types";
import { getHelper, LinkError, postHelper } from "@/components/locate/api";

const HelperMap = dynamic(() => import("./HelperMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-500">Loading the map…</div>,
});

const POLL_MS = 5_000;
const STALE_MS = 15 * 60_000;

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`;
}

const STATUS_TEXT: Record<DispatchStatus, string> = {
  assigned: "Assigned to you",
  en_route: "En route",
  arrived: "Arrived at the location",
  reached: "Person reached",
  cannot_reach: "Could not reach the person",
  cancelled: "Stood down (another helper was sent or the row was closed)",
};

const ACTIONS: { status: HelperUpdateBody["status"]; label: string; tone: string; confirm?: string }[] = [
  { status: "en_route", label: "En route", tone: "bg-blue-700 text-white hover:bg-blue-800" },
  { status: "arrived", label: "Arrived", tone: "bg-slate-900 text-white hover:bg-slate-700" },
  {
    status: "reached",
    label: "Person reached",
    tone: "bg-green-700 text-white hover:bg-green-800",
    confirm: "Tap again to confirm. This stops the person's live location.",
  },
  {
    status: "cannot_reach",
    label: "Cannot reach",
    tone: "bg-white text-red-800 ring-2 ring-inset ring-red-700 hover:bg-red-50",
    confirm: "Tap again to confirm. The row goes back to the response team.",
  },
];

const ORDER: DispatchStatus[] = ["assigned", "en_route", "arrived"];

function enabled(current: DispatchStatus, next: HelperUpdateBody["status"]): boolean {
  if (!ORDER.includes(current)) return false;
  if (next === "en_route") return current === "assigned";
  if (next === "arrived") return current !== "arrived";
  return true;
}

export function HelperClient({ token }: { token: string }) {
  const [view, setView] = useState<HelperView | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [missing, setMissing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [clock, setClock] = useState(0);

  const load = useCallback(async () => {
    try {
      const v = await getHelper(token);
      setView(v);
      setReceivedAt(Date.now());
      setError(null);
      setMissing(null);
    } catch (e) {
      if (e instanceof LinkError && e.status === 404) setMissing(e.message);
      else setError(e instanceof Error ? e.message : String(e));
    }
  }, [token]);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const run = async () => {
      await load();
      if (!stopped) timer = window.setTimeout(run, POLL_MS);
    };
    void run();
    const ticker = window.setInterval(() => setClock(Date.now()), 1000);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearInterval(ticker);
    };
  }, [load]);

  async function act(a: (typeof ACTIONS)[number]) {
    if (a.confirm && armed !== a.status) {
      setArmed(a.status);
      return;
    }
    setArmed(null);
    setBusy(a.status);
    try {
      await postHelper(token, { status: a.status, note: note.trim() || undefined });
      await load();
      setNote("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (missing) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-100 px-4 text-center text-slate-900">
        <div>
          <h1 className="font-display text-3xl font-semibold">This helper link is not valid</h1>
          <p className="mt-2 text-lg text-slate-600">{missing} Ask the response team for a new link.</p>
        </div>
      </main>
    );
  }
  if (!view) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-100 text-lg text-slate-600" role="status">
        Opening the assignment…
      </main>
    );
  }

  const p = view.person;
  const loc = view.location;
  // Ages move with the client clock between polls (the server stamped `now` when it answered).
  const skew = receivedAt && clock > receivedAt ? clock - receivedAt : 0;
  const ageMs = loc ? Date.parse(view.now) - Date.parse(loc.observed_at) + skew : 0;
  const live = loc?.source === "gps_link";
  const fresh = ageMs < STALE_MS;
  const sourceText = !loc
    ? "No location yet"
    : live
      ? `Live GPS${loc.accuracy_m !== null ? ` · ${Math.round(loc.accuracy_m)} m` : ""} · ${ago(ageMs)}${fresh ? "" : " · stale"}`
      : loc.source === "stated"
        ? `Stated: “${loc.stated_text ?? "a place"}” · ${ago(ageMs)}`
        : loc.source === "enrolled"
          ? `Enrolled address · ${ago(ageMs)}`
          : "Zone centre (low precision)";
  const shareText =
    view.share_status === "live"
      ? "The person is sharing their live location."
      : view.share_status === "sent"
        ? "The person has the link but has not started sharing."
        : view.share_status === "stopped"
          ? "The person stopped sharing. This is the last fix."
          : view.share_status === "closed" || view.share_status === "expired"
            ? "Live location has ended. This is the last fix."
            : "No live-location link for this person.";
  const tel = p.phone && /^\+?[0-9][0-9 ()-]{5,}$/.test(p.phone) ? p.phone.replace(/[^\d+]/g, "") : null;
  const active = ORDER.includes(view.status);

  return (
    <main className="min-h-dvh bg-slate-100 text-slate-900">
      <header className="bg-slate-900 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <p className="font-display text-lg font-semibold">VoiceFlare · Helper</p>
          <span className="rounded bg-amber-400 px-2 py-0.5 text-xs font-black tracking-widest text-slate-950">
            {p.synthetic ? "SIMULATED" : "DEMO"}
          </span>
        </div>
      </header>

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <section aria-labelledby="who" className="rounded-xl bg-white p-4 ring-1 ring-slate-300">
          <p className="text-sm text-slate-600">
            {view.helper_label} · sent by {view.dispatched_by}: {view.reason}
          </p>
          <p role="status" className="mt-1 text-lg font-bold">
            {STATUS_TEXT[view.status]}
          </p>
          <h1 id="who" className="mt-3 flex flex-wrap items-center gap-2 text-2xl font-bold">
            <span
              className="rounded-full px-2.5 py-0.5 text-base font-black"
              style={{ backgroundColor: PRIORITY_COLOR[p.priority], color: p.priority === 3 ? "#111827" : "#fff" }}
              title={PRIORITY_LABEL[p.priority]}
            >
              P{p.priority}
            </span>
            {p.name ?? "Name not given"}
          </h1>
          <ul className="mt-2 space-y-1 text-lg">
            <li>
              <span className="text-slate-600">Needs: </span>
              <b>{p.needs.length ? p.needs.map((n) => NEED_LABEL[n]).join(", ") : (p.reason ?? "not recorded").replaceAll("_", " ")}</b>
            </li>
            <li>
              <span className="text-slate-600">People: </span>
              <b>{p.people ?? "not stated"}</b>
              <span className="text-slate-600"> · Language: </span>
              <b>{p.language ?? "unknown"}</b>
            </li>
            {p.animals ? (
              <li>
                <span className="text-slate-600">Animals: </span>
                <b>{p.animals}</b>
              </li>
            ) : null}
            {p.device_battery_hours !== null ? (
              <li>
                <span className="text-slate-600">Medical device battery: </span>
                <b>{p.device_battery_hours} h</b>
              </li>
            ) : null}
            <li className="text-base text-slate-600">{p.zone_name ?? p.zone_id ?? "No zone"}</li>
          </ul>
        </section>

        <section aria-labelledby="where" className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-300">
          <div className="p-4">
            <h2 id="where" className="text-sm font-bold uppercase tracking-wider text-slate-600">
              Where they are
            </h2>
            <p className="mt-1 flex items-center gap-2 text-lg font-semibold" aria-live="polite">
              {live && fresh ? (
                <span className="relative flex size-3" aria-hidden="true">
                  <span className="absolute inline-flex size-full rounded-full bg-blue-500 opacity-70 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-3 rounded-full bg-blue-600" />
                </span>
              ) : null}
              {sourceText}
            </p>
            <p className="mt-0.5 text-sm text-slate-600">{shareText}</p>
          </div>
          {loc ? (
            <div className="h-64 w-full bg-slate-200">
              <HelperMap lat={loc.lat} lng={loc.lng} accuracy_m={loc.accuracy_m} live={live} fresh={fresh} />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2 p-4">
            {loc ? (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-14 items-center justify-center rounded-xl bg-blue-700 px-4 text-lg font-bold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                Navigate
              </a>
            ) : (
              <span className="flex min-h-14 items-center justify-center rounded-xl bg-slate-200 px-4 text-lg font-bold text-slate-500">No location</span>
            )}
            {tel ? (
              <a
                href={`tel:${tel}`}
                className="flex min-h-14 items-center justify-center rounded-xl bg-white px-4 text-lg font-bold text-slate-900 ring-2 ring-inset ring-slate-900 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                Call
              </a>
            ) : (
              <span className="flex min-h-14 items-center justify-center rounded-xl bg-slate-200 px-4 text-center text-sm font-semibold text-slate-600">
                No number (demo phone)
              </span>
            )}
          </div>
        </section>

        <section aria-labelledby="status" className="rounded-xl bg-white p-4 ring-1 ring-slate-300">
          <h2 id="status" className="text-sm font-bold uppercase tracking-wider text-slate-600">
            Update the response team
          </h2>
          {active ? (
            <>
              <label htmlFor="note" className="mt-2 block text-sm font-semibold text-slate-800">
                Note (optional)
              </label>
              <input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder="e.g. gate locked, going round the back"
                className="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {ACTIONS.map((a) => (
                  <button
                    key={a.status}
                    type="button"
                    disabled={!enabled(view.status, a.status) || busy !== null}
                    onClick={() => void act(a)}
                    className={`min-h-14 rounded-xl px-3 text-lg font-bold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${a.tone} ${
                      armed === a.status ? "ring-4 ring-amber-400" : ""
                    }`}
                  >
                    {busy === a.status ? "Sending…" : armed === a.status ? `Confirm: ${a.label}` : a.label}
                  </button>
                ))}
              </div>
              {armed ? (
                <p role="status" className="mt-2 text-sm font-semibold text-amber-800">
                  {ACTIONS.find((a) => a.status === armed)?.confirm}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-lg">This assignment is finished. Thank you.</p>
          )}
          {error ? (
            <p role="alert" className="mt-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
        </section>

        <p className="text-center text-sm text-slate-600">
          Never tell the person when anyone will arrive. Life safety: call {view.emergency_number}.
        </p>
      </div>
    </main>
  );
}

/** The page's entry: the token from the route (/helper/[token]). */
export function HelperClientFromRoute() {
  const params = useParams<{ token: string }>();
  return <HelperClient token={typeof params?.token === "string" ? params.token : ""} />;
}
