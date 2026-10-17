import { z } from "zod";
import { patchHelp } from "@/lib/engine/registry";
import { body, handle, json, notFound } from "@/lib/http";

const Body = z.object({
  status: z.enum(["open", "assigned", "en_route", "reached", "closed", "unreachable"]).optional(),
  assigned_to: z.string().nullable().optional(),
  actor: z.string().trim().min(1, "name required"),
  reason: z.string().optional(),
});

/** PATCH /api/registry/[id] — assign, en route, reached, close (logged). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const row = await patchHelp(id, await body(req, Body));
    if (!row) throw notFound("registry row");
    return json(row);
  });
}
