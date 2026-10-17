import { z } from "zod";
import { approveZone } from "@/lib/engine/zones";
import { body, handle, json } from "@/lib/http";
import { ZONE_STATES, type ZoneState } from "@/lib/types";

const Body = z.object({
  state: z.enum(ZONE_STATES as [ZoneState, ...ZoneState[]]),
  // Omitted texts fall back to the zone's approved defaults (lib/engine/zones.ts).
  directive_text: z.string().max(2000).optional(),
  move_text: z.string().max(2000).optional(),
  evac_point: z.string().max(300).nullable().optional(),
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
