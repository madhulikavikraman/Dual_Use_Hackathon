import "server-only";
import { serverEnv } from "@/lib/env";

// Stated-location geocoding (PRD 11, D-12): a small demo gazetteer first (instant and offline for the
// places the demo script uses), then the ArcGIS World Geocoding service (good at intersections), then
// Nominatim. Callers fall back to the enrolled address, then the zone centroid.

export interface GeoHit {
  lat: number;
  lng: number;
  label: string;
  source: "gazetteer" | "arcgis" | "nominatim";
  accuracy_m: number;
}

const GAZETTEER: { keys: string[]; lng: number; lat: number; label: string }[] = [
  { keys: ["venice and sepulveda", "venice & sepulveda", "venice blvd and sepulveda", "sepulveda and venice"], lng: -118.415, lat: 34.0098, label: "Venice Blvd & Sepulveda Blvd" },
  { keys: ["venice and overland", "overland and venice"], lng: -118.4045, lat: 34.0175, label: "Venice Blvd & Overland Ave" },
  { keys: ["motor and national", "national and motor"], lng: -118.4108, lat: 34.0262, label: "Motor Ave & National Blvd" },
  { keys: ["culver city hall", "downtown culver city"], lng: -118.3965, lat: 34.0211, label: "Culver City City Hall" },
  { keys: ["palms park", "palms recreation center"], lng: -118.4033, lat: 34.0268, label: "Palms Recreation Center" },
  { keys: ["sony pictures", "sony studios"], lng: -118.3998, lat: 34.0178, label: "Sony Pictures Studios" },
  { keys: ["mar vista park", "mar vista recreation"], lng: -118.4318, lat: 34.0036, label: "Mar Vista Recreation Center" },
  { keys: ["westchester recreation", "westchester rec"], lng: -118.418, lat: 33.9597, label: "Westchester Recreation Center" },
  { keys: ["santa monica pier"], lng: -118.4973, lat: 34.0092, label: "Santa Monica Pier" },
  { keys: ["pico and la brea", "la brea and pico"], lng: -118.3443, lat: 34.0476, label: "Pico Blvd & La Brea Ave" },
  { keys: ["pico and crenshaw", "crenshaw and pico"], lng: -118.3305, lat: 34.0478, label: "Pico Blvd & Crenshaw Blvd" },
  { keys: ["leavey library", "leavey"], lng: -118.2829, lat: 34.0218, label: "Leavey Library, USC" },
  { keys: ["doheny library", "doheny"], lng: -118.2837, lat: 34.0201, label: "Doheny Library, USC" },
  { keys: ["usc village"], lng: -118.2855, lat: 34.0258, label: "USC Village" },
  { keys: ["tommy trojan"], lng: -118.2854, lat: 34.0206, label: "Tommy Trojan, USC" },
  { keys: ["parkside", "residential west"], lng: -118.2905, lat: 34.0188, label: "Residential West, USC" },
  { keys: ["lincoln and highview", "highview and lincoln"], lng: -118.1589, lat: 34.1905, label: "Lincoln Ave & Highview Ave, Altadena" },
];

const norm = (s: string) => s.toLowerCase().replace(/[.,]/g, " ").replace(/\bboulevard\b/g, "blvd").replace(/\bavenue\b/g, "ave").replace(/\s+/g, " ").trim();

function gazetteer(text: string): GeoHit | null {
  const t = norm(text).replace(/\bblvd\b|\bave\b|\bst\b/g, "").replace(/\s+/g, " ");
  for (const g of GAZETTEER) {
    if (g.keys.some((k) => t.includes(norm(k).replace(/\bblvd\b|\bave\b|\bst\b/g, "").replace(/\s+/g, " ")))) {
      return { lat: g.lat, lng: g.lng, label: g.label, source: "gazetteer", accuracy_m: 60 };
    }
  }
  return null;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]).catch(() => null);
}

async function arcgis(text: string, near: [number, number]): Promise<GeoHit | null> {
  const key = serverEnv().ARCGIS_API_KEY;
  const params = new URLSearchParams({
    f: "json", singleLine: text, maxLocations: "1", outFields: "Match_addr,Addr_type", location: `${near[0]},${near[1]}`,
    ...(key ? { token: key } : {}),
  });
  const base = key
    ? "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates"
    : "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
  const res = await fetch(`${base}?${params}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { candidates?: { location: { x: number; y: number }; score: number; address: string }[] };
  const c = data.candidates?.[0];
  if (!c || c.score < 80) return null;
  return { lat: c.location.y, lng: c.location.x, label: c.address, source: "arcgis", accuracy_m: 50 };
}

async function nominatim(text: string): Promise<GeoHit | null> {
  const params = new URLSearchParams({
    format: "json", limit: "1", q: text, viewbox: "-118.95,34.85,-117.6,33.65", bounded: "1",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "VoiceFlare-hackathon-demo/0.1 (USC Dual-Use Hackathon)" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const d = data[0];
  return d ? { lat: +d.lat, lng: +d.lon, label: d.display_name, source: "nominatim", accuracy_m: 150 } : null;
}

/** Geocode a stated location ("Venice and Sepulveda"). `near` biases results ([lng, lat]). */
export async function geocode(text: string | null | undefined, near: [number, number] = [-118.4, 34.02]): Promise<GeoHit | null> {
  if (!text || !text.trim()) return null;
  const hit = gazetteer(text);
  if (hit) return hit;
  const q = /los angeles|culver|santa monica|california|\bca\b/i.test(text) ? text : `${text}, Los Angeles County, CA`;
  return (await withTimeout(arcgis(q, near), 2500)) ?? (await withTimeout(nominatim(q), 2500));
}
