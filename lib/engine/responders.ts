import "server-only";
import type { DispatchSummary, HelperUpdateBody, HelperView, LiveRegistry } from "@/lib/contracts";
import { db, nowIso, uid } from "@/lib/db";
import { smsProvider } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { jurisdictionFor } from "@/lib/jurisdictions";
import { rosterFor } from "@/lib/scenarios/helpers";
import { isE164, publicBase, sendSms } from "@/lib/sms";
import type { Dispatch, HelpRequest } from "@/lib/types";
import { DISPATCH_ACTIVE } from "@/lib/types";
import { newToken, onHelpFinal, shareSummary, TOKEN_RE } from "./locate";
import { feed, getMeta, ledger } from "./log";

// "Send helper": a named human sends one helper (a CERT team, a QRT unit) to a registry row. The helper gets a link
// (/helper/[token]) with the person's latest location, live while the person shares it, and four status buttons.
// The registry is still for humans: nothing is dispatched automatically.

export const helperLink = (token: string, origin?: string | null) => `${publicBase(origin)}/helper/${token}`;

const newestFirst = <T extends { created_at: string }>(a: T, b: T) => (a.created_at < b.created_at ? 1 : -1);

function summary(d: Dispatch, origin?: string | null): DispatchSummary {
  return {
    id: d.id, help_request_id: d.help_request_id, helper_label: d.helper_label, status: d.status, dispatched_by: d.dispatched_by,
    reason: d.reason, note: d.note, sent_via: d.helper_phone ? "text" : "simulated", created_at: d.created_at, updated_at: d.updated_at,
    // Relative when no public base is known: the board opens it on the same host.
    link: helperLink(d.token, origin),
  };
}

const needsText = (r: HelpRequest) => (r.needs.length ? r.needs.join(", ").replaceAll("_", " ") : (r.reason ?? "help"));

export async function sendHelper(
  helpId: string,
  input: { helper_id?: string; helper_label?: string; helper_phone?: string | null; actor: string; reason: string; origin?: string | null },
): Promise<{ dispatch: DispatchSummary; via: string }> {
  const row = await db().get("help_requests", helpId);
  if (!row) throw new HttpError(404, "registry row not found");
  if (row.status === "closed" || row.status === "reached") throw new HttpError(409, `This row is ${row.status}.`);
  const meta = await getMeta();
  const picked = input.helper_id ? rosterFor(meta.scenario).find((h) => h.id === input.helper_id) : undefined;
  const label = (input.helper_label?.trim() || picked?.label || "").slice(0, 80);
  if (label.length < 2) throw new HttpError(400, "Pick a helper or type a name.");
  const phone = input.helper_phone?.trim() || null;
  if (phone && !isE164(phone)) throw new HttpError(400, "Helper phone must be E.164, for example +12135550142.");

  // One helper per row at a time: a new send stands the previous one down.
  for (const d of (await db().where("dispatches", { help_request_id: helpId })).filter((x) => DISPATCH_ACTIVE.includes(x.status))) {
    await db().update("dispatches", d.id, { status: "cancelled", note: `Replaced by ${label}`, updated_at: nowIso() });
  }
  const now = nowIso();
  const d: Dispatch = {
    id: uid(),
    help_request_id: helpId,
    helper_id: picked?.id ?? null,
    helper_label: label,
    helper_phone: phone,
    token: newToken(),
    status: "assigned",
    dispatched_by: input.actor,
    reason: input.reason,
    target_lat: row.last_lat,
    target_lng: row.last_lng,
    target_accuracy_m: row.last_accuracy_m,
    target_source: row.last_lat === null ? null : row.last_source,
    note: null,
    synthetic: row.synthetic,
    created_at: now,
    updated_at: now,
  };
  await db().insert("dispatches", d);
  await db().update("help_requests", helpId, { status: "assigned", assigned_to: label, updated_at: now });

  const link = helperLink(d.token, input.origin);
  const sms = await sendSms(phone, `Response team: you are sent to a person who needs help (P${row.priority}, ${needsText(row)}). Their location and status buttons: ${link} (Hackathon demo)`);
  const via = sms.via === "simulated" ? "simulated text" : `texted (${sms.via})`;
  await ledger({
    actor: input.actor,
    action: `send helper: ${label} (link ${via})`,
    target: row.name ?? row.id.slice(0, 8),
    reason: input.reason,
  });
  await feed({
    kind: "needs_help", zone_id: row.zone_id,
    title: `Helper sent: ${label}`,
    detail: `P${row.priority} · ${row.zone_id ?? "no zone"} · to the ${row.last_source === "gps_link" ? "live GPS" : row.last_source} location · link ${via}`,
  });
  return { dispatch: summary(d, input.origin), via };
}

async function dispatchByToken(token: string): Promise<Dispatch> {
  if (!TOKEN_RE.test(token)) throw new HttpError(404, "This helper link is not valid.");
  const d = (await db().where("dispatches", { token }))[0];
  if (!d) throw new HttpError(404, "This helper link is not valid.");
  return d;
}

export async function helperView(token: string): Promise<HelperView> {
  const d = await dispatchByToken(token);
  const [row, meta, shares] = await Promise.all([
    db().get("help_requests", d.help_request_id),
    getMeta(),
    db().where("location_shares", { help_request_id: d.help_request_id }),
  ]);
  if (!row) throw new HttpError(404, "The registry row for this link is gone (the scenario was reset).");
  const zone = row.zone_id ? await db().get("zones", row.zone_id) : null;
  const share = shares.sort(newestFirst)[0] ?? null;
  return {
    now: nowIso(),
    status: d.status,
    helper_label: d.helper_label,
    dispatched_by: d.dispatched_by,
    reason: d.reason,
    created_at: d.created_at,
    note: d.note,
    person: {
      name: row.name, phone: row.phone, language: row.language, people: row.people, needs: row.needs, priority: row.priority,
      reason: row.reason, animals: row.animals, device_battery_hours: row.device_battery_hours, zone_id: row.zone_id,
      zone_name: zone?.name ?? null, help_status: row.status, synthetic: row.synthetic,
    },
    location:
      row.last_lat !== null && row.last_lng !== null
        ? { lat: row.last_lat, lng: row.last_lng, accuracy_m: row.last_accuracy_m, source: row.last_source, observed_at: row.last_observed_at, stated_text: row.last_stated_text }
        : null,
    share_status: share?.status ?? null,
    emergency_number: jurisdictionFor(meta.jurisdiction).call_now,
  };
}

const ACTION: Record<HelperUpdateBody["status"], string> = {
  en_route: "en route",
  arrived: "arrived at the location",
  reached: "person reached",
  cannot_reach: "cannot reach the person",
};

/** En route, Arrived, Person reached, Cannot reach: from the helper's page. Each one is a ledger line. */
export async function helperUpdate(token: string, body: HelperUpdateBody): Promise<HelperView> {
  const d = await dispatchByToken(token);
  if (!DISPATCH_ACTIVE.includes(d.status)) throw new HttpError(409, `This assignment is ${d.status.replace("_", " ")}.`);
  const row = await db().get("help_requests", d.help_request_id);
  if (!row) throw new HttpError(404, "registry row not found");
  const note = body.note?.trim().slice(0, 200) || null;
  const now = nowIso();
  await db().update("dispatches", d.id, { status: body.status, note: note ?? d.note, updated_at: now });
  await ledger({ actor: d.helper_label, action: `helper: ${ACTION[body.status]}`, target: row.name ?? row.id.slice(0, 8), reason: note });
  if (body.status === "en_route" || body.status === "arrived") {
    if (row.status !== "en_route") await db().update("help_requests", row.id, { status: "en_route", updated_at: now });
  } else if (body.status === "reached") {
    await db().update("help_requests", row.id, { status: "reached", updated_at: now });
    await onHelpFinal(row.id, "reached", d.helper_label); // stops the person's live location
    await feed({ kind: "needs_help", zone_id: row.zone_id, title: `Helper reached the person: ${d.helper_label}`, detail: `P${row.priority} · ${row.zone_id ?? "no zone"}. Live location stopped.` });
  } else {
    // Back to the open list for a human to decide what is next.
    await db().update("help_requests", row.id, { status: "open", assigned_to: null, updated_at: now });
    await feed({
      kind: "needs_help", severity: "critical", zone_id: row.zone_id,
      title: `Helper could not reach the person: ${d.helper_label}`,
      detail: `P${row.priority} · ${row.zone_id ?? "no zone"}${note ? ` · “${note}”` : ""}. The row is open again.`,
    });
  }
  return helperView(token);
}

/** GET /api/registry/live: shares and dispatches for the board and QRT rows (desk only; no resident tokens). */
export async function liveRegistry(origin?: string | null): Promise<LiveRegistry> {
  const [shares, dispatches, meta] = await Promise.all([db().all("location_shares"), db().all("dispatches"), getMeta()]);
  return {
    now: nowIso(),
    shares: shares.sort(newestFirst).map(shareSummary),
    dispatches: dispatches.sort(newestFirst).map((d) => summary(d, origin)),
    roster: rosterFor(meta.scenario),
    sms: smsProvider(),
  };
}

