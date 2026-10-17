import { z } from "zod";
import { decideHold } from "@/lib/engine/holds";
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
  decision: z.enum(["send", "hold_once", "edit", "cancel", "hand_off"]),
  actor: z.string().trim().min(1, "name required"),
  reason: z.string().trim().min(1, "reason required"),
  polygon: z.union([Polygon, z.literal("zone")]).optional(),
});

/** POST /api/holds/[id]/decision — Send now, Hold once (+60 s), Edit polygon, Cancel, Hand to authority. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const b = await body(req, Body);
    return json(await decideHold(id, { ...b, polygon: b.polygon as GeoJSON.Polygon | "zone" | undefined }));
  });
}
