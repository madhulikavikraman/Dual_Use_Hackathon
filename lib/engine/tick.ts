import "server-only";
import { nowIso, withLock } from "@/lib/db";
import { campaignTick, dispatchTick, timeoutTick } from "./dispatch";
import { canaryTick, holdTick } from "./holds";
import { locateTick } from "./locate";
import { getMeta } from "./log";
import { runPatternWatch } from "./pattern";
import { simTick } from "./sim";

// Advances every deadline in the database (D-19: serverless has no long-lived timers): the dispatch queue,
// the simulator, ring timeouts, holds (send on time at 0:00), canaries, campaign completion and pattern
// watch, and live-location links. Called by every board poll and by /api/tick (Vercel Cron backstop). Overlapping calls skip.
export async function runTick(): Promise<{ advanced: number }> {
  const r = await withLock(
    "tick",
    async () => {
      const meta = await getMeta();
      const now = nowIso();
      let n = 0;
      n += await dispatchTick(now, meta);
      n += await simTick(now, meta);
      n += await timeoutTick(now);
      n += await holdTick(nowIso());
      n += await canaryTick();
      n += await campaignTick();
      // Live-location links: expiry, help reached, the simulator's pings (never blocks the tick, e.g. before migration 003).
      n += await locateTick().catch((e) => {
        console.error("[locate]", e);
        return 0;
      });
      n += await runPatternWatch().catch((e) => {
        console.error("[pattern]", e);
        return 0;
      });
      return { advanced: n };
    },
    true,
  );
  return r ?? { advanced: 0 };
}
