import { z } from "zod";
import { runFireModel } from "@/lib/engine/fireModel";
import { feed, getMeta, ledger, setMeta } from "@/lib/engine/log";
import { seedEarthquake, seedHoaxFlood } from "@/lib/engine/pattern";
import { towerDown } from "@/lib/engine/sim";
import { body, handle, json } from "@/lib/http";

const Body = z.object({
  mode: z.enum(["civilian", "heat", "base"]).optional(),
  preset: z.enum(["normal", "tower_down", "fire_spreading", "mass_no_answer", "earthquake", "hoax_flood", "dark_zone"]).optional(),
  autopilot_devices: z.boolean().optional(),
  wrong_polygon: z.boolean().optional(),
  event: z.enum(["tower_down", "earthquake", "hoax_flood", "fire_spreading", "mass_no_answer", "dark_zone"]).optional(),
});

/**
 * POST /api/demo/sim — simulator controls for the demo and rehearsal: switch the preset, let the simulator
 * answer for the six devices (autopilot), compose the wrong countywide polygon next, or fire an event.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req, Body);
    const patch: Parameters<typeof setMeta>[0] = {};
    if (b.mode) patch.mode = b.mode;
    if (b.preset) patch.sim_preset = b.preset;
    if (b.autopilot_devices !== undefined) patch.autopilot_devices = b.autopilot_devices;
    if (b.wrong_polygon !== undefined) patch.wrong_polygon = b.wrong_polygon;
    if (Object.keys(patch).length) {
      await setMeta(patch);
      await ledger({ actor: "demo operator", action: `simulator: ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ")}`, kind: "system" });
    }
    let detail: string | null = null;
    switch (b.event) {
      case "tower_down": {
        await setMeta({ sim_preset: "tower_down" });
        const n = await towerDown();
        detail = `${n} households on the Palms block went silent`;
        break;
      }
      case "earthquake":
        await setMeta({ sim_preset: "earthquake" });
        await seedEarthquake();
        detail = "seeded USGS-style event and reports in Mid-City";
        break;
      case "hoax_flood":
        await setMeta({ sim_preset: "hoax_flood" });
        await seedHoaxFlood();
        detail = "seeded a flood of unverified reports in Koreatown";
        break;
      case "fire_spreading": {
        await setMeta({ sim_preset: "fire_spreading" });
        // The story wind (WNW, 20 mph): live wind tonight may be calm and propose nothing (D-17).
        const proposals = await runFireModel({ advanceHours: 1, wind: "seeded" });
        detail = `fire envelope advanced 1 h (story wind); ${proposals.length} proposal(s)`;
        break;
      }
      case "mass_no_answer":
        await setMeta({ sim_preset: "mass_no_answer" });
        detail = "70% of residents will not answer";
        break;
      case "dark_zone":
        await setMeta({ sim_preset: "dark_zone" });
        detail = "every simulated sentinel is silent: the next hold reads dark zone and still sends at 0:00";
        break;
    }
    if (b.event) {
      await ledger({ actor: "demo operator", action: `simulated event: ${b.event.replace("_", " ")}`, kind: "system", reason: detail });
      await feed({ kind: "info", title: `Simulated event: ${b.event.replace("_", " ")}`, detail });
    }
    return json({ ok: true, meta: await getMeta(), detail });
  });
}
