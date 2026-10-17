import { after } from "next/server";
import { z } from "zod";
import { warmAgent } from "@/lib/agent/warmup";
import { resetScenario } from "@/lib/engine/reset";
import { body, handle, json } from "@/lib/http";

const Body = z.object({ scenario: z.enum(["westside", "usc", "altadena", "chongqing", "norte"]).default("westside") });

/** POST /api/demo/reset {scenario} — wipe the run (not the twist log) and load a scenario. */
export async function POST(req: Request) {
  return handle(async () => {
    const { scenario } = await body(req, Body);
    const result = await resetScenario(scenario);
    // Compile the agent's tool schemas now so the first answered call is quick.
    after(() => warmAgent().then((r) => console.log("[warmup]", r.map((x) => `${x.purpose} ${x.ok ? "ok" : "failed"} ${x.ms}ms`).join(", "))));
    return json({ ok: true, ...result });
  });
}
