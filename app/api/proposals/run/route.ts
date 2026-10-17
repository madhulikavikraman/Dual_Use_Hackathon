import { z } from "zod";
import { db } from "@/lib/db";
import { getLastFireRun, runFireModel } from "@/lib/engine/fireModel";
import { runPatternWatchNow } from "@/lib/engine/pattern";
import { body, handle, json } from "@/lib/http";

const Body = z.object({
  model: z.enum(["fire_envelope", "call_pattern"]),
  /** Fire model only: move the perimeter downwind by this many hours first ("the model moves the envelope"). */
  advanceHours: z.number().min(0).max(24).optional(),
  /** Fire model only: "live" = NWS hourly wind with a seeded fallback (default); "seeded" = the story's wind. */
  wind: z.enum(["live", "seeded"]).optional(),
});

/**
 * POST /api/proposals/run {model, advanceHours?, wind?} — run a model now. Models only propose: the response
 * lists the new proposals and every open proposal from that model; a named human approves or rejects each.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req, Body);
    if (b.model === "fire_envelope") {
      const created = await runFireModel({ advanceHours: b.advanceHours, wind: b.wind });
      const run = getLastFireRun();
      const open = (await db().where("proposals", { model: "fire_envelope", status: "open" })).sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
      return json({
        model: b.model,
        proposals: created,
        open,
        wind: run?.wind ?? null,
        advanced_hours: run?.advanced_hours ?? 0,
        considered: run?.considered ?? [],
        envelopes: run?.geo ?? null,
      });
    }
    const changes = await runPatternWatchNow();
    const [open, clusters] = await Promise.all([db().where("proposals", { model: "call_pattern", status: "open" }), db().all("clusters")]);
    return json({
      model: b.model,
      changes,
      proposals: open.sort((x, y) => (x.created_at < y.created_at ? 1 : -1)),
      clusters: clusters.map((c) => ({
        id: c.id, kind: c.kind, zone_id: c.zone_id, count: c.count, baseline: c.baseline, score: c.score,
        corroborated: c.corroborated, sentinel_reads: c.sentinel_reads, status: c.status,
      })),
    });
  });
}
