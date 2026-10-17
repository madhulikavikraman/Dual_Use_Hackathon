import { z } from "zod";
import { everyoneGoNow } from "@/lib/engine/plans";
import { body, handle, json } from "@/lib/http";

const Body = z.object({ actor: z.string().trim().min(1, "name required"), reason: z.string().trim().min(1, "reason required") });

/** POST /api/zones/[id]/plan/go-now — everyone in the zone leaves now, each block on its own road (logged). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const b = await body(req, Body);
    return json({ plan: await everyoneGoNow(id, b.actor, b.reason) });
  });
}
