import { connection, type NextRequest } from "next/server";
import { buildCap, capIdentifier } from "@/lib/cap";
import { db } from "@/lib/db";
import { getMeta } from "@/lib/engine/log";
import { serverEnv } from "@/lib/env";
import { bad, handle, notFound } from "@/lib/http";

const compact = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

/**
 * GET /api/export/cap?zone_id=LA-CC or ?hold_id=<uuid> — the zone's current approved alert, or a hold's alert,
 * as CAP 1.2 XML (the format IPAWS accepts). Status is always "Exercise": every send here is simulated.
 * Add `&download=1` to save it as a file.
 */
export async function GET(req: NextRequest) {
  await connection();
  return handle(async () => {
    const sp = req.nextUrl.searchParams;
    const zoneId = sp.get("zone_id");
    const holdId = sp.get("hold_id");
    if (!zoneId && !holdId) throw bad("Pass ?zone_id= or ?hold_id=");
    const meta = await getMeta();
    const desk = serverEnv().SUPERVISOR_NAME;
    let xml: string;
    let file: string;
    if (holdId) {
      const hold = await db().get("holds", holdId);
      if (!hold) throw notFound("Hold");
      const zone = await db().get("zones", hold.zone_id);
      const human = hold.decided_by && !["timer", "system", "agent"].includes(hold.decided_by);
      const approver = human
        ? `approved by ${hold.decided_by}`
        : hold.decision === "timer" || hold.decided_by === "timer"
          ? `sent on timer, no decision; hold opened by ${hold.opened_by}`
          : `hold opened by ${hold.opened_by}`;
      xml = buildCap({
        identifier: capIdentifier("VoiceFlare", hold.zone_id, "hold", hold.id.slice(0, 8)),
        sent: hold.sent_at ?? hold.decided_at ?? hold.started_at,
        state: hold.proposed_state,
        mode: meta.mode,
        quake: Boolean(meta.usgs_event),
        areaDesc: hold.polygon_label || zone?.name || hold.zone_id,
        polygon: hold.polygon,
        directive: hold.directive_text ?? hold.alert_text,
        moveText: hold.move_text,
        evacPoint: hold.evac_point,
        senderName: `VoiceFlare demo desk (${approver})`,
        parameters: {
          VoiceFlareHold: hold.id,
          HoldStatus: hold.status,
          HoldDecision: hold.decision ?? "pending",
          SentinelRead: hold.read,
          DoseEstimate: hold.population_est,
          AreaSqMi: +hold.area_sq_mi.toFixed(2),
        },
      });
      file = `voiceflare-cap-hold-${hold.id.slice(0, 8)}`;
    } else {
      const zone = await db().get("zones", zoneId!);
      if (!zone) throw notFound("Zone");
      const sent = zone.approved_at ?? zone.updated_at;
      xml = buildCap({
        identifier: capIdentifier("VoiceFlare", zone.id, `v${zone.version}`, compact(sent)),
        sent,
        state: zone.state,
        mode: meta.mode,
        quake: Boolean(meta.usgs_event),
        areaDesc: zone.name,
        polygon: zone.geom,
        directive: zone.directive_text ?? "",
        moveText: zone.move_text,
        evacPoint: zone.evac_point,
        senderName: `VoiceFlare demo desk (${zone.approved_by ? `approved by ${zone.approved_by}` : desk})`,
        parameters: {
          VoiceFlareZone: zone.id,
          ZoneVersion: zone.version,
          ...(zone.population_est ? { PopulationEstimate: zone.population_est } : {}),
        },
      });
      file = `voiceflare-cap-${zone.id}-v${zone.version}`;
    }
    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `${sp.get("download") ? "attachment" : "inline"}; filename="${file}.xml"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
