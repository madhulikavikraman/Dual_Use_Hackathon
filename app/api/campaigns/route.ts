import { z } from "zod";
import { db } from "@/lib/db";
import { startCampaign } from "@/lib/engine/campaigns";
import { body, handle, json, notFound } from "@/lib/http";

const Body = z.object({
  zone_id: z.string(),
  kind: z.enum(["warning", "order", "rollcall", "test", "checkin", "shelter", "all_clear"]),
  wave: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  started_by: z.string().trim().min(1, "name required"),
});

/** POST /api/campaigns — start a wave (Stage 2 check = warning wave 2), a roll call, or monthly test calls. */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req, Body);
    const zone = await db().get("zones", b.zone_id);
    if (!zone) throw notFound("zone");
    const wave = b.wave ?? (b.kind === "warning" ? 1 : b.kind === "order" ? 3 : null);
    return json(await startCampaign({ zone, kind: b.kind, wave, started_by: b.started_by }));
  });
}
