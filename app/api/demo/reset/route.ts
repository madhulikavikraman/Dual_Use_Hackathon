import { z } from "zod";
import { resetScenario } from "@/lib/engine/reset";
import { body, handle, json } from "@/lib/http";

const Body = z.object({ scenario: z.enum(["westside", "usc", "altadena"]).default("westside") });

/** POST /api/demo/reset {scenario} — wipe the run (not the twist log) and load a scenario. */
export async function POST(req: Request) {
  return handle(async () => {
    const { scenario } = await body(req, Body);
    return json({ ok: true, ...(await resetScenario(scenario)) });
  });
}
