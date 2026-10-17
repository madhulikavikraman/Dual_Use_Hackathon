import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { activeNwsAlerts, adoptNws } from "@/lib/engine/nws";
import { body, handle, json } from "@/lib/http";

/** GET /api/zones/nws?area=CA — active NWS alerts that carry a polygon (live from api.weather.gov). */
export async function GET(req: NextRequest) {
  await connection();
  return handle(async () => {
    const area = req.nextUrl.searchParams.get("area") ?? "CA";
    const alerts = await activeNwsAlerts(area);
    return json({ alerts: alerts.map(({ geom, ...a }) => ({ ...a, vertices: geom.coordinates[0].length })) });
  });
}

const Body = z.object({ alert_id: z.string().min(1), actor: z.string().trim().min(1, "name required") });

/** POST /api/zones/nws {alert_id, actor} — adopt the alert's polygon as a Monitor zone (no directive). */
export async function POST(req: Request) {
  return handle(async () => {
    const { alert_id, actor } = await body(req, Body);
    return json(await adoptNws(alert_id, actor));
  });
}
