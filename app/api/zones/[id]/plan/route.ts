import { connection } from "next/server";
import { z } from "zod";
import { planFor, proposePlan } from "@/lib/engine/plans";
import { refresh } from "@/lib/engine/blocks";
import { body, handle, HttpError, json } from "@/lib/http";

/** GET /api/zones/[id]/plan — the zone's block-by-block plan in use, or null. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  return handle(async () => {
    const { id } = await ctx.params;
    const plan = await planFor(id);
    return json({ plan: plan ? refresh(plan) : null });
  });
}

const Body = z.object({
  actor: z.string().trim().min(1).optional(),
  wave_minutes: z.number().int().min(5).max(60).optional(),
});

/** POST /api/zones/[id]/plan — propose a plan (the system's; a named human approves it). Returns the plan in use if there is one. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const b = await body(req, Body);
    const plan = await proposePlan(id, b.actor ? `${b.actor} (asked the block planner)` : undefined, { wave_minutes: b.wave_minutes });
    if (!plan) throw new HttpError(409, "No exit roads are set up for this zone");
    return json({ plan });
  });
}
