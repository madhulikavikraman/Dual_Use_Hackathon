import { connection } from "next/server";
import { z } from "zod";
import { pingShare, statedOnLink, stopShare, viewByToken } from "@/lib/engine/locate";
import { body, handle, HttpError, json } from "@/lib/http";
import { overLimit } from "@/lib/rateLimit";

// The resident's live-location link (/l/[token]). Open (no desk password): the person opens it from a text message
// and the unguessable token is their key. GET: what the page shows. POST: a GPS fix (default), "stop", or "stated"
// (the place in their words when there is no GPS). 410 once the link is stopped, expired or closed.

type Ctx = { params: Promise<{ token: string }> };

const Fix = z.object({
  action: z.literal("fix").optional(),
  lat: z.number(),
  lng: z.number(),
  accuracy_m: z.number(),
  heading: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  captured_at: z.string().max(40).optional(),
});
const Body = z.union([
  z.object({ action: z.literal("stop") }),
  z.object({ action: z.literal("stated"), text: z.string().trim().min(1).max(200) }),
  Fix,
]);

export async function GET(_req: Request, ctx: Ctx) {
  await connection();
  return handle(async () => {
    const { token } = await ctx.params;
    if (overLimit(`locate:get:${token}`, 120)) throw new HttpError(429, "Too many requests. Wait a moment.");
    return json(await viewByToken(token));
  });
}

export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { token } = await ctx.params;
    if (overLimit(`locate:post:${token}`, 40)) throw new HttpError(429, "Too many requests. Wait a moment.");
    const b = await body(req, Body);
    if (b.action === "stop") return json(await stopShare(token));
    if (b.action === "stated") return json(await statedOnLink(token, b.text));
    return json(await pingShare(token, b));
  });
}
