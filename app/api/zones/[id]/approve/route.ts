import { z } from "zod";
import { approveZone } from "@/lib/engine/zones";
import { body, handle, json } from "@/lib/http";
import { ZONE_STATES, type ZoneState } from "@/lib/types";

const Body = z.object({
  state: z.enum(ZONE_STATES as [ZoneState, ...ZoneState[]]),
  directive_text: z.string().default(""),
  move_text: z.string().default(""),
  evac_point: z.string().nullable().default(null),
  approved_by: z.string().trim().min(1, "name required"),
  reason: z.string().trim().min(1, "reason required"),
  bypass_hold: z.boolean().optional(),
});

/** POST /api/zones/[id]/approve — a named human moves a zone up or down the ladder (an Order opens a hold). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    return json(await approveZone(id, await body(req, Body)));
  });
}
