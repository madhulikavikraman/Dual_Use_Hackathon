"use client";

// /phones — the device sheet for setting up volunteers: the scenario's six device households with a QR
// code each (to /phone/<id>), who they play, live presence (the phone page's heartbeat), and a picker to
// open any household's phone page for testing. Reads GET /api/board.

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { BoardSnapshot, HouseholdView } from "@/lib/contracts";
import { languageByCode } from "@/lib/languages";
import Qr from "./Qr";

const POLL_MS = 3000;
const ONLINE_MS = 10_000;
const PUBLIC_LINE_LABEL = "Public line";
const BASE_KEY = "secondkey.qrBase";
const BASE_EVENT = "secondkey:qr-base";

function subscribeBase(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(BASE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(BASE_EVENT, cb);
  };
}
function readBase(): string {
  try {
    return localStorage.getItem(BASE_KEY) ?? "";
  } catch {
    return "";
  }
}
function writeBase(v: string) {
  try {
    if (v) localStorage.setItem(BASE_KEY, v);
    else localStorage.removeItem(BASE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(BASE_EVENT));
}
const noop = () => () => {};

const ROLE: Record<string, { label: string; tone: string; what: string }> = {
  resident: { label: "Resident", tone: "bg-sky-100 text-sky-900", what: "Gets the evacuation calls for their zone." },
  sentinel: { label: "Sentinel", tone: "bg-violet-100 text-violet-900", what: "Asked during a hold: does the alert match what you see?" },
  canary: { label: "Canary", tone: "bg-amber-100 text-amber-900", what: "Outside the zone: asked if the alert reached them." },
  staff: { label: "Staff", tone: "bg-slate-200 text-slate-900", what: "Response team." },
};

function ago(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

function maskPhone(p: string | null): string {
  return p ? `real phone …${p.slice(-4)}` : "browser only";
}

export default function DeviceSheet() {
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const savedBase = useSyncExternalStore(subscribeBase, readBase, () => "");
  const base = (savedBase || origin).replace(/\/+$/, "");
  const [baseDraft, setBaseDraft] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const res = await fetch("/api/board", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as BoardSnapshot;
        if (stopped) return;
        setBoard(data);
        setError(null);
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : String(e));
      }
      if (!stopped) timer = window.setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  // The engine gives public-line callers (browser /call and Retell inbound) a device row labelled
  // "Public line"; they are not volunteers, so they get their own short list.
  const devices = useMemo(
    () =>
      (board?.households ?? [])
        .filter((h) => h.has_device && h.device_label !== PUBLIC_LINE_LABEL)
        .sort((a, b) => (a.device_label ?? a.name).localeCompare(b.device_label ?? b.name, undefined, { numeric: true })),
    [board],
  );
  const callers = useMemo(
    () =>
      (board?.households ?? [])
        .filter((h) => h.device_label === PUBLIC_LINE_LABEL)
        .sort((a, b) => (b.presence_at ?? "").localeCompare(a.presence_at ?? "")),
    [board],
  );
  const everyone = useMemo(
    () =>
      [...(board?.households ?? [])].sort(
        (a, b) => Number(b.has_device) - Number(a.has_device) || a.name.localeCompare(b.name),
      ),
    [board],
  );

  // Presence is judged on the server clock (board.now), so a laptop with a skewed clock reads it right.
  const serverNow = board ? Date.parse(board.now) : 0;
  const online = (h: HouseholdView) => Boolean(h.presence_at && serverNow - Date.parse(h.presence_at) < ONLINE_MS);
  const onlineCount = devices.filter(online).length;
  const host = (() => {
    try {
      return base ? new URL(base) : null;
    } catch {
      return null;
    }
  })();
  const isLocal = Boolean(host && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host.hostname));
  const notHttps = Boolean(host && host.protocol !== "https:" && !isLocal);
  const phoneUrl = (id: string) => `${base}/phone/${id}`;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      setCopied(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 text-slate-900 sm:p-6 print:p-0">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500">VoiceFlare · device sheet</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Volunteer phones</h1>
          <p className="mt-1 text-slate-600">
            Scan a code with the volunteer&apos;s phone and tap <em>Tap to enable sound</em>: it plays a test ring and
            voice. No sound? Turn off Silent mode (the switch on the side of an iPhone) and turn the volume up. Then
            leave the page open.
            {board && (
              <>
                {" "}
                Scenario <strong>{board.meta.scenario}</strong> · {onlineCount}/{devices.length} online ·{" "}
                {board.retell ? "real-phone calls (Retell) on" : "browser phones only (Retell not configured)"}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Link href="/call" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Public line
          </Link>
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium">
            Print
          </button>
        </div>
      </header>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800 ring-1 ring-red-200 print:hidden">
          Board unreachable ({error}). Retrying…
        </p>
      )}
      {board?.meta.autopilot_devices && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 print:hidden">
          <strong>Autopilot is on:</strong> the simulator answers for these phones, so their pages will not ring. Turn
          off <em>Autopilot devices</em> on <Link href="/demo" className="font-medium underline underline-offset-2">/demo</Link>{" "}
          before the volunteers&apos; run.
        </p>
      )}
      {isLocal && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 print:hidden">
          These codes point at <strong>{base}</strong>, which phones cannot open. Open this sheet from the public HTTPS
          address (the tunnel, see docs/RETELL.md) or set the base URL below.
        </p>
      )}
      {notHttps && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 print:hidden">
          <strong>{base}</strong> is not HTTPS: phones will block the microphone and keep-awake. Use the https tunnel URL.
        </p>
      )}

      <form
        className="mt-4 flex flex-wrap items-center gap-2 text-sm print:hidden"
        onSubmit={(e) => {
          e.preventDefault();
          writeBase((baseDraft ?? "").trim().replace(/\/+$/, ""));
          setBaseDraft(null);
        }}
      >
        <label htmlFor="qr-base" className="text-slate-600">
          QR base URL
        </label>
        <input
          id="qr-base"
          value={baseDraft ?? savedBase}
          onChange={(e) => setBaseDraft(e.target.value)}
          placeholder={origin || "https://your-tunnel.trycloudflare.com"}
          className="min-w-64 flex-1 rounded-lg px-3 py-2 ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
        <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white">
          Use
        </button>
        {savedBase && (
          <button type="button" onClick={() => writeBase("")} className="rounded-lg bg-slate-200 px-3 py-2 font-medium">
            Reset to this page
          </button>
        )}
      </form>

      {!board && !error && <p className="mt-8 text-slate-500">Loading the roster…</p>}
      {board && devices.length === 0 && (
        <p className="mt-8 text-slate-500">No device households in this scenario. Reset the demo (POST /api/demo/reset).</p>
      )}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 print:gap-2">
        {devices.map((h) => {
          const role = ROLE[h.role] ?? ROLE.resident;
          const lang = languageByCode(h.lang_code);
          const isOnline = online(h);
          const url = phoneUrl(h.id);
          return (
            <li key={h.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:break-inside-avoid print:shadow-none">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{h.device_label ?? "Device"}</p>
                  <p className="truncate text-slate-700">{h.name}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isOnline ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                  }`}
                  title={h.presence_at ? `last heartbeat ${h.presence_at}` : "never opened"}
                >
                  {isOnline ? "● online" : h.presence_at ? `○ ${ago(serverNow - Date.parse(h.presence_at))}` : "○ not opened"}
                </span>
              </div>
              <div className="flex gap-4">
                <a href={url} target="_blank" rel="noreferrer" className="shrink-0" title={url}>
                  <Qr url={url} size={136} />
                </a>
                <dl className="min-w-0 space-y-1 text-sm">
                  <div>
                    <dt className="sr-only">Role</dt>
                    <dd>
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${role.tone}`}>{role.label}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="sr-only">Language</dt>
                    <dd className="font-medium">
                      {lang.native}
                      {lang.native !== lang.name ? <span className="font-normal text-slate-500"> · {lang.name}</span> : null}
                      {lang.voice === "thin" && <span className="ml-1 text-xs text-amber-700">(text mode likely)</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="sr-only">Zone</dt>
                    <dd className="text-slate-600">Zone {h.zone_id ?? "outside the zones"}</dd>
                  </div>
                  <div className="text-xs text-slate-500">{role.what}</div>
                  <div className="text-xs text-slate-500">
                    {maskPhone(h.phone_e164)}
                    {h.call_state ? ` · call ${h.call_state}` : ""}
                  </div>
                </dl>
              </div>
              <div className="flex gap-2 print:hidden">
                <Link href={`/phone/${h.id}`} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => void copy(url, h.id)}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium ring-1 ring-slate-200"
                >
                  {copied === h.id ? "Copied" : "Copy link"}
                </button>
              </div>
              <p className="hidden break-all text-[10px] text-slate-500 print:block">{url}</p>
            </li>
          );
        })}
      </ul>

      <section className="mt-8 grid gap-6 lg:grid-cols-2 print:hidden">
        <div className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-semibold">Open any household&apos;s phone (testing)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Only device households and public-line callers ring in the browser. The simulator answers every call to a
            synthetic household, so its page only waits.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="w-full min-w-0 flex-1 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-300 sm:w-auto"
              aria-label="Household"
            >
              <option value="">Choose a household…</option>
              {everyone.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.has_device ? `${h.device_label} · ` : ""}
                  {h.name} · {h.language} · {h.zone_id ?? "no zone"}
                  {h.synthetic ? " · simulator answers" : ""}
                </option>
              ))}
            </select>
            {pick ? (
              <Link href={`/phone/${pick}`} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                Open phone page
              </Link>
            ) : (
              <span className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500">Open phone page</span>
            )}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <Qr url={`${base}/call`} size={112} />
          <div>
            <h2 className="font-semibold">Public line in the browser</h2>
            <p className="mt-1 text-sm text-slate-600">
              Anyone can call the line: pick a language and the agent answers. Same agent, same seven tools.
            </p>
            <p className="mt-1 break-all text-xs text-slate-500">{base}/call</p>
          </div>
        </div>
      </section>

      {callers.length > 0 && (
        <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:hidden">
          <h2 className="font-semibold">Public line callers ({callers.length})</h2>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {callers.slice(0, 12).map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {h.name} · {languageByCode(h.lang_code).native}
                  {h.call_state ? <span className="text-slate-500"> · call {h.call_state}</span> : null}
                </span>
                <span className="flex items-center gap-3">
                  <span className={online(h) ? "text-emerald-700" : "text-slate-400"}>
                    {online(h) ? "● online" : h.presence_at ? `○ ${ago(serverNow - Date.parse(h.presence_at))}` : "○"}
                  </span>
                  <Link href={`/phone/${h.id}`} className="font-medium text-slate-900 underline underline-offset-2">
                    Open
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
