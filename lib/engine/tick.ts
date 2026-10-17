import "server-only";
import { withLock } from "@/lib/db";

// Advances every deadline in the database: dispatch queue, ring timeouts, retries, Stage 2 timers,
// hold expiry, canaries, simulator events, pattern watch. Called by each board poll and /api/tick.
// (Filled in by the engine; see lib/engine/*.)
export async function runTick(): Promise<{ advanced: number }> {
  const r = await withLock("tick", async () => ({ advanced: 0 }), true);
  return r ?? { advanced: 0 };
}
