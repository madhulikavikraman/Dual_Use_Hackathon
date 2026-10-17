import { connection } from "next/server";
import { plansNow } from "@/lib/engine/plans";
import { handle, json } from "@/lib/http";

/** GET /api/plans — every block-by-block plan in use for the current scenario's zones (the board's map and plan panel). */
export async function GET() {
  await connection();
  return handle(async () => json({ plans: await plansNow() }));
}
