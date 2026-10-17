import { timingSafeEqual } from "node:crypto";
import { connection, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { STATE_LABEL } from "@/lib/directives";
import { serverEnv } from "@/lib/env";
import { clustersFeed, collection, FEEDS, helpFeed, reportsFeed, zonesFeed, type FeedName } from "@/lib/feeds";
import { CORS } from "@/lib/http";

// Public GeoJSON feeds for ArcGIS Online (PRD 12, backlog item 63, D-13): add each URL to a web map as a GeoJSON
// layer and set a refresh interval. A token query parameter guards them; CORS is permissive so ArcGIS Online can
// read them from the browser. Privacy (PRD 11 and 20): no phone numbers, no names (not even the approver's), no
// household ids, no free-text caller words. A point is exact only when a person stated it and consented to sharing
// it; an enrolled home address, a sentinel's post or a point without consent is shown at its hex-cell center.
// Live GPS (a gps_link fix) is never exact here: consent to the live-location link is consent to the response team
// only (the QRT view and the helper's link), not to a public map.

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
