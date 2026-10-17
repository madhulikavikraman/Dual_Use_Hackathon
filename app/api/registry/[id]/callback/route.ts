import { z } from "zod";
import { callback } from "@/lib/engine/registry";
import { body, handle, json, notFound } from "@/lib/http";

const Body = z.object({ actor: z.string().trim().min(1, "name required") });

/** POST /api/registry/[id]/callback — the response team calls the person back (logged). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const { actor } = await body(req, Body);
    const call = await callback(id, actor);
    if (!call) throw notFound("registry row with a household");
    return json({ call_id: call.id });
  });
}
