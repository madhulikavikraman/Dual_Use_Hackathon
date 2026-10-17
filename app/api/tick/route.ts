import { connection } from "next/server";
import { runTick } from "@/lib/engine/tick";
import { handle, json } from "@/lib/http";

/** POST /api/tick — advance timers (the board's poll does this too). GET for Vercel Cron. */
export async function POST() {
  return handle(async () => json(await runTick()));
}

export async function GET() {
  await connection();
  return handle(async () => json(await runTick()));
}
