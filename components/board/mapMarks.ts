// Leaflet helpers for the map layers. Client-only (imports leaflet); loaded with the map chunk.
// react-leaflet re-applies a style, icon or position only when the object identity changes, and the
// board polls every second, so every derived object is cached by value here.
import { divIcon, type DivIcon, type LatLngTuple, type PathOptions } from "leaflet";
import { centroidOf } from "@/lib/geo";

const latLngCache = new Map<string, LatLngTuple[][]>();
const centroidCache = new Map<string, LatLngTuple>();
const iconCache = new Map<string, DivIcon>();
const styleCache = new Map<string, PathOptions>();

/** GeoJSON [lng, lat] rings to Leaflet [lat, lng] rings. */
export function latLngs(geom: GeoJSON.Polygon): LatLngTuple[][] {
  const key = JSON.stringify(geom.coordinates);
  let v = latLngCache.get(key);
  if (!v) {
    v = geom.coordinates.map((ring) => ring.map(([lng, lat]) => [lat, lng] as LatLngTuple));
    latLngCache.set(key, v);
  }
  return v;
}

export function centre(geom: GeoJSON.Polygon): LatLngTuple {
  const key = JSON.stringify(geom.coordinates);
  let v = centroidCache.get(key);
  if (!v) {
    const [lng, lat] = centroidOf(geom);
    v = [lat, lng];
    centroidCache.set(key, v);
  }
  return v;
}

/** A zero-size divIcon whose HTML is centred on the point (see .sk-anchor in map.css). */
export function icon(html: string): DivIcon {
  let v = iconCache.get(html);
  if (!v) {
    v = divIcon({ html, className: "sk-anchor", iconSize: [0, 0] });
    iconCache.set(html, v);
  }
  return v;
}

export function pathStyle(options: PathOptions): PathOptions {
  const key = JSON.stringify(options);
  let v = styleCache.get(key);
  if (!v) {
    v = options;
    styleCache.set(key, v);
  }
  return v;
}

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ENTITIES[c]);

/** "south,west,north,east" rounded, so an unchanged extent gives an identical string between polls. */
export function boxOf(polygons: GeoJSON.Polygon[]): string | null {
  let s = Infinity;
  let w = Infinity;
  let n = -Infinity;
  let e = -Infinity;
  for (const p of polygons) {
    for (const ring of p.coordinates) {
      for (const [lng, lat] of ring) {
        s = Math.min(s, lat);
        n = Math.max(n, lat);
        w = Math.min(w, lng);
        e = Math.max(e, lng);
      }
    }
  }
  return Number.isFinite(s) ? [s, w, n, e].map((x) => x.toFixed(4)).join(",") : null;
}

/** Same as boxOf for points ([lat, lng]); at least ~1 km across so a single pin is not over-zoomed. */
export function boxOfPoints(points: LatLngTuple[]): string | null {
  if (!points.length) return null;
  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  const pad = 0.005;
  const [s, n] = [Math.min(...lats) - pad, Math.max(...lats) + pad];
  const [w, e] = [Math.min(...lngs) - pad, Math.max(...lngs) + pad];
  return [s, w, n, e].map((x) => x.toFixed(4)).join(",");
}

export function parseBox(box: string): [LatLngTuple, LatLngTuple] {
  const [s, w, n, e] = box.split(",").map(Number);
  return [
    [s, w],
    [n, e],
  ];
}

// ---------- HTML for the marks ----------

export const diamondHtml = (color: string, pulse: boolean, device: boolean) =>
  `<div class="sk-diamond${device ? " sk-device" : ""}${pulse ? " sk-ring" : ""}" style="--c:${color}"></div>`;

export const triangleHtml = (color: string, pulse: boolean) =>
  `<div class="${pulse ? "sk-ring" : ""}" style="--c:${color};border-radius:4px"><svg class="sk-tri" width="20" height="18" viewBox="0 0 20 18" aria-hidden="true"><path d="M10 1.5 L18.5 16.5 H1.5 Z" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg></div>`;

export const helpPinHtml = (priority: 1 | 2 | 3 | 4, color: string, fresh: boolean, done: boolean, selected: boolean) =>
  `<div class="sk-help${fresh ? "" : " sk-stale"}${done ? " sk-done" : ""}${selected ? " sk-selected" : ""}" style="--c:${color};--t:${priority === 3 ? "#111827" : "#fff"}">${priority}</div>`;

/** A registry row whose last fix is live GPS from the person's link: the same numbered pin in a pulsing blue ring. */
export const liveHelpPinHtml = (priority: 1 | 2 | 3 | 4, color: string, fresh: boolean, done: boolean, selected: boolean) =>
  `<div class="sk-live${fresh && !done ? " sk-live-on" : ""}${selected ? " sk-selected" : ""}"><div class="sk-help${fresh ? "" : " sk-stale"}${done ? " sk-done" : ""}" style="--c:${color};--t:${priority === 3 ? "#111827" : "#fff"}">${priority}</div><span class="sk-live-tag">GPS</span></div>`;

/** The plain live-GPS dot (helper page): blue, pulsing while fresh. */
export const liveDotHtml = (fresh: boolean) => `<div class="sk-live-dot${fresh ? " sk-live-on" : ""}"></div>`;

export const countHtml = (color: string, text: string) => `<div class="sk-hex-count" style="--c:${color}">${esc(text)}</div>`;

export const epHtml = () => `<div class="sk-ep">EP</div>`;

export function holdLabelHtml(label: string, dose: string) {
  return `<div class="sk-hold-label">HOLD · ${esc(label)}<br/>wakes about ${esc(dose)}</div>`;
}

export function zoneLabelHtml(input: {
  name: string;
  state: string;
  color: string;
  text: string;
  proposal: { state: string; color: string; reason: string; more: number } | null;
}) {
  const p = input.proposal;
  const proposal = p
    ? `<div class="sk-proposal" style="--c:${p.color}"><span class="sk-proposal-badge">Proposed by model — needs a human</span><span class="sk-proposal-state">→ ${esc(p.state)}${p.more ? ` <i>+${p.more} more</i>` : ""}</span><span class="sk-proposal-reason">${esc(p.reason)}</span></div>`
    : "";
  return `<div class="sk-zone-label"><div class="sk-zone-title"><span class="sk-zone-name">${esc(input.name)}</span><span class="sk-zone-state" style="background:${input.color};color:${input.text}">${esc(input.state)}</span></div>${proposal}</div>`;
}
