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
  { keys: ["lincoln and highview", "highview and lincoln"], lng: -118.1589, lat: 34.1905, label: "Lincoln Ave & Highview Ave, Altadena" },
  // Norte Fire, San Clemente (lib/scenarios/norte.ts). Points from the ArcGIS World Geocoder, Oct 17, 2026.
  { keys: ["san clemente high"], lng: -117.6167, lat: 33.4399, label: "San Clemente High School" },
  { keys: ["pico and vera cruz", "vera cruz and pico"], lng: -117.6087, lat: 33.4513, label: "Avenida Pico & Camino Vera Cruz, San Clemente" },
  { keys: ["pico and el camino real", "el camino real and pico"], lng: -117.6313, lat: 33.4328, label: "Avenida Pico & El Camino Real, San Clemente" },
  { keys: ["san clemente community center", "calle seville"], lng: -117.6179, lat: 33.4241, label: "San Clemente Community Center, 100 N Calle Seville" },
  { keys: ["forster ranch park", "forster ranch community park"], lng: -117.6237, lat: 33.465, label: "Forster Ranch Community Park" },
  { keys: ["portico del norte", "eminencia del norte"], lng: -117.6362, lat: 33.4813, label: "Portico Del Norte & Eminencia Del Norte, San Clemente" },
  { keys: ["san clemente pier"], lng: -117.622, lat: 33.4184, label: "San Clemente Pier" },
  // Chongqing, Beibei (lib/scenarios/chongqing.ts): demo zone centers and the demo shelter, in WGS-84.
  { keys: ["虎头村", "hutou"], lng: 106.365, lat: 29.775, label: "虎头村 Hutou Village, Xiema, Beibei" },
  { keys: ["歇马", "xiema"], lng: 106.364, lat: 29.766, label: "歇马街道 Xiema Subdistrict, Beibei" },
  { keys: ["北温泉", "beiwenquan"], lng: 106.38, lat: 29.835, label: "北温泉街道 Beiwenquan Subdistrict, Beibei" },
  { keys: ["缙云山", "jinyun"], lng: 106.37, lat: 29.83, label: "缙云山 Jinyun Mountain, Beibei" },
  { keys: ["天生街道", "tiansheng"], lng: 106.43, lat: 29.81, label: "天生街道 Tiansheng Subdistrict, Beibei" },
  { keys: ["朝阳街道", "chaoyang"], lng: 106.445, lat: 29.85, label: "朝阳街道 Chaoyang Subdistrict, Beibei" },
  { keys: ["澄江", "chengjiang"], lng: 106.45, lat: 29.885, label: "澄江镇 Chengjiang Town, Beibei" },
  { keys: ["嘉陵江东岸", "临时安置点"], lng: 106.468, lat: 29.8, label: "嘉陵江东岸临时安置点（演示） demo shelter" },
];

/**
 * Where a geocode searches: the region around the call (the caller's home or enrolled point). Each region carries the
 * suffix added to a bare place name, the box results must fall in, and the words that mean the text already names it.
 * Without this every "school" or "Main Street" resolved in Los Angeles, also for a caller in San Clemente or Chongqing.
 */
interface Region { box: [number, number, number, number]; suffix: string; named: RegExp }
const REGIONS: Region[] = [
  { box: [-117.8, 33.35, -117.45, 33.62], suffix: ", San Clemente, Orange County, CA", named: /san clemente|orange county|california|\bca\b/i },
  { box: [106.2, 29.6, 106.7, 30.0], suffix: ", Beibei, Chongqing, China", named: /重庆|北碚|chongqing|beibei/i },
  { box: [-118.95, 33.65, -117.6, 34.85], suffix: ", Los Angeles County, CA", named: /los angeles|culver|santa monica|california|\bca\b/i },
];
const inBox = (b: Region["box"], lng: number, lat: number) => lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3];
const regionFor = (near: [number, number]) => REGIONS.find((r) => inBox(r.box, near[0], near[1])) ?? REGIONS[REGIONS.length - 1];

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

async function arcgis(text: string, near: [number, number], box: Region["box"]): Promise<GeoHit | null> {
  const key = serverEnv().ARCGIS_API_KEY;
  const params = new URLSearchParams({
    f: "json", singleLine: text, maxLocations: "1", outFields: "Match_addr,Addr_type", location: `${near[0]},${near[1]}`,
    searchExtent: box.join(","),
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

async function nominatim(text: string, box: Region["box"]): Promise<GeoHit | null> {
  const params = new URLSearchParams({
    format: "json", limit: "1", q: text, viewbox: `${box[0]},${box[3]},${box[2]},${box[1]}`, bounded: "1",
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
  // Search the caller's region (San Clemente, Chongqing or Los Angeles) and reject anything outside it.
  const region = regionFor(near);
  const q = region.named.test(text) ? text : `${text}${region.suffix}`;
  const keep = (h: GeoHit | null) => (h && inBox(region.box, h.lng, h.lat) ? h : null);
  return keep(await withTimeout(arcgis(q, near, region.box), 2500)) ?? keep(await withTimeout(nominatim(q, region.box), 2500));
}
