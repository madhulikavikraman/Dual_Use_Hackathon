import { connection } from "next/server";
import { db } from "@/lib/db";
import { registrySort } from "@/lib/engine/board";
import { handle, json } from "@/lib/http";

/** GET /api/registry — the help registry for the quick response team (phone numbers included: QRT only). */
export async function GET() {
  await connection();
  return handle(async () => json({ rows: registrySort(await db().all("help_requests")), runs: await db().all("pickup_runs") }));
}
