import { z } from "zod";
import { sendHelper } from "@/lib/engine/responders";
import { body, handle, json } from "@/lib/http";
import { requestOrigin } from "@/lib/sms";

const Body = z.object({
  helper_id: z.string().max(40).optional(),
  helper_label: z.string().max(80).optional(),
  helper_phone: z.string().max(20).nullable().optional(),
  actor: z.string().trim().min(1, "name required"),
  reason: z.string().trim().min(1, "reason required"),
});

/** POST /api/registry/[id]/dispatch — send a helper to the row's latest location (a named human and a reason; logged). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const b = await body(req, Body);
    return json(await sendHelper(id, { ...b, origin: await requestOrigin() }));
  });
}
