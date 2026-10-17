import "server-only";
import { db, nowIso, uid } from "@/lib/db";
import { HEAT_STATE_LABEL } from "@/lib/directives";
import { centroidOf } from "@/lib/geo";
import { SIMULATED_HEAT, simulatedWeather } from "@/lib/scenarios/heat";
import { HEAT_THRESHOLDS, NWS_HEAT_LEVEL, RANK, SOURCES, deg, heatLevelFor, higher, localClock } from "@/lib/scenarios/heatLadder";
import type { Proposal, WeatherReading, Zone, ZoneState, ZoneWeather } from "@/lib/types";
import { feed, ledger } from "./log";
import { nwsAlertsAtPoint, type PointAlert } from "./nws";

// Heat line: live weather by zone. Open-Meteo (no key) gives the current reading and today's forecast highs at each
// zone's centre; api.weather.gov gives any active alert there. Each fetch has a short timeout and the run never waits
// on, or fails because of, the network: without a live reading the zone keeps the labeled simulated heat wave.
// The threshold table (lib/scenarios/heatLadder.ts, a demo setting) proposes a level; a named human approves it.

const UA = "VoiceFlare-hackathon-demo (github.com/madhulikavikraman/Dual_Use_Hackathon)";
const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 120);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Current reading and today's highs (°F) at each [lng, lat], in one request. Throws on any failure. */
export async function openMeteoReadings(points: [number, number][], ms = 3500): Promise<WeatherReading[]> {
  const lat = points.map((p) => p[1].toFixed(4)).join(",");
  const lng = points.map((p) => p[0].toFixed(4)).join(",");
  const url =
    `${OPEN_METEO}?latitude=${lat}&longitude=${lng}` +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m&daily=temperature_2m_max,apparent_temperature_max" +
    "&temperature_unit=fahrenheit&timezone=America/Los_Angeles&forecast_days=1";
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(ms), cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const body = (await res.json()) as unknown;
  const list = (Array.isArray(body) ? body : [body]) as {
    current?: Record<string, unknown>;
    daily?: Record<string, unknown[]>;
  }[];
  if (list.length !== points.length) throw new Error("Open-Meteo returned a different number of places");
  const fetched_at = nowIso();
  return list.map((x) => {
    const temp = num(x.current?.temperature_2m);
    const feels = num(x.current?.apparent_temperature);
    if (temp === null || feels === null) throw new Error("Open-Meteo reading is missing temperature");
    return {
      temp_f: temp,
      feels_like_f: feels,
      humidity_pct: num(x.current?.relative_humidity_2m),
      high_f: num(x.daily?.temperature_2m_max?.[0]),
      feels_like_high_f: num(x.daily?.apparent_temperature_max?.[0]),
      observed_local: String(x.current?.time ?? ""),
      fetched_at,
    };
  });
}

/** The level an active NWS heat product at the zone proposes (monitor when none). */
function nwsLevel(alerts: PointAlert[] | null): ZoneState {
  let level: ZoneState = "monitor";
  for (const a of alerts ?? []) if (a.event in NWS_HEAT_LEVEL) level = higher(level, NWS_HEAT_LEVEL[a.event]);
  return level;
}

export interface HeatCheck {
  weather: Map<string, ZoneWeather>;
  live_ok: boolean;
  live_error: string | null;
  nws_ok: boolean;
  basis: "live" | "simulated";
}

/**
 * Check the weather for every zone. Live readings drive the ladder only when at least one zone reaches the Heat
 * Advisory threshold (or an NWS heat product is active); otherwise every zone uses the simulated heat wave, labeled,
 * and the live reading is still shown next to it.
 */
export async function checkHeat(zones: Zone[], at = nowIso()): Promise<HeatCheck> {
  const pts = zones.map((z) => centroidOf(z.geom));
  const [om, nws] = await Promise.all([
    openMeteoReadings(pts).then(
      (r) => ({ ok: true as const, r, e: null }),
      (e) => ({ ok: false as const, r: [] as WeatherReading[], e: msg(e) }),
    ),
    Promise.all(pts.map(([lng, lat]) => nwsAlertsAtPoint(lat, lng).catch(() => null))),
  ]);
  const liveFeel = (i: number) => (om.ok ? om.r[i].feels_like_high_f ?? om.r[i].feels_like_f : null);
  const liveLevel = (i: number) => higher(liveFeel(i) === null ? "monitor" : heatLevelFor(liveFeel(i)!), nwsLevel(nws[i]));
  const liveDrives = om.ok && zones.some((_, i) => RANK[liveLevel(i)] >= RANK.warning);

  const weather = new Map<string, ZoneWeather>();
  zones.forEach((z, i) => {
    const base = simulatedWeather(z.id, at, om.ok ? null : om.e);
    const live = om.ok ? om.r[i] : null;
    const alerts = nws[i];
    const feels = liveDrives && live ? (live.feels_like_high_f ?? live.feels_like_f) : (SIMULATED_HEAT[z.id] ?? base.simulated!).feels_like_high_f;
    weather.set(z.id, {
      ...base,
      live,
      live_error: om.ok ? null : om.e,
      nws: (alerts ?? []).map((a) => ({ event: a.event, headline: a.headline, expires: a.expires })),
      nws_checked: alerts !== null,
      simulated: liveDrives && live ? null : base.simulated,
      basis: liveDrives && live ? "live" : "simulated",
      feels_like_high_f: feels,
      proposed: higher(heatLevelFor(feels), nwsLevel(alerts)),
      checked_at: at,
    });
  });
  return { weather, live_ok: om.ok, live_error: om.e, nws_ok: nws.some((a) => a !== null), basis: liveDrives ? "live" : "simulated" };
}

/** Why the model proposes this level: the number, whether it is simulated, the live reading with time, the table row. */
export function proposalReason(w: ZoneWeather): string {
  const row = HEAT_THRESHOLDS.find((t) => t.state === w.proposed);
  const live = w.live ? `live Open-Meteo ${localClock(w.live.observed_local)}: feels like ${deg(w.live.feels_like_f)} now` : "live reading unavailable";
  const used =
    w.basis === "simulated"
      ? `Feels like ${deg(w.feels_like_high_f)} today in the SIMULATED heat wave (${live}).`
      : `Feels like ${deg(w.feels_like_high_f)} today (live forecast, Open-Meteo ${w.live ? localClock(w.live.observed_local) : ""}).`;
  const product = w.nws.find((a) => a.event in NWS_HEAT_LEVEL);
  const table = row && w.feels_like_high_f >= row.min_f ? ` Demo table: ${row.min_f}°F and up proposes ${row.label}.` : "";
  return `${used}${table}${product ? ` NWS: ${product.event} active here.` : ""}`;
}

/**
 * Re-check live weather for the heat zones, store it on each zone, and propose a level where the table (or an NWS
 * heat product) is above the zone's current state. Proposals only: a named human approves. Returns what changed.
 */
export async function runHeatCheck(opts: { actor?: string; at?: string } = {}): Promise<{ check: HeatCheck; proposals: Proposal[] }> {
  const at = opts.at ?? nowIso();
  const zones = (await db().all("zones")).filter((z) => z.scenario === "heat");
  const check = await checkHeat(zones, at);
  const proposals: Proposal[] = [];
  const open = (await db().where("proposals", { status: "open" })).filter((p) => p.model === "heat_threshold");
  for (const z of zones) {
    const w = check.weather.get(z.id)!;
    await db().update("zones", z.id, { weather: w, updated_at: at });
    if (RANK[w.proposed] <= RANK[z.state] || w.proposed === "monitor") continue;
    const reason = proposalReason(w);
    const score = +Math.min(0.95, 0.6 + Math.max(0, w.feels_like_high_f - 90) / 60).toFixed(2);
    const mine = open.find((p) => p.zone_id === z.id);
    if (mine && mine.proposed_state === w.proposed) {
      await db().update("proposals", mine.id, { reason, score });
      continue;
    }
    if (mine) await db().update("proposals", mine.id, { status: "rejected", decided_by: "system", decided_at: at, decision_reason: "Superseded by a newer heat check" });
    const p: Proposal = {
      id: uid(), zone_id: z.id, proposed_state: w.proposed, model: "heat_threshold", reason, score, envelope: null,
      status: "open", decided_by: null, decided_at: null, decision_reason: null, created_at: at,
    };
    await db().insert("proposals", p);
    proposals.push(p);
  }

  await feed({ kind: "info", severity: "info", title: summaryTitle(check, zones), detail: summaryDetail(check, zones) });
  const withNws = zones.filter((z) => check.weather.get(z.id)!.nws.length);
  await feed({
    kind: "info",
    severity: withNws.length ? "warn" : "info",
    title: !check.nws_ok
      ? "NWS alerts unavailable: api.weather.gov did not answer (nothing assumed)"
      : withNws.length
        ? `NWS at the zone centres: ${[...new Set(withNws.flatMap((z) => check.weather.get(z.id)!.nws.map((a) => a.event)))].join(", ")}`
        : "NWS at the zone centres: no active alerts",
    detail: withNws.map((z) => `${z.name}: ${check.weather.get(z.id)!.nws.map((a) => a.headline ?? a.event).join("; ")}`).join(" · ") || `Source: ${SOURCES.nws_alerts.label}.`,
  });
  for (const p of proposals) {
    const z = zones.find((x) => x.id === p.zone_id)!;
    await feed({ kind: "proposal", severity: "warn", zone_id: z.id, title: `Model proposes ${HEAT_STATE_LABEL[p.proposed_state]} for ${z.name}`, detail: `${p.reason} Needs a human.` });
  }
  await ledger({
    actor: opts.actor ?? "system",
    action: `heat check: live weather ${check.live_ok ? "read" : "unavailable"}, ${check.basis === "live" ? "live readings drive the ladder" : "simulated heat wave in use (labeled)"}`,
    kind: "system",
    target: `${zones.length} zones`,
    reason: `${proposals.length} new proposal(s); thresholds are a demo setting`,
  });
  return { check, proposals };
}

function summaryTitle(check: HeatCheck, zones: Zone[]): string {
  if (!check.live_ok) return `Live weather unavailable (${check.live_error}): simulated heat wave in use, labeled on every zone`;
  const r = zones.map((z) => check.weather.get(z.id)!.live!).filter(Boolean);
  const feels = r.map((x) => x.feels_like_f);
  const when = r[0] ? localClock(r[0].observed_local) : "";
  const range = `${deg(Math.min(...feels))}–${deg(Math.max(...feels))}`;
  return check.basis === "live"
    ? `Live weather drives the heat ladder: feels like ${range} now (Open-Meteo, ${when} PT)`
    : `Live weather: feels like ${range} now (Open-Meteo, ${when} PT), below the heat thresholds; SIMULATED heat wave in use`;
}

function summaryDetail(check: HeatCheck, zones: Zone[]): string {
  const rows = zones.map((z) => {
    const w = check.weather.get(z.id)!;
    return `${z.name} ${deg(w.feels_like_high_f)}${w.basis === "simulated" ? " (simulated)" : ""}`;
  });
  const table = HEAT_THRESHOLDS.slice().reverse().map((t) => `${t.min_f}°F ${t.label}`).join(", ");
  return `Feels-like highs used: ${rows.join(", ")}. Thresholds (demo setting, not NWS criteria): ${table}. Sources: ${SOURCES.open_meteo.url}, api.weather.gov.`;
}
