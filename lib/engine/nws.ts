import "server-only";
import { db, nowIso } from "@/lib/db";
import { areaSqMi, centroidOf } from "@/lib/geo";
import type { Zone } from "@/lib/types";
import { getMeta, ledger } from "./log";

// Adopt a live National Weather Service alert polygon as a zone (PRD backlog 8). The zone starts at Monitor
// with no directive: adopting a polygon is not approving an instruction; a named human still does that.

const UA = "VoiceFlare-hackathon-demo (github.com/madhulikavikraman/voice_flare)";

export interface NwsAlert {
  id: string;
  event: string;
  headline: string | null;
  area: string;
  severity: string;
  expires: string | null;
  geom: GeoJSON.Polygon;
}

/** Active NWS alerts with a polygon for an area (state code), newest first. */
export async function activeNwsAlerts(area = "CA"): Promise<NwsAlert[]> {
  const res = await fetch(`https://api.weather.gov/alerts/active?area=${encodeURIComponent(area)}`, {
    headers: { "User-Agent": UA, Accept: "application/geo+json" },
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`NWS alerts HTTP ${res.status}`);
  const data = (await res.json()) as { features?: { id: string; geometry: GeoJSON.Geometry | null; properties: Record<string, unknown> }[] };
  return (data.features ?? [])
    .filter((f) => f.geometry?.type === "Polygon")
    .map((f) => ({
      id: f.id,
      event: String(f.properties.event ?? "Alert"),
      headline: (f.properties.headline as string) ?? null,
      area: String(f.properties.areaDesc ?? ""),
      severity: String(f.properties.severity ?? ""),
      expires: (f.properties.expires as string) ?? null,
      geom: f.geometry as GeoJSON.Polygon,
    }));
}

export interface PointAlert {
  event: string; // e.g. "Heat Advisory", "Extreme Heat Warning" (NWS names since March 4, 2025)
  headline: string | null;
  expires: string | null;
}

/** Active NWS alerts at one point (any geometry: zone- and county-based alerts included). Short timeout; throws on failure. */
export async function nwsAlertsAtPoint(lat: number, lng: number, ms = 3500): Promise<PointAlert[]> {
  const res = await fetch(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`, {
    headers: { "User-Agent": UA, Accept: "application/geo+json" },
    signal: AbortSignal.timeout(ms),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`NWS alerts HTTP ${res.status}`);
  const data = (await res.json()) as { features?: { properties?: Record<string, unknown> }[] };
  return (data.features ?? []).map((f) => ({
    event: String(f.properties?.event ?? "Alert"),
    headline: (f.properties?.headline as string) ?? null,
    expires: (f.properties?.expires as string) ?? null,
  }));
}

/** Adopt one alert's polygon as a Monitor zone in the current scenario. */
export async function adoptNws(alertId: string, actor: string): Promise<Zone> {
  const alert = (await activeNwsAlerts()).find((a) => a.id === alertId);
  if (!alert) throw new Error("That NWS alert is no longer active or has no polygon");
  const meta = await getMeta();
  const id = `NWS-${alertId.split(".").slice(-3).join("").slice(-8).toUpperCase()}`;
  const existing = await db().get("zones", id);
  if (existing) {
    // Re-adopting refreshes the polygon only; the zone's approved state and texts stay as a human left them.
    const next = (await db().update("zones", id, { geom: alert.geom, area_sq_mi: +areaSqMi(alert.geom).toFixed(2), updated_at: nowIso(), version: existing.version + 1 }))!;
    await ledger({ actor, action: "refresh NWS polygon (state and texts unchanged)", target: existing.name, reason: alert.headline ?? alert.id });
    return next;
  }
  const zone: Zone = {
    id, name: `${alert.event}: ${alert.area}`.slice(0, 80), scenario: meta.scenario, geom: alert.geom, state: "monitor",
    directive_text: null, move_text: null, evac_point: null, evac_point_lat: null, evac_point_lng: null,
    fact_sheet: alert.headline, population_est: null, area_sq_mi: +areaSqMi(alert.geom).toFixed(2),
    hazard_origin: centroidOf(alert.geom), source: "nws", approved_by: null, approved_at: null, version: 1, updated_at: nowIso(),
  };
  await db().upsert("zones", zone);
  await ledger({ actor, action: "adopt NWS alert polygon as a zone (Monitor, no directive)", target: zone.name, reason: alert.headline ?? alert.id });
  return zone;
}
