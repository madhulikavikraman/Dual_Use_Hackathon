import { z } from "zod";
import { patchZone } from "@/lib/engine/zones";
import { body, handle, json } from "@/lib/http";

// A real polygon: at least one ring of 4+ valid [lng, lat] points, closed (first point = last point).
const Polygon = z
  .object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(4)).min(1),
  })
  .refine((p) => {
    const r = p.coordinates[0];
    return r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1];
  }, "the polygon ring must be closed");
const Body = z.object({
  geom: Polygon.optional(),
  directive_text: z.string().optional(),
  move_text: z.string().optional(),
  evac_point: z.string().nullable().optional(),
  fact_sheet: z.string().optional(),
  actor: z.string().trim().min(1, "name required"),
  reason: z.string().trim().min(1, "reason required"),
});

/** PATCH /api/zones/[id] — edit a zone's geometry or approved texts (logged). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const b = await body(req, Body);
    return json(await patchZone(id, { ...b, geom: b.geom as GeoJSON.Polygon | undefined }));
  });
}
