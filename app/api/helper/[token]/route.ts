import { connection } from "next/server";
import { z } from "zod";
import { helperUpdate, helperView } from "@/lib/engine/responders";
import { body, handle, HttpError, json } from "@/lib/http";
import { overLimit } from "@/lib/rateLimit";

// The helper's link (/helper/[token]). Open (no desk password): the helper opens it from a text message and the
// unguessable token is their key. GET: the person's latest location and needs. POST: En route, Arrived, Person
// reached, Cannot reach (each a ledger line in the helper's name).

type Ctx = { params: Promise<{ token: string }> };

const Body = z.object({
  status: z.enum(["en_route", "arrived", "reached", "cannot_reach"]),
  note: z.string().max(200).optional(),
});

export async function GET(_req: Request, ctx: Ctx) {
  await connection();
  return handle(async () => {
    const { token } = await ctx.params;
    if (overLimit(`helper:get:${token}`, 120)) throw new HttpError(429, "Too many requests. Wait a moment.");
    return json(await helperView(token));
  });
}

export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { token } = await ctx.params;
    if (overLimit(`helper:post:${token}`, 20)) throw new HttpError(429, "Too many requests. Wait a moment.");
    return json(await helperUpdate(token, await body(req, Body)));
  });
}
