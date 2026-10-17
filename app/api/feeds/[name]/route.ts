import { timingSafeEqual } from "node:crypto";
import { connection, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { STATE_COLOR, STATE_LABEL } from "@/lib/directives";
import { serverEnv } from "@/lib/env";
import { hexCell, hexPolygon } from "@/lib/geo";
import { CORS } from "@/lib/http";
import type { Cluster, HelpRequest, Household, LocationSource, Report, Zone } from "@/lib/types";

// Public GeoJSON feeds for ArcGIS Online (PRD 12, backlog item 63, D-13): add each URL to a web map as a GeoJSON
// layer and set a refresh interval. A token query parameter guards them; CORS is permissive so ArcGIS Online can
// read them from the browser. Privacy (PRD 11 and 20): no phone numbers, no names (not even the approver's), no
// household ids, no free-text caller words. A point is exact only when a person stated it and consented to sharing
// it; an enrolled home address, a sentinel's post or a point without consent is shown at its hex-cell center.

const FEEDS = ["zones", "clusters", "help", "reports"] as const;
type FeedName = (typeof FEEDS)[number];

const GEO_HEADERS = {
  ...CORS,
  "Content-Type": "application/geo+json; charset=utf-8",
  "Cache-Control": "no-store",
};

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: GEO_HEADERS });
}

function tokenOk(given: string | null): boolean {
  const want = Buffer.from(serverEnv().FEED_TOKEN);
  const got = Buffer.from(given ?? "");
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Booleans go out as 1/0: ArcGIS filters and counts integer fields reliably (GeoJSON booleans are not). */
const flag = (b: boolean | null | undefined) => (b ? 1 : 0);

const minutesSince = (iso: string | null | undefined, now: number) =>
  iso ? Math.max(0, Math.round((now - Date.parse(iso)) / 60_000)) : null;

type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, string | number | boolean | null>>;

function collection(name: FeedName, features: Feature[], now: number) {
  return {
    type: "FeatureCollection",
    name: `voiceflare_${name}`,
    // Foreign members (allowed by RFC 7946): when and what this is.
    generated_at: new Date(now).toISOString(),
    simulated: 1,
    note: "VoiceFlare demo feed. Every send is simulated; rows are synthetic except the volunteer phones.",
    features,
  };
}

function zonesFeed(zones: Zone[], openProposals: Map<string, string>, now: number): Feature[] {
  return zones.map((z) => ({
    type: "Feature",
    geometry: z.geom,
    properties: {
      zone_id: z.id,
      name: z.name,
      state: z.state,
      state_label: STATE_LABEL[z.state],
      color: STATE_COLOR[z.state],
      directive: z.directive_text,
      move_text: z.move_text,
      evac_point: z.evac_point,
      population_est: z.population_est,
      area_sq_mi: z.area_sq_mi,
      // Who approved stays on the board and in the ledger; the public feed says only that a named human did.
      human_approved: flag(Boolean(z.approved_by)),
      approved_at: z.approved_at,
      updated_at: z.updated_at,
      age_min: minutesSince(z.approved_at ?? z.updated_at, now),
      open_proposal: openProposals.get(z.id) ?? null,
      simulated: 1,
    },
  }));
}

function clusterLabel(c: Cluster): string {
  if (c.kind === "silence") return "possible tower or power loss";
  return c.corroborated ? "corroborated" : "not confirmed";
}

function clustersFeed(clusters: Cluster[], zones: Map<string, Zone>, now: number): Feature[] {
  return clusters.map((c) => {
    const zone = c.zone_id ? zones.get(c.zone_id) : undefined;
    const geometry = c.kind === "volume" && zone ? zone.geom : hexPolygon(c.center_lat, c.center_lng);
    return {
      type: "Feature",
      geometry,
      properties: {
        cluster_id: c.id,
        kind: c.kind,
        cell: c.cell,
        zone_id: c.zone_id,
        zone_name: zone?.name ?? null,
        count: c.count,
        baseline: c.baseline,
        score: c.score,
        corroborated: flag(c.corroborated),
        sentinel_reads: c.sentinel_reads,
        label: clusterLabel(c),
        status: c.status,
        first_at: c.first_at,
        last_at: c.last_at,
        age_min: minutesSince(c.last_at, now),
      },
    };
  });
}

const PRIORITY_LABEL: Record<number, string> = { 1: "1 life safety", 2: "2 needs help leaving", 3: "3 check later / unreached" };

/** Sources a person gives in the moment; an enrolled address (a home) or a zone centroid is never published exactly. */
const SHAREABLE = new Set<LocationSource>(["stated", "gps_link"]);

function helpFeed(rows: HelpRequest[], now: number): Feature[] {
  return rows
    .filter((r) => r.last_lat !== null && r.last_lng !== null)
    .map((r) => {
      // Exact only with consent for a location the person gave (rows written before enrolled fixes stopped
      // claiming consent may still say true for a home address: those go to the hex cell too).
      const exact = r.last_consent === true && SHAREABLE.has(r.last_source);
      const cell = exact ? null : hexCell(r.last_lat!, r.last_lng!);
      const lng = exact ? r.last_lng! : cell!.lng;
      const lat = exact ? r.last_lat! : cell!.lat;
      const locAge = minutesSince(r.last_observed_at, now);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [+lng.toFixed(6), +lat.toFixed(6)] },
        properties: {
          help_id: r.id,
          priority: r.priority,
          priority_label: PRIORITY_LABEL[r.priority] ?? String(r.priority),
          needs: r.needs.join(", ") || null,
          people: r.people,
          device_battery_hours: r.device_battery_hours,
          status: r.status,
          open: flag(r.status !== "closed" && r.status !== "reached"),
          zone_id: r.zone_id,
          source: r.source,
          location_source: r.last_source,
          precision: exact
            ? "reported"
            : r.last_consent && !SHAREABLE.has(r.last_source)
              ? `hex cell (${r.last_source} location, not stated by the person)`
              : "hex cell (no consent to share the exact location)",
          location_age_min: locAge,
          fresh: flag(locAge !== null && locAge < 15),
          age_min: minutesSince(r.created_at, now),
          created_at: r.created_at,
          updated_at: r.updated_at,
          synthetic: flag(r.synthetic),
        },
      };
    });
}

/**
 * Why a report's point would locate a person rather than a hazard, or null. A sentinel "yes" is filed at the sentinel's
 * enrolled post (publishing it maps the panel whose answers gate an Order); a hazard report with no stated place is
 * filed at the caller's enrolled home.
 */
function personPoint(r: Report, hh: Map<string, Household>): string | null {
  if (r.source === "sentinel") return "sentinel post";
  const h = r.household_id ? hh.get(r.household_id) : undefined;
  if (h && Math.abs(h.lat - r.lat) < 1e-6 && Math.abs(h.lng - r.lng) < 1e-6) return "caller's enrolled address";
  return null;
}

function reportsFeed(rows: Report[], hh: Map<string, Household>, now: number): Feature[] {
  return [...rows]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 2000)
    .map((r) => {
      const cell = hexCell(r.lat, r.lng);
      const why = personPoint(r, hh);
      const [lng, lat] = why ? [cell.lng, cell.lat] : [r.lng, r.lat];
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [+lng.toFixed(6), +lat.toFixed(6)] },
        properties: {
          report_id: r.id,
          type: r.type,
          source: r.source,
          zone_id: r.zone_id,
          cell: cell.key,
          precision: why ? `hex cell (${why})` : "reported",
          synthetic: flag(r.synthetic),
          created_at: r.created_at,
          age_min: minutesSince(r.created_at, now),
        },
      };
    });
}

/** Preflight for browsers (ArcGIS Online reads the feeds cross-origin). */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "86400" } });
}

/** GET /api/feeds/{zones|clusters|help|reports}.geojson?token=... */
export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  await connection();
  try {
    const { name: raw } = await ctx.params;
    const name = raw.replace(/\.geo\.?json$|\.json$/i, "") as FeedName;
    if (!FEEDS.includes(name)) return respond({ error: `Unknown feed "${raw}". Feeds: ${FEEDS.map((f) => `${f}.geojson`).join(", ")}` }, 404);
    if (!tokenOk(req.nextUrl.searchParams.get("token"))) return respond({ error: "Missing or wrong ?token=" }, 401);
    const now = Date.now();
    const s = db();
    switch (name) {
      case "zones": {
        const [zones, proposals] = await Promise.all([s.all("zones"), s.where("proposals", { status: "open" })]);
        const open = new Map<string, string>();
        for (const p of proposals.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))) open.set(p.zone_id, `${STATE_LABEL[p.proposed_state]} (${p.model})`);
        return respond(collection(name, zonesFeed(zones, open, now), now));
      }
      case "clusters": {
        const [clusters, zones] = await Promise.all([s.all("clusters"), s.all("zones")]);
        return respond(collection(name, clustersFeed(clusters, new Map(zones.map((z) => [z.id, z])), now), now));
      }
      case "help":
        return respond(collection(name, helpFeed(await s.all("help_requests"), now), now));
      case "reports": {
        const [reports, households] = await Promise.all([s.all("reports"), s.all("households")]);
        return respond(collection(name, reportsFeed(reports, new Map(households.map((h) => [h.id, h])), now), now));
      }
    }
  } catch (e) {
    console.error("[feeds]", e);
    return respond({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
