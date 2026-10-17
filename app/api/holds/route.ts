import { z } from "zod";
import { openHold } from "@/lib/engine/holds";
import { body, handle, json } from "@/lib/http";

const Body = z.object({
  zone_id: z.string(),
  proposed_state: z.enum(["order", "shelter_in_place"]),
  alert_text: z.string().optional(),
  directive_text: z.string().optional(),
  move_text: z.string().optional(),
  evac_point: z.string().nullable().optional(),
  opened_by: z.string().trim().min(1, "name required"),
  reason: z.string().trim().min(1, "reason required"),
  polygon: z.enum(["zone", "county"]).optional(),
});

/** POST /api/holds — open a hold: sentinels at the polygon's edges, the dose preview, a 90 s timer. */
export async function POST(req: Request) {
  return handle(async () => json(await openHold(await body(req, Body))));
}
