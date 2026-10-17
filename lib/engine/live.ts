import "server-only";
// Live incident data for a scenario placed on a real fire (the Norte Fire, Oct 2026): CAL FIRE's public incident list
// and NWS alerts at the ignition point. Read-only and advisory: it goes in the feed, never changes a zone. Each fetch
// has a short timeout and a dated fallback snapshot, so a reset never waits on, or fails because of, the network.

const UA = "VoiceFlare-hackathon-demo (github.com/madhulikavikraman/Dual_Use_Hackathon)";
const CALFIRE_LIST = "https://incidents.fire.ca.gov/umbraco/api/IncidentApi/List?inactive=false";

export interface LiveFire {
  name: string;
  county: string;
  location: string;
  agency: string;
  acres: number | null;
  contained: number | null;
  started: string;
  updated: string;
  lat: number;
  lng: number;
  url: string;
}

export interface LiveAlert {
  event: string;
  headline: string;
}

/** Snapshot from CAL FIRE's incident list, fetched Oct 17, 2026, 9:47 AM PT (used when the live fetch fails). */
export const NORTE_SNAPSHOT: LiveFire = {
  name: "Norte Fire",
  county: "Orange",
  location: "Portico Del Norte & Eminencia Del Norte, San Clemente",
  agency: "Orange County Fire Authority",
  acres: 570,
  contained: 5,
  started: "2026-10-16T18:33:00Z",
  updated: "2026-10-17T16:47:18Z",
  lat: 33.4813,
  lng: -117.63618,
  url: "https://www.fire.ca.gov/incidents/2026/10/16/norte-fire/",
};

async function getJson(url: string, ms: number): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(ms), cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

/** The active CAL FIRE incident whose name matches, or null. */
export async function liveCalFire(match: RegExp, ms = 5000): Promise<LiveFire | null> {
  const list = (await getJson(CALFIRE_LIST, ms)) as Array<Record<string, unknown>>;
  const i = Array.isArray(list) ? list.find((x) => match.test(String(x.Name ?? ""))) : undefined;
  if (!i) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    name: String(i.Name ?? "").trim(),
    county: String(i.County ?? ""),
    location: String(i.Location ?? ""),
    agency: String(i.AdminUnit ?? ""),
    acres: num(i.AcresBurned),
    contained: num(i.PercentContained),
    started: String(i.Started ?? ""),
    updated: String(i.Updated ?? ""),
    lat: Number(i.Latitude),
    lng: Number(i.Longitude),
    url: String(i.Url ?? ""),
  };
}

/** Active NWS alerts at a point (wind, heat, red flag, air quality...). */
export async function liveNwsAlerts(lat: number, lng: number, ms = 5000): Promise<LiveAlert[]> {
  const j = (await getJson(`https://api.weather.gov/alerts/active?point=${lat},${lng}`, ms)) as {
    features?: { properties?: { event?: string; headline?: string } }[];
  };
  return (j.features ?? []).map((f) => ({ event: f.properties?.event ?? "Alert", headline: f.properties?.headline ?? "" }));
}

/** "Oct 17, 9:47 AM PT" */
export function ptTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} PT`;
}
