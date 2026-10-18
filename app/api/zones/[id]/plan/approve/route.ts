import { z } from "zod";
import { approvePlan } from "@/lib/engine/plans";
import { body, handle, json } from "@/lib/http";

const Body = z.object({
  approved_by: z.string().trim().min(1, "name required"),
  reason: z.string().trim().min(1, "reason required"),
  wave_minutes: z.number().int().min(5).max(60).optional(),
  // The human may edit the message templates; {block}, {wave}, {route}, "leave now" and the leave-right-away line are checked.
  templates: z
    .object({
      go_now: z.string().max(600).optional(),
      get_ready: z.string().max(800).optional(),
      get_ready_directive: z.string().max(800).optional(),
      extra_time: z.string().max(600).optional(),
      all_go: z.string().max(600).optional(),
    })
    .optional(),
});

/** POST /api/zones/[id]/plan/approve — a named human approves the block plan and its words. Under an Order, wave 1 goes now. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    return json({ plan: await approvePlan(id, await body(req, Body)) });
  });
}
