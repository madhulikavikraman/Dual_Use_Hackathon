import "server-only";
import type { ApproveZoneBody, ApproveZoneResult, DecideProposalBody } from "@/lib/contracts";
import { db, nowIso } from "@/lib/db";
import { STATE_RANK, stateLabelFor } from "@/lib/directives";
import { HttpError } from "@/lib/http";
import { zoneDefaults } from "@/lib/scenarios";
import type { Proposal, Zone, ZoneState } from "@/lib/types";
import { startCampaign } from "./campaigns";
import { applyZoneState, bypassHold, decideHold, openHold } from "./holds";
import { feed, getMeta, ledger } from "./log";

/** A ladder state in the words of the run's mode (heat mode says "Heat Advisory", not "Evacuation Warning"). */
const labelOf = async (s: ZoneState) => stateLabelFor(s, (await getMeta()).mode);

// Only a named human moves a zone (PRD 6.1). An Order opens the hold first; the approval records who,
// when and why, and the approved directive, route and evacuation point are what the agent reads.

export async function defaultsFor(zoneId: string, state: Zone["state"]) {
  const zone = await db().get("zones", zoneId);
  if (!zone) throw new HttpError(404, "zone not found");
  const meta = await getMeta();
  return zoneDefaults(zone, state, meta.mode);
}

export async function approveZone(zoneId: string, body: ApproveZoneBody): Promise<ApproveZoneResult> {
  const zone = await db().get("zones", zoneId);
  if (!zone) throw new HttpError(404, "zone not found");
  if (!body.approved_by.trim() || !body.reason.trim()) throw new HttpError(400, "A name and a reason are required");
  const meta = await getMeta();
  const defaults = zoneDefaults(zone, body.state, meta.mode);
  // Omitted texts fall back to the approved defaults; an explicit empty route or evacuation point is the
  // human's choice. The directive itself can never be empty.
  const directive = body.directive_text?.trim() || defaults.directive_text;
  const move = body.move_text === undefined ? defaults.move_text : body.move_text.trim();
  const evac = body.evac_point === undefined ? defaults.evac_point : body.evac_point;

  await closeProposals(zone, body.state, body.approved_by, body.reason);

  // A later approval of a lower state (Warning, Lifted...) supersedes an open Order hold: otherwise its
  // timer would push the zone back to Order at 0:00.
  if (body.state !== "order" && body.state !== zone.state) {
    for (const open of await db().where("holds", { zone_id: zone.id, status: "open" })) {
      await decideHold(open.id, { decision: "cancel", actor: body.approved_by, reason: `Superseded by ${await labelOf(body.state)}: ${body.reason}` });
    }
  }

  // Same state again: the human is editing the approved texts. Update and log; no new calls, no new send.
  if (body.state === zone.state) {
    await applyZoneState(zone, body.state, {
      directive_text: directive || null, move_text: move || null, evac_point: evac, actor: body.approved_by, reason: body.reason,
      evac_point_lat: defaults.evac_point_lat, evac_point_lng: defaults.evac_point_lng,
    });
    await ledger({ actor: body.approved_by, action: `re-approve ${await labelOf(body.state)} (texts updated, no new calls)`, target: zone.name, reason: body.reason });
    return { zone: (await db().get("zones", zoneId))!, campaign: null, hold: null };
  }

  if (body.state === "order") {
    if (body.bypass_hold) {
      await ledger({ actor: body.approved_by, action: "IC order: bypass hold", target: zone.name, reason: body.reason });
      const hold = await bypassHold(zone, { directive_text: directive, move_text: move, evac_point: evac, actor: body.approved_by, reason: body.reason });
      return { zone: (await db().get("zones", zoneId))!, campaign: null, hold };
    }
    const hold = await openHold({
      zone_id: zone.id, proposed_state: "order", directive_text: directive, move_text: move, evac_point: evac,
      opened_by: body.approved_by, reason: body.reason,
    });
    return { zone, campaign: null, hold };
  }

  await applyZoneState(zone, body.state, {
    directive_text: directive || null, move_text: move || null, evac_point: evac, actor: body.approved_by, reason: body.reason,
    evac_point_lat: defaults.evac_point_lat, evac_point_lng: defaults.evac_point_lng,
  });
  await ledger({ actor: body.approved_by, action: `approve zone: ${await labelOf(body.state)}`, target: zone.name, reason: body.reason });
  await feed({ kind: "info", zone_id: zone.id, title: `${zone.name}: ${await labelOf(body.state)} approved by ${body.approved_by}`, detail: directive || null });
  const fresh = (await db().get("zones", zoneId))!;

  let campaign = null;
  const heat = meta.mode === "heat";
  if (heat && body.state === "watch") {
    // A heat watch is the ordinary-Tuesday rung: check-in calls to the people who live alone, nobody else.
    campaign = await startCampaign({ zone: fresh, kind: "checkin", wave: null, started_by: body.approved_by });
  } else if (body.state === "warning") {
    campaign = await startCampaign({
      zone: fresh, kind: "warning", wave: 1, started_by: body.approved_by,
      // Heat mode words its own reason in startCampaign (people who live alone or have no air conditioning first).
      reason: heat ? undefined : "Near-Crisis approved: Stage 1, edge-first",
    });
  } else if (body.state === "shelter_in_place") {
    campaign = await startCampaign({ zone: fresh, kind: "shelter", wave: null, started_by: body.approved_by, reason: "Shelter in Place approved" });
  }
  return { zone: fresh, campaign, hold: null };
}

/** Approving or reaching a state closes open proposals for that zone at or below it. */
async function closeProposals(zone: Zone, state: Zone["state"], actor: string, reason: string) {
  for (const p of await db().where("proposals", { zone_id: zone.id, status: "open" })) {
    if (STATE_RANK[p.proposed_state] <= STATE_RANK[state] || p.proposed_state === state) {
      await db().update("proposals", p.id, {
        status: p.proposed_state === state ? "approved" : "edited", decided_by: actor, decided_at: nowIso(), decision_reason: reason,
      });
    }
  }
}

export async function decideProposal(id: string, body: DecideProposalBody): Promise<{ proposal: Proposal; result: ApproveZoneResult | null }> {
  const p = await db().get("proposals", id);
  if (!p) throw new HttpError(404, "proposal not found");
  if (p.status !== "open") throw new HttpError(409, `proposal is already ${p.status}`);
  if (!body.actor.trim() || !body.reason.trim()) throw new HttpError(400, "A name and a reason are required");
  const zone = (await db().get("zones", p.zone_id))!;
  if (body.decision === "reject") {
    const proposal = (await db().update("proposals", id, { status: "rejected", decided_by: body.actor, decided_at: nowIso(), decision_reason: body.reason }))!;
    await ledger({ actor: body.actor, action: `reject model proposal: ${await labelOf(p.proposed_state)}`, target: zone.name, reason: body.reason });
    await feed({ kind: "proposal", zone_id: zone.id, title: `Proposal rejected for ${zone.name}`, detail: `${p.reason} — rejected: ${body.reason}` });
    return { proposal, result: null };
  }
  const meta = await getMeta();
  const d = zoneDefaults(zone, p.proposed_state, meta.mode);
  const edited = body.directive_text !== undefined || body.move_text !== undefined || body.evac_point !== undefined;
  const result = await approveZone(zone.id, {
    state: p.proposed_state,
    directive_text: body.directive_text ?? d.directive_text,
    move_text: body.move_text ?? d.move_text,
    evac_point: body.evac_point === undefined ? d.evac_point : body.evac_point,
    approved_by: body.actor,
    reason: `${body.reason} (model proposal: ${p.model})`,
  });
  const proposal = (await db().update("proposals", id, {
    status: edited ? "edited" : "approved", decided_by: body.actor, decided_at: nowIso(), decision_reason: body.reason,
  }))!;
  return { proposal, result };
}

export async function patchZone(zoneId: string, body: {
  geom?: GeoJSON.Polygon; directive_text?: string; move_text?: string; evac_point?: string | null; fact_sheet?: string; actor: string; reason: string;
}) {
  const zone = await db().get("zones", zoneId);
  if (!zone) throw new HttpError(404, "zone not found");
  const patch: Partial<Zone> = { updated_at: nowIso(), version: zone.version + 1 };
  if (body.geom) patch.geom = body.geom;
  if (body.directive_text !== undefined) patch.directive_text = body.directive_text;
  if (body.move_text !== undefined) patch.move_text = body.move_text;
  if (body.evac_point !== undefined) patch.evac_point = body.evac_point;
  if (body.fact_sheet !== undefined) patch.fact_sheet = body.fact_sheet;
  const next = await db().update("zones", zoneId, patch);
  await ledger({ actor: body.actor, action: `edit zone${body.geom ? " polygon" : " texts"}`, target: zone.name, reason: body.reason });
  return next;
}
