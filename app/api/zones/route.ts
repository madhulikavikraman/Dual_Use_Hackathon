import { connection } from "next/server";
import { z } from "zod";
import { db, nowIso } from "@/lib/db";
import { getMeta, ledger } from "@/lib/engine/log";
import { areaSqMi } from "@/lib/geo";
import { body, handle, json } from "@/lib/http";
import type { Zone } from "@/lib/types";

/** GET /api/zones — the current scenario's zones. */
export async function GET() {
  await connection();
  return handle(async () => {
    const meta = await getMeta();
    return json({ zones: (await db().all("zones")).filter((z) => z.scenario === meta.scenario) });
  });
}

const Feature = z.object({
  type: z.literal("Feature"),
  properties: z.object({ id: z.string(), name: z.string(), population_est: z.number().optional(), hazard_origin: z.tuple([z.number(), z.number()]).optional() }).passthrough(),
  geometry: z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))) }),
});
const Body = z.object({ type: z.literal("FeatureCollection"), features: z.array(Feature).min(1), actor: z.string().trim().min(1) });

/**
 * POST /api/zones — import zones from GeoJSON (a FeatureCollection of polygons with id and name). New zones start
 * at Monitor with no directive; a named human approves every state (PRD 6.2). Existing ids keep their state.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req, Body);
    const meta = await getMeta();
    const now = nowIso();
    const existing = new Map((await db().all("zones")).map((z) => [z.id, z]));
    const rows: Zone[] = b.features.map((f) => {
      const geom = f.geometry as GeoJSON.Polygon;
      const prev = existing.get(f.properties.id);
      return {
        ...(prev ?? {
          state: "monitor", directive_text: null, move_text: null, evac_point: null, evac_point_lat: null, evac_point_lng: null,
          fact_sheet: null, source: "human", approved_by: null, approved_at: null, version: 0,
        }),
        id: f.properties.id, name: f.properties.name, scenario: meta.scenario, geom,
        population_est: f.properties.population_est ?? prev?.population_est ?? null,
        area_sq_mi: +areaSqMi(geom).toFixed(2),
        hazard_origin: f.properties.hazard_origin ?? prev?.hazard_origin ?? null,
        version: (prev?.version ?? 0) + 1, updated_at: now,
      } as Zone;
    });
    await db().upsert("zones", rows);
    await ledger({ actor: b.actor, action: `import zones (${rows.length})`, target: rows.map((r) => r.name).join(", ") });
    return json({ imported: rows.length });
  });
}
