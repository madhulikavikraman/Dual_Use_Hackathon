import { connection } from "next/server";
import { liveRegistry } from "@/lib/engine/responders";
import { handle, json } from "@/lib/http";
import { requestOrigin } from "@/lib/sms";

/**
 * GET /api/registry/live — live-location links and helpers sent, per registry row, plus the helper roster. Desk only
 * (behind DESK_PASSWORD with the rest of the registry). Never carries a resident's link token.
 */
export async function GET() {
  await connection();
  return handle(async () => json(await liveRegistry(await requestOrigin())));
}
