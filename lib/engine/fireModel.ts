import "server-only";
import { destination, ellipse, point } from "@turf/turf";
import { db, nowIso, uid } from "@/lib/db";
import { STATE_LABEL, STATE_RANK } from "@/lib/directives";
import { pointInPolygon } from "@/lib/geo";
import type { AlertItem, Proposal, Zone, ZoneState } from "@/lib/types";
import { feed, getMeta, ledger } from "./log";
import { plansNow, pullBlocksForward } from "./plans";

// Toy fire-spread envelope (PRD 6.2, backlog item 65, D-17): a seeded perimeter in Santa Monica plus the NWS
// hourly wind (live, with a seeded fallback) -> downwind ellipses at 1 h, 3 h and 6 h -> proposals for the
// zones they reach (1 h Order, 3 h Warning, 6 h Watch). Labeled "toy model" everywhere: the head-fire rate and
// the length-to-breadth ratio grow with wind speed, nothing more. It proposes; a named human decides.
// The perimeter's position lives in the latest model card's GeoJSON, so a scenario reset starts it over.

export interface Wind {
  speed_mph: number;
  from_deg: number; // where the wind comes FROM, degrees clockwise from north
  from_label: string; // "west-northwest"
  source: "nws" | "seeded";
  detail: string;
}

export interface FireRun {
  at: string;
  wind: Wind;
  advanced_hours: number; // total, since the scenario was loaded
  center: [number, number];
  created: Proposal[];
  considered: { zone_id: string; zone: string; hours: number; state: ZoneState; outcome: string }[];
  geo: GeoJSON.FeatureCollection;
}

const NWS_POINT = "https://api.weather.gov/points/34.02,-118.49";
const USER_AGENT = "VoiceFlare-hackathon-demo (github.com/madhulikavikraman/voice_flare)";
const PERIMETER_CENTER: [number, number] = [-118.492, 34.036]; // northern Santa Monica (seeded, demo choice)
const HALF_LEN_KM = 0.5;
const HALF_WIDTH_KM = 0.3;
const MODEL_ACTOR = "model (toy fire envelope)";
const REJECT_COOLDOWN_MS = 30 * 60_000; // as pattern watch: do not re-propose what a human just rejected
const HORIZONS: { hours: number; state: ZoneState; score: number }[] = [
  { hours: 1, state: "order", score: 0.85 },
  { hours: 3, state: "warning", score: 0.7 },
  { hours: 6, state: "watch", score: 0.5 },
];

const COMPASS: Record<string, [number, string]> = {
  N: [0, "north"], NNE: [22.5, "north-northeast"], NE: [45, "northeast"], ENE: [67.5, "east-northeast"],
  E: [90, "east"], ESE: [112.5, "east-southeast"], SE: [135, "southeast"], SSE: [157.5, "south-southeast"],
  S: [180, "south"], SSW: [202.5, "south-southwest"], SW: [225, "southwest"], WSW: [247.5, "west-southwest"],
  W: [270, "west"], WNW: [292.5, "west-northwest"], NW: [315, "northwest"], NNW: [337.5, "north-northwest"],
};

export const SEEDED_WIND: Wind = {
  speed_mph: 20,
  from_deg: 292.5,
  from_label: "west-northwest",
  source: "seeded",
  detail: "Seeded wind for the Westside story: offshore, from the west-northwest at 20 mph.",
};

const g = globalThis as unknown as {
  __skWind?: { wind: Wind | null; until: number; why: string };
  __skFireRun?: FireRun;
};

/** The last run, for POST /api/proposals/run to report wind and envelopes. */
export function getLastFireRun(): FireRun | null {
  return g.__skFireRun ?? null;
}

// ---------- wind ----------

function parseSpeedMph(v: unknown): number | null {
  if (v && typeof v === "object" && typeof (v as { value?: unknown }).value === "number") {
    const { value, unitCode } = v as { value: number; unitCode?: string };
    return /km_h/i.test(unitCode ?? "") ? value * 0.621371 : /m_s/i.test(unitCode ?? "") ? value * 2.23694 : value;
  }
  if (typeof v !== "string") return null;
  const m = v.match(/(\d+(?:\.\d+)?)(?:\s*to\s*(\d+(?:\.\d+)?))?\s*(mph|km\/h|kt)?/i);
  if (!m) return null;
  const n = Number(m[2] ?? m[1]); // a range "5 to 10 mph" uses the upper value
  const unit = (m[3] ?? "mph").toLowerCase();
  return unit === "km/h" ? n * 0.621371 : unit === "kt" ? n * 1.15078 : n;
}

async function fetchNwsWind(): Promise<{ wind: Wind | null; why: string }> {
  const signal = AbortSignal.timeout(3000); // one 3 s budget for both requests
  const headers = { "User-Agent": USER_AGENT, Accept: "application/geo+json" };
  try {
    const pt = await fetch(NWS_POINT, { headers, signal, cache: "no-store" });
    if (!pt.ok) return { wind: null, why: `NWS points HTTP ${pt.status}` };
    const hourly = ((await pt.json()) as { properties?: { forecastHourly?: unknown } })?.properties?.forecastHourly;
    // Only follow a link back to api.weather.gov.
    if (typeof hourly !== "string" || !hourly.startsWith("https://api.weather.gov/")) return { wind: null, why: "NWS points: no hourly forecast link" };
    const fc = await fetch(hourly, { headers, signal, cache: "no-store" });
    if (!fc.ok) return { wind: null, why: `NWS hourly HTTP ${fc.status}` };
    const period = ((await fc.json()) as { properties?: { periods?: Record<string, unknown>[] } })?.properties?.periods?.[0];
    const mph = parseSpeedMph(period?.windSpeed);
    const dir = COMPASS[String(period?.windDirection ?? "").trim().toUpperCase()];
    if (mph === null || !dir) return { wind: null, why: `NWS hourly: unusable wind (${String(period?.windSpeed)} ${String(period?.windDirection)})` };
    return {
      wind: {
        speed_mph: Math.round(mph),
        from_deg: dir[0],
        from_label: dir[1],
        source: "nws",
        detail: `NWS hourly forecast for 34.02,-118.49 starting ${String(period?.startTime ?? "now")}: ${String(period?.windSpeed)} from the ${dir[1]}.`,
      },
      why: "ok",
    };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    return { wind: null, why: name === "TimeoutError" || name === "AbortError" ? "NWS timed out after 3 s" : `NWS error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Live NWS wind (cached 10 min; a failure is retried after 1 min), else the seeded wind. */
export async function getWind(mode: "live" | "seeded" = "live"): Promise<Wind> {
  if (mode === "seeded") return SEEDED_WIND;
  const now = Date.now();
  let cached = g.__skWind;
  if (!cached || cached.until < now) {
    const r = await fetchNwsWind();
    cached = { wind: r.wind, why: r.why, until: now + (r.wind ? 10 * 60_000 : 60_000) };
    g.__skWind = cached;
  }
  return cached.wind ?? { ...SEEDED_WIND, detail: `${cached.why}: seeded fallback, from the west-northwest at 20 mph.` };
}

// ---------- geometry ----------

/** Toy head-fire rate of spread (km/h): grows with wind speed. Not a fire-behavior model. */
export const rosKmh = (mph: number) => 0.4 + 0.1 * Math.max(mph, 3); // 20 mph -> 2.4 km/h
/** Toy length-to-breadth ratio: the ellipse gets longer and narrower as the wind rises. */
export const lengthToBreadth = (mph: number) => Math.min(4, 1 + 0.1 * Math.max(mph, 3));

function move(from: [number, number], km: number, bearing: number): [number, number] {
  const c = destination(point(from), km, bearing, { units: "kilometers" }).geometry.coordinates;
  return [+c[0].toFixed(6), +c[1].toFixed(6)];
}

function oval(center: [number, number], alongKm: number, acrossKm: number, bearing: number): GeoJSON.Polygon {
  const poly = ellipse(center, alongKm, acrossKm, { angle: bearing - 90, steps: 48, units: "kilometers" }).geometry;
  return { type: "Polygon", coordinates: [poly.coordinates[0].map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)])] };
}

/** The downwind envelope after `hours`: from just behind the perimeter to the head fire's reach. */
function envelope(center: [number, number], bearing: number, mph: number, hours: number): GeoJSON.Polygon {
  const head = rosKmh(mph) * hours;
  const back = 0.1 + 0.08 * hours;
  const a = (2 * HALF_LEN_KM + head + back) / 2;
  const b = Math.max(a / lengthToBreadth(mph), HALF_WIDTH_KM + 0.1 * hours);
  return oval(move(center, (head - back) / 2, bearing), a, b, bearing);
}

function segmentsCross(p1: number[], p2: number[], p3: number[], p4: number[]): boolean {
  const d = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** True when two simple polygons overlap or touch across an edge (outer rings only). */
export function polygonsIntersect(a: GeoJSON.Polygon, b: GeoJSON.Polygon): boolean {
  const ra = a.coordinates[0];
  const rb = b.coordinates[0];
  if (ra.some(([x, y]) => pointInPolygon(x, y, b)) || rb.some(([x, y]) => pointInPolygon(x, y, a))) return true;
  for (let i = 0; i < ra.length - 1; i++) {
    for (let j = 0; j < rb.length - 1; j++) if (segmentsCross(ra[i], ra[i + 1], rb[j], rb[j + 1])) return true;
  }
  return false;
}

// ---------- state (the last run's card carries the perimeter, so a reset starts over) ----------

interface FireState {
  center: [number, number];
  advanced_hours: number;
  at: number; // when the run that recorded it happened (ms)
}

function stateFromGeo(geo: unknown, at: string): FireState | null {
  const fc = geo as GeoJSON.FeatureCollection | null;
  const props = fc?.type === "FeatureCollection" ? fc.features?.[0]?.properties : null;
  if (!props || props.model !== "fire_envelope" || props.layer !== "perimeter") return null;
  const c = props.center as unknown;
  if (!Array.isArray(c) || c.length !== 2 || !c.every((x) => typeof x === "number")) return null;
  return { center: [c[0], c[1]], advanced_hours: Number(props.advanced_hours) || 0, at: Date.parse(at) || 0 };
}

/** Every recorded run's perimeter, newest first (the first one is where the perimeter is now). */
async function stateHistory(): Promise<FireState[]> {
  const cards: AlertItem[] = await db().where("alerts_feed", { kind: "info" });
  return cards
    .map((c) => stateFromGeo(c.geo, c.created_at))
    .filter((s): s is FireState => s !== null)
    .sort((a, b) => b.at - a.at);
}

// ---------- the model ----------

export async function runFireModel(opts: { advanceHours?: number; wind?: "live" | "seeded" } = {}): Promise<Proposal[]> {
  const meta = await getMeta();
  if (meta.scenario !== "westside") {
    await feed({
      kind: "info",
      title: "Toy fire model runs on the Westside scenario",
      detail: `The seeded perimeter is in Santa Monica; the current scenario is ${meta.scenario}. Nothing was proposed.`,
    });
    return [];
  }
  const [zones, proposals, history] = await Promise.all([db().all("zones"), db().all("proposals"), stateHistory()]);
  const prev = history[0] ?? null;
  /** How far the perimeter had advanced by `at` (the last run recorded before it; 0 before any run). */
  const advancedBy = (at: number) => history.find((s) => s.at <= at)?.advanced_hours ?? 0;
  const wind = await getWind(opts.wind ?? "live");
  const bearing = (wind.from_deg + 180) % 360; // the fire runs downwind
  const adv = Math.max(0, Math.min(24, Number(opts.advanceHours) || 0));
  const center = adv > 0 ? move(prev?.center ?? PERIMETER_CENTER, rosKmh(wind.speed_mph) * adv, bearing) : prev?.center ?? PERIMETER_CENTER;
  const advanced = (prev?.advanced_hours ?? 0) + adv;
  const perimeter = oval(center, HALF_LEN_KM, HALF_WIDTH_KM, bearing);
  const envs = HORIZONS.map((h) => ({ ...h, polygon: envelope(center, bearing, wind.speed_mph, h.hours) }));
  const windText = `wind from the ${wind.from_label} at ${wind.speed_mph} mph, ${wind.source === "nws" ? "NWS hourly forecast" : "seeded"}`;

  const created: Proposal[] = [];
  const considered: FireRun["considered"] = [];
  for (const zone of zones as Zone[]) {
    const hit = envs.find((e) => polygonsIntersect(e.polygon, zone.geom)); // 1 h first: the most severe wins
    if (!hit) continue;
    const base = { zone_id: zone.id, zone: zone.name, hours: hit.hours, state: hit.state };
    if (STATE_RANK[zone.state] >= STATE_RANK[hit.state]) {
      considered.push({ ...base, outcome: `already ${STATE_LABEL[zone.state]}` });
      continue;
    }
    if (proposals.some((p) => p.zone_id === zone.id && p.proposed_state === hit.state && p.status === "open")) {
      considered.push({ ...base, outcome: "same proposal already open" });
      continue;
    }
    // A human rejected this zone and state recently: propose it again only once the perimeter has moved since.
    const now = Date.now();
    const rejected = proposals
      .filter((p) => p.zone_id === zone.id && p.proposed_state === hit.state && p.status === "rejected" && p.decided_at)
      .map((p) => Date.parse(p.decided_at!))
      .filter((at) => Number.isFinite(at) && now - at <= REJECT_COOLDOWN_MS)
      .sort((a, b) => b - a)[0];
    if (rejected !== undefined && advanced <= advancedBy(rejected)) {
      const mins = Math.max(0, Math.round((now - rejected) / 60_000));
      considered.push({ ...base, outcome: `rejected ${mins < 1 ? "just now" : `${mins} min ago`}; the perimeter has not advanced since` });
      continue;
    }
    const reason =
      `Toy model: the ${hit.hours}-hour envelope (${windText}) reaches ${zone.name}` +
      `${advanced ? `; perimeter advanced ${advanced} h downwind` : ""}. Proposes ${STATE_LABEL[hit.state]}.`;
    const p: Proposal = {
      id: uid(),
      zone_id: zone.id,
      proposed_state: hit.state,
      model: "fire_envelope",
      reason,
      score: hit.score,
      envelope: hit.polygon,
      status: "open",
      decided_by: null,
      decided_at: null,
      decision_reason: null,
      created_at: nowIso(),
    };
    await db().insert("proposals", p);
    proposals.push(p);
    created.push(p);
    considered.push({ ...base, outcome: "proposed" });
    await feed({
      kind: "proposal", severity: hit.state === "order" ? "critical" : "warn", zone_id: zone.id, geo: hit.polygon,
      title: `Model proposes ${STATE_LABEL[hit.state]} for ${zone.name}`,
      detail: `${reason} Needs a human.`,
    });
    await ledger({ actor: MODEL_ACTOR, action: `propose zone: ${STATE_LABEL[hit.state]}`, kind: "system", target: zone.name, reason });
  }

  // Block-by-block plans: any block the perimeter or the 1-hour envelope reaches goes now, and later waves reflow.
  // The model may only move people sooner, never later; the ledger names it.
  const pulled: string[] = [];
  const oneHour = envs.find((e) => e.hours === 1)!.polygon;
  for (const plan of await plansNow().catch(() => [])) {
    const hit = plan.blocks.filter(
      (b) => b.status !== "left" && b.status !== "go_now" && (polygonsIntersect(oneHour, b.geom) || polygonsIntersect(perimeter, b.geom)),
    );
    if (!hit.length) continue;
    const r = await pullBlocksForward(plan.zone_id, hit.map((b) => b.id), MODEL_ACTOR,
      `Toy model: the 1-hour envelope (${windText}) reaches ${hit.map((b) => b.id).join(", ")}`).catch((e) => {
      console.error("[plan] pull forward", e);
      return null;
    });
    if (r?.moved.length) pulled.push(...r.moved);
  }

  const geo: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: perimeter,
        properties: {
          layer: "perimeter", model: "fire_envelope", toy: true, center, advanced_hours: advanced,
          wind_mph: wind.speed_mph, wind_from_deg: wind.from_deg, wind_source: wind.source,
        },
      },
      ...envs.map((e) => ({
        type: "Feature" as const,
        geometry: e.polygon,
        properties: { layer: "envelope", model: "fire_envelope", toy: true, hours: e.hours, proposes: e.state },
      })),
    ],
  };
  const skipped = considered.filter((c) => c.outcome !== "proposed");
  await feed({
    kind: "info",
    severity: created.length ? "warn" : "info",
    title: `Toy fire model: 1, 3 and 6 h envelopes (${windText})${advanced ? `, perimeter +${advanced} h` : ""}`,
    detail:
      (created.length
        ? `New proposals: ${created.map((p) => `${zones.find((z) => z.id === p.zone_id)?.name ?? p.zone_id} to ${STATE_LABEL[p.proposed_state]}`).join("; ")}. Each needs a human.`
        : "No new proposals.") +
      (skipped.length ? ` Not proposed: ${skipped.map((c) => `${c.zone} (${c.hours} h, ${c.outcome})`).join("; ")}.` : "") +
      (pulled.length ? ` Blocks pulled forward to go now: ${pulled.join(", ")}.` : "") +
      ` ${wind.detail} Toy model: rate and shape grow with wind speed only.`,
    geo,
  });
  g.__skFireRun = { at: nowIso(), wind, advanced_hours: advanced, center, created, considered, geo };
  return created;
}
