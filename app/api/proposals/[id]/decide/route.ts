import { z } from "zod";
import { decideProposal } from "@/lib/engine/zones";
import { body, handle, json } from "@/lib/http";

const Body = z.object({
  decision: z.enum(["approve", "reject"]),
  actor: z.string().trim().min(1, "name required"),
  reason: z.string().trim().min(1, "reason required"),
  directive_text: z.string().optional(),
  move_text: z.string().optional(),
  evac_point: z.string().nullable().optional(),
});

/** POST /api/proposals/[id]/decide — a human approves or rejects a model proposal (rejections are logged). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    return json(await decideProposal(id, await body(req, Body)));
  });
}
