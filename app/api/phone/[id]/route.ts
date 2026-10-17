import { connection } from "next/server";
import { z } from "zod";
import { phoneAction, phoneState } from "@/lib/engine/phone";
import { body, handle, json } from "@/lib/http";

/** GET /api/phone/[id] — the browser phone's poll (also its presence heartbeat). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  return handle(async () => {
    const { id } = await ctx.params;
    return json(await phoneState(id));
  });
}

const Body = z.object({
  action: z.enum(["answer", "decline", "say", "hangup"]),
  call_id: z.string(),
  text: z.string().optional(),
});

/** POST /api/phone/[id] — answer, decline, say (speech or typed text), hang up. Returns the agent's next line. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    return json(await phoneAction(id, await body(req, Body)));
  });
}
