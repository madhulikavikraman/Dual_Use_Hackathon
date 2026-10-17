import { z } from "zod";
import { buildRuns } from "@/lib/engine/registry";
import { body, handle, json } from "@/lib/http";

const Body = z.object({ actor: z.string().trim().min(1, "name required") });

/** POST /api/registry/runs — build pickup runs from open priority 1-2 rows (accessible vans first). */
export async function POST(req: Request) {
  return handle(async () => {
    const { actor } = await body(req, Body);
    return json({ runs: await buildRuns(actor) });
  });
}
