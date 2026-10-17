import { z } from "zod";
import { patchZone } from "@/lib/engine/zones";
import { body, handle, json } from "@/lib/http";

const Polygon = z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))) });
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
