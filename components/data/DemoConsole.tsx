"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BoardSnapshot } from "@/lib/contracts";
import { STATE_COLOR, STATE_SHORT } from "@/lib/directives";
import type { Mode, SimPreset, ZoneState } from "@/lib/types";
import { Button, SimulatedBadge, clock } from "./ui";

// The operator's console for the demo and rehearsals (backlog item 5): reset a scenario, drive the simulator,
// run the models, copy the ArcGIS feed URLs, download exports, and keep an eye on the run.

const SCENARIOS = [
  { id: "westside", label: "Westside Fire (LA)", hint: "The demo path: Santa Monica on fire, Culver City next" },
  { id: "usc", label: "USC DPS (ordinary Tuesday)", hint: "Campus zones, RAs and officers on post" },
  { id: "altadena", label: "West Altadena (Eaton framing)", hint: "One-zone fallback for the problem slide" },
  { id: "norte", label: "Norte Fire, San Clemente (live)", hint: "The real fire on demo weekend: live CAL FIRE status and NWS alerts in the feed; zones and residents simulated" },
  { id: "chongqing", label: "Chongqing, China (Twist 2)", hint: "China's ladder, 119, grid-worker sentinels" },
] as const;

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "civilian", label: "Civilian · Cal OES", hint: "Evacuation Warning, Evacuation Order, Shelter in Place, Lifted (Cal OES, May 2020)." },
  { id: "campus", label: "Campus · USC DPS", hint: "Avoid the area, leave by the nearest safe exit, shelter in place, all clear." },
  { id: "base", label: "Base · installation", hint: "Avoid, evacuate to your accountability point, lockdown, all clear." },
];

const PRESETS: { id: SimPreset; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "tower_down", label: "Tower down" },
  { id: "fire_spreading", label: "Fire spreading" },
  { id: "mass_no_answer", label: "Mass no answer" },
  { id: "earthquake", label: "Earthquake" },
  { id: "hoax_flood", label: "Hoax flood" },
  { id: "dark_zone", label: "Dark zone" },
];

const EVENTS: {
  id: "tower_down" | "earthquake" | "hoax_flood" | "fire_spreading" | "mass_no_answer" | "dark_zone";
  label: string;
  hint: string;
}[] = [
  { id: "tower_down", label: "Tower down", hint: "The Palms block goes silent: a silence-cluster card" },
  { id: "earthquake", label: "Earthquake", hint: "USGS M5.9 (simulated) and 20 reports in Mid-City" },
  { id: "hoax_flood", label: "Hoax flood", hint: "200 unverified reports in Koreatown: the hoax mirror" },
  { id: "fire_spreading", label: "Fire spreading", hint: "The envelope advances 1 h: new proposals" },
  { id: "mass_no_answer", label: "Mass no answer", hint: "70% of residents stop answering" },
  {
    id: "dark_zone",
    label: "Dark zone",
    hint: "Simulated sentinels go silent (volunteer phones still ring unless on autopilot). The dark-zone card needs 3+ sentinels asked: on Westside, open the hold on Santa Monica, Venice, West LA or Mid-City. Sends at 0:00",
  },
];

const FEEDS = [
  { name: "zones", what: "Zone polygons: state, directive, population estimate" },
  { name: "clusters", what: "Hex clusters: kind, count, baseline, score, corroborated" },
  { name: "help", what: "Registry points: priority, needs, age, status (no phones, no names)" },
  { name: "reports", what: "Geo-tagged reports: type, source, age" },
] as const;

const PAGES = [
  { href: "/board", label: "Board" },
  { href: "/phones", label: "Phones" },
  { href: "/qrt", label: "QRT" },
  { href: "/evidence", label: "Evidence" },
  { href: "/twists", label: "Twists" },
];

interface LogLine {
  at: string;
  label: string;
  ok: boolean;
  detail: string;
}

interface FireResult {
  wind?: { speed_mph: number; from_label: string; source: string; detail: string } | null;
  advanced_hours?: number;
  proposals?: { zone_id: string; proposed_state: ZoneState; reason: string }[];
  considered?: { zone: string; hours: number; outcome: string }[];
}

function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-neutral-600 uppercase dark:text-neutral-400">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "warn" | "bad" }) {
  const color = tone === "bad" ? "text-rose-700 dark:text-rose-400" : tone === "warn" ? "text-amber-700 dark:text-amber-400" : "";
  return (
    <div className="rounded border border-neutral-200 px-2 py-1.5 dark:border-neutral-800">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded border border-neutral-200 p-2 dark:border-neutral-800">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-sky-700" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-neutral-500">{hint}</span>
      </span>
    </label>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Not a secure context (e.g. a LAN IP over http): fall back to a hidden textarea.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

const BASE_KEY = "secondkey.demo.publicBase";

export default function DemoConsole({ feedToken, defaultBase }: { feedToken: string; defaultBase: string | null }) {
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [fire, setFire] = useState<FireResult | null>(null);
  const [wind, setWind] = useState<"live" | "seeded">("live");
  const [base, setBase] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);
  const [capZone, setCapZone] = useState<string>("");
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/board", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setBoard(body as BoardSnapshot);
      setBoardError(null);
    } catch (e) {
      setBoardError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 2000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh]);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(BASE_KEY);
    } catch {
      saved = null;
    }
    const id = setTimeout(() => setBase(saved || defaultBase || window.location.origin), 0);
    return () => clearTimeout(id);
  }, [defaultBase]);

  const saveBase = (v: string) => {
    setBase(v);
    try {
      window.localStorage.setItem(BASE_KEY, v);
    } catch {
      /* private mode: keep it for this visit only */
    }
  };

  const addLog = (label: string, ok: boolean, detail: string) =>
    setLog((l) => [{ at: new Date().toISOString(), label, ok, detail }, ...l].slice(0, 14));

  async function post<T = Record<string, unknown>>(label: string, url: string, payload: unknown, summarize?: (j: T) => string): Promise<T | null> {
    setBusy(label);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const j = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (!res.ok) {
        addLog(label, false, j?.error ?? `HTTP ${res.status}${res.status === 404 ? " (route not built yet?)" : ""}`);
        return null;
      }
      addLog(label, true, summarize ? summarize(j) : "done");
      return j;
    } catch (e) {
      addLog(label, false, e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(null);
      void refresh();
    }
  }

  const reset = (id: string, label: string) => {
    if (!window.confirm(`Reset to "${label}"? This wipes the current run (the twist log is kept).`)) return;
    void post<{ zones?: number; households?: number; devices?: number }>(`Reset: ${label}`, "/api/demo/reset", { scenario: id }, (j) =>
      `${j.zones ?? "?"} zones, ${j.households ?? "?"} households (${j.devices ?? "?"} devices)`,
    );
    setFire(null);
  };

  const sim = (label: string, payload: Record<string, unknown>) =>
    post<{ detail?: string | null }>(label, "/api/demo/sim", payload, (j) => j.detail ?? "ok");

  const runFire = async (advanceHours?: number) => {
    const j = await post<FireResult>(
      advanceHours ? `Advance envelope +${advanceHours} h` : "Run fire model",
      "/api/proposals/run",
      { model: "fire_envelope", wind, ...(advanceHours ? { advanceHours } : {}) },
      (r) => `${r.proposals?.length ?? 0} new proposal(s); wind ${r.wind ? `${r.wind.speed_mph} mph from the ${r.wind.from_label} (${r.wind.source})` : "?"}`,
    );
    if (j) setFire(j);
  };

  const runPattern = () =>
    post<{ changes?: number; proposals?: unknown[] }>("Run pattern watch", "/api/proposals/run", { model: "call_pattern" }, (j) =>
      `${j.changes ?? 0} change(s); ${j.proposals?.length ?? 0} open call-pattern proposal(s)`,
    );

  const meta = board?.meta;
  const cleanBase = (base || "").replace(/\/+$/, "");
  const isLocal = /localhost|127\.0\.0\.1|\[::1\]|^https?:\/\/(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(cleanBase);
  const feedUrl = (name: string) => `${cleanBase}/api/feeds/${name}.geojson?token=${encodeURIComponent(feedToken)}`;

  const readout = useMemo(() => {
    if (!board) return null;
    const zonesByState = new Map<ZoneState, number>();
    for (const z of board.zones) zonesByState.set(z.state, (zonesByState.get(z.state) ?? 0) + 1);
    const openHolds = board.holds.filter((h) => h.status === "open");
    const reg = board.registry.filter((r) => r.status !== "closed" && r.status !== "reached");
    const clustersByKind = new Map<string, number>();
    for (const c of board.clusters) clustersByKind.set(c.kind, (clustersByKind.get(c.kind) ?? 0) + 1);
    return {
      zonesByState,
      openHolds,
      reg,
      clustersByKind,
      openProposals: board.proposals.filter((p) => p.status === "open"),
      real: board.households.filter((h) => !h.synthetic).length,
    };
  }, [board]);

  const now = board ? Date.parse(board.now) : 0;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <SimulatedBadge />
            <span>VoiceFlare · operator only</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Demo console</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {meta ? (
              <>
                Scenario <b>{meta.scenario}</b> ({meta.mode}) · simulator <b>{meta.sim_preset.replace("_", " ")}</b> · {board?.backend} store · Retell{" "}
                {board?.retell ? "on" : "off (browser phones)"} · updated {clock(board?.now)}
              </>
            ) : boardError ? (
              <span className="text-rose-700">Board unavailable: {boardError}</span>
            ) : (
              "Loading the board…"
            )}
          </p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {/* One click: resets Westside and plays the whole run on the board, with captions (lib/autoplay). */}
          <Link
            href="/board?autoplay=1"
            title="Resets the Westside Fire and plays the whole run on /board with captions, about 4 minutes. Autopilot answers for the six phones."
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5" fill="currentColor">
              <path d="M4.5 2.8v10.4a.6.6 0 0 0 .92.5l8.1-5.2a.6.6 0 0 0 0-1L5.42 2.3a.6.6 0 0 0-.92.5Z" />
            </svg>
            Play end-to-end
          </Link>
          {PAGES.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              {p.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="Scenario">
          <div className="grid gap-2 sm:grid-cols-3">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => reset(s.id, s.label)}
                className={`rounded-md border p-2 text-left transition hover:bg-neutral-50 disabled:opacity-50 dark:hover:bg-neutral-800 ${
                  meta?.scenario === s.id ? "border-sky-700 ring-1 ring-sky-700" : "border-neutral-300 dark:border-neutral-700"
                }`}
              >
                <span className="block text-sm font-semibold">Reset: {s.label}</span>
                <span className="block text-xs text-neutral-500">{s.hint}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-500">A reset wipes the run (calls, holds, registry, ledger, clusters) and keeps the twist log.</p>
          <div className="mt-4 text-xs font-semibold text-neutral-500">Mode (directive vocabulary the agent reads)</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                title={m.hint}
                disabled={!meta || Boolean(busy)}
                onClick={() => void sim(`Mode: ${m.label}`, { mode: m.id })}
                className={`rounded-full border px-3 py-1 text-sm disabled:opacity-50 ${
                  meta?.mode === m.id
                    ? "border-sky-700 bg-sky-700 text-white"
                    : "border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-neutral-500">{MODES.find((m) => m.id === meta?.mode)?.hint ?? "Switches the words, not the zones."}</p>
        </Card>

        <Card title="Run readout" right={boardError ? <span className="text-xs text-rose-600">stale</span> : null}>
          {readout && board ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {board.zones.map((z) => (
                  <span
                    key={z.id}
                    title={`${z.name}: ${z.state}`}
                    className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-0.5 text-xs dark:border-neutral-700"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: STATE_COLOR[z.state] }} />
                    {z.id} {STATE_SHORT[z.state]}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Households (real phones)" value={`${board.households.length} (${readout.real})`} />
                <Stat label="Calls active / queued" value={`${board.metrics.calls_active} / ${board.metrics.calls_queued}`} />
                <Stat label="Registry open" value={readout.reg.length} tone={readout.reg.some((r) => r.priority === 1) ? "bad" : undefined} />
                <Stat label="Open proposals" value={readout.openProposals.length} tone={readout.openProposals.length ? "warn" : undefined} />
                <Stat
                  label="Clusters"
                  value={readout.clustersByKind.size ? [...readout.clustersByKind].map(([k, n]) => `${n} ${k}`).join(", ") : "0"}
                />
                <Stat label="Reports" value={board.reports.length >= 200 ? "200+" : board.reports.length} />
                <Stat label="Refusals / decisions" value={`${board.metrics.refusals} / ${board.metrics.human_decisions}`} />
                <Stat label="Cost (simulated)" value={`${board.metrics.cost_minutes} min · $${board.metrics.cost_usd}`} />
              </div>
              {readout.openHolds.length ? (
                <div className="flex flex-col gap-1">
                  {readout.openHolds.map((h) => {
                    const left = Math.max(0, Math.round((Date.parse(h.deadline) - now) / 1000));
                    return (
                      <div key={h.id} className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm dark:border-amber-800 dark:bg-amber-950">
                        <b>Hold open</b> · {h.polygon_label} · wakes {h.population_est.toLocaleString()} · {left}s left · yes {h.tally.yes} / no{" "}
                        {h.tally.no} / unsure {h.tally.unsure} / silent {h.tally.silent} · read {h.read}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-neutral-500">No hold open.</p>
              )}
              {meta?.usgs_event ? (
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  USGS event: M{meta.usgs_event.mag} {meta.usgs_event.place} at {clock(meta.usgs_event.at)}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">{boardError ? `Board unavailable: ${boardError}` : "Loading…"}</p>
          )}
        </Card>

        <Card title="Simulator">
          <div className="text-xs font-semibold text-neutral-500">Preset (how synthetic people answer from now on)</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void sim(`Preset: ${p.label}`, { preset: p.id })}
                className={`rounded-full border px-3 py-1 text-sm disabled:opacity-50 ${
                  meta?.sim_preset === p.id
                    ? "border-sky-700 bg-sky-700 text-white"
                    : "border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-4 text-xs font-semibold text-neutral-500">Events (fire now)</div>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {EVENTS.map((e) => (
              <button
                key={e.id}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void sim(`Event: ${e.label}`, { event: e.id })}
                className="rounded-md border border-neutral-300 p-2 text-left hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                <span className="block text-sm font-semibold">{e.label}</span>
                <span className="block text-xs text-neutral-500">{e.hint}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Toggle
              label="Autopilot devices"
              hint="The simulator answers for the six device phones (rehearse without volunteers)."
              checked={Boolean(meta?.autopilot_devices)}
              disabled={!meta || Boolean(busy)}
              onChange={(v) => void sim(`Autopilot devices ${v ? "on" : "off"}`, { autopilot_devices: v })}
            />
            <Toggle
              label="Wrong polygon"
              hint="The next hold composes the countywide polygon (the January 9 failure)."
              checked={Boolean(meta?.wrong_polygon)}
              disabled={!meta || Boolean(busy)}
              onChange={(v) => void sim(`Wrong polygon ${v ? "on" : "off"}`, { wrong_polygon: v })}
            />
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            No volunteers?{" "}
            <Link href="/board?autoplay=1" className="font-semibold text-sky-700 underline underline-offset-2 hover:text-sky-800 dark:text-sky-400">
              Play end-to-end
            </Link>{" "}
            resets Westside and plays the whole run on the board with captions, autopilot on; Exit puts autopilot back.
          </p>
        </Card>

        <Card title="Models (they propose; a human decides)">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-xs font-semibold text-neutral-500">Wind</span>
            <label className="flex items-center gap-1">
              <input type="radio" name="wind" className="accent-sky-700" checked={wind === "live"} onChange={() => setWind("live")} /> Live NWS (seeded
              fallback)
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="wind" className="accent-sky-700" checked={wind === "seeded"} onChange={() => setWind("seeded")} /> Story wind
              (WNW 20 mph)
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button tone="primary" disabled={Boolean(busy)} onClick={() => void runFire()}>
              Run fire model
            </Button>
            <Button disabled={Boolean(busy)} onClick={() => void runFire(1)}>
              Advance envelope +1 h
            </Button>
            <Button disabled={Boolean(busy)} onClick={() => void runPattern()}>
              Run pattern watch
            </Button>
          </div>
          {fire ? (
            <div className="mt-3 rounded border border-neutral-200 p-2 text-sm dark:border-neutral-800">
              <div className="text-xs text-neutral-500">
                Toy model · perimeter advanced {fire.advanced_hours ?? 0} h · {fire.wind?.detail}
              </div>
              {fire.proposals?.length ? (
                <ul className="mt-1 list-disc pl-5">
                  {fire.proposals.map((p) => (
                    <li key={`${p.zone_id}-${p.proposed_state}`}>{p.reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1">No new proposals.</p>
              )}
              {fire.considered?.filter((c) => c.outcome !== "proposed").length ? (
                <p className="mt-1 text-xs text-neutral-500">
                  Not proposed:{" "}
                  {fire.considered
                    .filter((c) => c.outcome !== "proposed")
                    .map((c) => `${c.zone} (${c.hours} h, ${c.outcome})`)
                    .join("; ")}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-neutral-500">
              The fire model draws 1, 3 and 6 h downwind ellipses from a seeded Santa Monica perimeter: zones in the 1 h envelope are proposed
              Order, 3 h Warning, 6 h Watch, only when the zone is lower on the ladder.
            </p>
          )}
        </Card>

        <Card title="ArcGIS feeds (GeoJSON by URL)">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-neutral-500">Public base URL (what ArcGIS Online will fetch)</span>
            <input
              className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-950"
              value={base}
              onChange={(e) => saveBase(e.target.value)}
              placeholder="https://your-app.vercel.app"
            />
          </label>
          {isLocal ? (
            <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              ArcGIS Online is an https site: a shared web map needs a public HTTPS feed URL, not a local or LAN address. Use the deployed URL
              or a tunnel (see docs/ARCGIS.md).
            </p>
          ) : null}
          <ul className="mt-3 flex flex-col gap-2">
            {FEEDS.map((f) => {
              const url = feedUrl(f.name);
              return (
                <li key={f.name} className="rounded border border-neutral-200 p-2 dark:border-neutral-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{f.name}.geojson</span>
                    <span className="flex gap-1">
                      <Button
                        tone="quiet"
                        className="!px-2 !py-0.5 text-xs"
                        onClick={async () => {
                          const ok = await copyText(url);
                          setCopied(ok ? f.name : null);
                          if (!ok) window.prompt("Copy the feed URL", url);
                          setTimeout(() => setCopied(null), 1500);
                        }}
                      >
                        {copied === f.name ? "Copied" : "Copy"}
                      </Button>
                      <a href={url} target="_blank" rel="noreferrer" className="rounded px-2 py-0.5 text-xs text-sky-700 underline dark:text-sky-400">
                        Open
                      </a>
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] break-all text-neutral-600 dark:text-neutral-400">{url}</div>
                  <div className="text-xs text-neutral-500">{f.what}</div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-neutral-500">Set the layer refresh interval to 1 minute in the web map. The token is in the URL; share it only with the EOC.</p>
        </Card>

        <Card title="Exports">
          <div className="flex flex-wrap gap-2 text-sm">
            <a className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800" href="/api/export/csv?kind=registry">
              Registry CSV (with phones)
            </a>
            <a className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800" href="/api/export/csv?kind=households">
              Households CSV
            </a>
            <a className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800" href="/api/export/csv?kind=ledger">
              Ledger CSV
            </a>
            <a className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800" href="/api/evidence?format=csv">
              Evidence CSV
            </a>
          </div>
          <div className="mt-4 text-xs font-semibold text-neutral-500">CAP 1.2 (status Exercise)</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <select
              className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-950"
              value={capZone}
              onChange={(e) => setCapZone(e.target.value)}
            >
              <option value="">Choose a zone…</option>
              {board?.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({STATE_SHORT[z.state]})
                </option>
              ))}
            </select>
            <a
              aria-disabled={!capZone}
              className={`rounded-md border px-3 py-1.5 ${capZone ? "border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800" : "pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-800"}`}
              href={capZone ? `/api/export/cap?zone_id=${encodeURIComponent(capZone)}` : undefined}
              target="_blank"
              rel="noreferrer"
            >
              Zone CAP
            </a>
          </div>
          {board?.holds.length ? (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {board.holds.slice(0, 5).map((h) => (
                <li key={h.id}>
                  <a className="text-sky-700 underline dark:text-sky-400" href={`/api/export/cap?hold_id=${h.id}`} target="_blank" rel="noreferrer">
                    Hold CAP: {h.polygon_label} ({h.status})
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-neutral-500">Hold CAP links appear once a hold has opened.</p>
          )}
        </Card>

        <Card title="Activity">
          {log.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {log.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-mono text-xs text-neutral-500">{clock(l.at)}</span>
                  <span className={l.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}>{l.ok ? "✓" : "✗"}</span>
                  <span>
                    <b>{l.label}</b> — {l.detail}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">Actions you take here are listed with their result.</p>
          )}
          {busy ? <p className="mt-2 text-xs text-neutral-500">Working: {busy}…</p> : null}
        </Card>
      </div>
    </main>
  );
}
