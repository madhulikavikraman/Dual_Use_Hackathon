import { connection } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMeta } from "@/lib/engine/log";
import { runHeatCheck } from "@/lib/engine/weather";
import { HEAT_THRESHOLDS, HEAT_THRESHOLD_NOTE, SOURCES } from "@/lib/scenarios/heatLadder";
import { body, conflict, handle, json } from "@/lib/http";

const Body = z.object({ actor: z.string().trim().min(1).max(80).default("Demo operator") });

/** GET /api/heat — the heat zones' last weather check, the demo threshold table and its sources. */
export async function GET() {
  await connection();
  return handle(async () => {
    const zones = (await db().all("zones")).filter((z) => z.scenario === "heat");
    return json({
      thresholds: HEAT_THRESHOLDS,
      note: HEAT_THRESHOLD_NOTE,
      sources: SOURCES,
      zones: zones.map((z) => ({ id: z.id, name: z.name, state: z.state, weather: z.weather ?? null })),
    });
  });
}

/**
 * POST /api/heat {actor?} — re-check live weather (Open-Meteo, NWS) for the heat zones and propose a level where the
 * demo threshold table is above a zone's state. Proposals only: a named human approves on the board.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req, Body);
    if ((await getMeta()).scenario !== "heat") throw conflict("Load the heat scenario first (Reset: Heat wave on /demo).");
    const { check, proposals } = await runHeatCheck({ actor: b.actor });
    return json({
      ok: true,
      basis: check.basis,
      live_ok: check.live_ok,
      live_error: check.live_error,
      nws_ok: check.nws_ok,
      proposals: proposals.map((p) => ({ zone_id: p.zone_id, proposed_state: p.proposed_state, reason: p.reason })),
    });
  });
}
