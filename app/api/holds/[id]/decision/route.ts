import { z } from "zod";
import { decideHold } from "@/lib/engine/holds";
import { body, handle, json } from "@/lib/http";

const Polygon = z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))) });
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
