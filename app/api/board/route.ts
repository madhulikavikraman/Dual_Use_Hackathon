import { connection } from "next/server";
import { buildBoard } from "@/lib/engine/board";
import { runTick } from "@/lib/engine/tick";
import { handle, json } from "@/lib/http";

// The supervisor's one screen polls this about once a second. Each poll first advances the tick
// (serverless has no long-lived timers, D-19), then returns the whole board.
export async function GET() {
  await connection();
  return handle(async () => {
    await runTick().catch((e) => console.error("[tick]", e));
    return json(await buildBoard());
  });
}
