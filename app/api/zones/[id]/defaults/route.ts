import { connection, type NextRequest } from "next/server";
import { defaultsFor } from "@/lib/engine/zones";
import { bad, handle, json } from "@/lib/http";
import { ZONE_STATES, type ZoneState } from "@/lib/types";

/** GET /api/zones/[id]/defaults?state=warning — what the approve dialog pre-fills (a human still edits it). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  return handle(async () => {
    const { id } = await ctx.params;
    const state = req.nextUrl.searchParams.get("state") as ZoneState | null;
    if (!state || !ZONE_STATES.includes(state)) throw bad("state must be one of " + ZONE_STATES.join(", "));
    return json(await defaultsFor(id, state));
  });
}
