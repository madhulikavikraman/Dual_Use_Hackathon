import { z } from "zod";
import { holdWave } from "@/lib/engine/plans";
import { body, handle, json } from "@/lib/http";

const Body = z.object({
  actor: z.string().trim().min(1, "name required"),
  reason: z.string().trim().min(1, "reason required"),
  release: z.boolean().optional(),
});

/** POST /api/zones/[id]/plan/hold — hold the next wave (the wave going now keeps going), or release it with release: true. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const b = await body(req, Body);
    return json({ plan: await holdWave(id, b.actor, b.reason, b.release ?? false) });
  });
}
