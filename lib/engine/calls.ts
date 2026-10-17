import "server-only";
import { after } from "next/server";
import { z } from "zod";
import { toolsForPurpose, type ToolName } from "@/lib/agent/tools";
import { db, isoIn, nowIso, uid } from "@/lib/db";
import { STATE_LABEL } from "@/lib/directives";
import { geocode } from "@/lib/geocode";
import { centroidOf, zoneForPoint } from "@/lib/geo";
import { languageByCode } from "@/lib/languages";
import type {
  Call, CallVars, HelpSource, Household, HouseholdStatus, Intent, IntentFlag, Need, PrimaryIntent, Report, ReportType, Status, Zone,
} from "@/lib/types";
import { NEEDS } from "@/lib/types";
import { blankStatus, buildVars, inboundCampaign, newCall } from "./campaigns";
import { feed, getMeta, ledger } from "./log";
import { enrolledFix, refreshLocation, upsertHelp, type Fix } from "./registry";

// Call lifecycle and the shared tool executor. Both transports (browser + Claude, phone + Retell) and the
// simulator go through executeTool, so every path writes the same rows and the same ledger lines.

export interface ToolResult {
  /** Text returned to the model as the tool result (Claude tool_result or Retell function response). */
  result: string;
  /** The tool ended the call (end_call). */
  end?: boolean;
}

// ---------- loading ----------

interface Ctx {
  call: Call;
  household: Household | null; // who is on the phone
  subject: Household | null; // who the call is about (linked-contact calls), else the household
  zone: Zone | null;
}

async function loadCtx(callId: string): Promise<Ctx> {
  const call = await db().get("calls", callId);
  if (!call) throw new Error(`call ${callId} not found`);
  const household = call.household_id ? await db().get("households", call.household_id) : null;
  const subject = call.subject_household_id ? await db().get("households", call.subject_household_id) : household;
  const zone = call.vars.zone_id ? await db().get("zones", call.vars.zone_id) : null;
  return { call, household, subject, zone };
}

async function statusCampaignId(call: Call): Promise<string> {
  return call.campaign_id ?? (await inboundCampaign()).id;
}

/** Merge a patch into the status row of (campaign, household). */
export async function upsertStatus(call: Call, householdId: string, patch: Partial<HouseholdStatus>) {
  const campaign_id = await statusCampaignId(call);
  const existing = (await db().where("household_status", { campaign_id, household_id: householdId }))[0];
  const base = existing ?? blankStatus(campaign_id, householdId, "pending");
  await db().upsert("household_status", { ...base, ...patch, campaign_id, household_id: householdId, updated_at: nowIso(), simulated: call.transport === "sim" });
}

export async function appendTranscript(callId: string, lines: { role: "agent" | "person"; text: string }[]) {
  const call = await db().get("calls", callId);
  if (!call) return;
  const add = lines.filter((l) => l.text.trim()).map((l) => `${l.role === "agent" ? "Agent" : "Person"}: ${l.text.trim()}`).join("\n");
  if (!add) return;
  await db().update("calls", callId, { transcript: call.transcript ? `${call.transcript}\n${add}` : add, last_activity_at: nowIso() });
}

function helpSource(call: Call): HelpSource {
  if (call.transport === "sim") return "sim";
  if (call.purpose === "inbound") return "inbound";
  if (call.purpose === "sentinel") return "sentinel";
  const s = call.vars.stage;
  return s === "2" ? "stage2" : s === "3" ? "stage3" : s === "rollcall" ? "rollcall" : "stage1";
}

// ---------- tool input schemas (tolerant: Retell may send strings for numbers and booleans) ----------

const bool = z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v === "" ? null : v), z.boolean().nullable().optional());
const numb = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v) : v), z.number().nullable().optional());
const text = z.preprocess((v) => (v === "" ? null : v), z.string().nullable().optional());

const RecordStatus = z.object({
  status: z.enum(["leaving", "staying", "already_left", "needs_help_leaving", "needs_help_now", "unclear", "wrong_number", "not_in_zone"]),
  understood: bool, destination: text, people: numb,
  needs: z.preprocess((v) => (typeof v === "string" ? v.split(/[,;]\s*/).filter(Boolean) : v ?? []), z.array(z.string())).optional(),
  device_battery_hours: numb, animals: text, location_text: text, location_consent: bool, can_leave: bool,
  refusal_reason: text, memory_note: text,
});
const ReportHazard = z.object({
  seen: z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean()),
  type: z.enum(["smoke", "fire", "shaking", "damage", "injury", "flood", "power", "other"]).catch("other"),
  direction: text, distance: text, location_text: text,
});
const RequestHuman = z.object({
  reason: z.enum(["medical_emergency", "cannot_answer", "confusion", "distress", "refusal", "doubts_call", "asked_unapproved"]).catch("cannot_answer"),
  urgency: z.enum(["now", "soon", "later"]).catch("soon"),
  note: text,
});
const EndCall = z.object({ outcome: z.enum(["completed", "wrong_person", "voicemail", "caller_hung_up", "no_response"]).catch("completed") });
const LookupZone = z.object({ location_text: z.string().min(1) });
const ReadObservation = z.object({ sees: z.enum(["yes", "no", "unsure"]).catch("unsure"), what: text, direction: text });
const ReceivedAlert = z.object({ received: z.enum(["yes", "no"]) });

const STATUS_MAP: Record<z.infer<typeof RecordStatus>["status"], Status> = {
  leaving: "leaving", staying: "wont_leave", already_left: "safe", needs_help_leaving: "needs_help",
  needs_help_now: "needs_help", unclear: "unclear", wrong_number: "wrong_number", not_in_zone: "wrong_number",
};

function flagsFor(intent: PrimaryIntent, needs: Need[], animals: string | null | undefined): IntentFlag[] {
  const f = new Set<IntentFlag>();
  if (intent === "needs_help_now") f.add("medical");
  if (needs.some((n) => ["wheelchair", "walker", "bedbound"].includes(n))) f.add("mobility");
  if (needs.includes("oxygen")) f.add("oxygen");
  if (needs.includes("no_car")) f.add("no_car");
  if (needs.includes("children_alone")) f.add("children");
  if (animals) f.add("pets");
  return [...f];
}

async function stateFix(text: string | null | undefined, consent: boolean | null | undefined, near: Household | null): Promise<Fix | null> {
  if (!text) return null;
  const hit = await geocode(text, near ? [near.lng, near.lat] : undefined);
  if (!hit) return null;
  return { lat: hit.lat, lng: hit.lng, accuracy_m: hit.accuracy_m, source: "stated", stated_text: text, consent: consent ?? false };
}

// ---------- the seven tools ----------

/** Run one of the seven tools for a call. Validates input, writes rows, logs refusals. */
export async function executeTool(callId: string, name: ToolName, args: Record<string, unknown>): Promise<ToolResult> {
  const ctx = await loadCtx(callId);
  // The allowlist is enforced here, for every transport: a sentinel call cannot record a resident's status, etc.
  if (!toolsForPurpose(ctx.call.purpose).includes(name)) {
    await ledger({ actor: "agent", action: `refused: tool ${name} is not allowed on a ${ctx.call.purpose} call`, allowed: false, kind: "refusal", target: ctx.household?.name ?? null });
    return { result: `The ${name} tool is not available on this call.` };
  }
  switch (name) {
    case "record_status": return recordStatus(ctx, RecordStatus.parse(args));
    case "report_hazard": return reportHazard(ctx, ReportHazard.parse(args));
    case "request_human": return requestHuman(ctx, RequestHuman.parse(args));
    case "end_call": {
      const { outcome } = EndCall.parse(args);
      await db().update("calls", callId, { analysis: { ...(ctx.call.analysis ?? {}), end_outcome: outcome } });
      return { result: "The call will end after your goodbye.", end: true };
    }
    case "lookup_zone": return lookupZone(ctx, LookupZone.parse(args));
    case "read_observation": return readObservation(ctx, ReadObservation.parse(args));
    case "received_alert": return receivedAlert(ctx, ReceivedAlert.parse(args));
  }
}

async function recordStatus(ctx: Ctx, a: z.infer<typeof RecordStatus>): Promise<ToolResult> {
  const { call, subject } = ctx;
  if (!subject) return { result: "No person is attached to this call; nothing recorded." };
  const needs = (a.needs ?? []).filter((n): n is Need => (NEEDS as string[]).includes(n));
  const status = STATUS_MAP[a.status];
  const intent: PrimaryIntent = a.status === "not_in_zone" ? "not_in_zone" : a.status === "wrong_number" ? "wrong_number" : a.status;
  const via = call.purpose === "linked_contact" ? "linked_contact" : "resident";
  const fix = await stateFix(a.location_text, a.location_consent, subject);

  await upsertStatus(call, subject.id, {
    status,
    ...(a.understood !== undefined && a.understood !== null ? { understood: a.understood } : {}),
    ...(a.destination ? { destination: a.destination } : {}),
    ...(needs.length ? { needs } : {}),
    ...(a.people ? { people: a.people } : {}),
    ...(a.device_battery_hours !== undefined && a.device_battery_hours !== null ? { device_battery_hours: a.device_battery_hours } : {}),
    ...(a.animals ? { animals: a.animals } : {}),
    ...(a.refusal_reason ? { refusal_reason: a.refusal_reason } : {}),
    ...(a.location_text ? { location_text: a.location_text } : {}),
    via,
  });

  const row: Intent = {
    id: uid(), call_id: call.id, household_id: subject.id, primary_intent: intent, flags: flagsFor(intent, needs, a.animals),
    needs, people: a.people ?? null, location_text: a.location_text ?? null, destination: a.destination ?? null,
    can_leave: a.can_leave ?? null, understood: a.understood ?? null, language: call.vars.language, confidence: 1,
    summary: null, source: "in_call", review_needed: false, created_at: nowIso(),
  };
  // One in-call intent per call: replace the earlier one if the agent recorded twice (teach-back update).
  const prior = (await db().where("intents", { call_id: call.id, source: "in_call" }))[0];
  if (prior) await db().update("intents", prior.id, { ...row, id: prior.id, created_at: prior.created_at });
  else await db().insert("intents", row);

  const hh: Partial<Household> = { last_heard: nowIso() };
  if (a.memory_note) hh.memory_note = a.memory_note.slice(0, 280);
  await db().update("households", subject.id, hh);

  if (a.status === "needs_help_now" || a.status === "needs_help_leaving") {
    await upsertHelp({
      household: subject, zone_id: subject.zone_id ?? (call.vars.zone_id || null),
      priority: a.status === "needs_help_now" ? 1 : 2,
      needs: needs.length ? needs : subject.afn_flags,
      people: a.people ?? null, device_battery_hours: a.device_battery_hours ?? null, animals: a.animals ?? null,
      reason: a.status === "needs_help_now"
        ? `Life safety${needs.length ? `: ${needs.join(", ")}` : ""}`
        : `Needs help leaving: ${(needs.length ? needs : subject.afn_flags).join(", ") || "transport"}`,
      source: helpSource(call), fix,
    });
  } else if (fix) {
    await refreshLocation(subject.id, fix);
  }

  if (a.status === "needs_help_now") return { result: `Recorded as life safety (registry priority 1). If you have not yet, say: hang up and call ${call.vars.emergency_number || "911"} now. Then end the call.` };
  if (a.status === "needs_help_leaving") return { result: "Recorded: needs help leaving (registry priority 2). Tell them a person from the response team will call them back, then end the call." };
  if (a.status === "leaving" || a.status === "already_left") {
    if (a.understood === true) return { result: "Recorded, teach-back passed. Say goodbye and end the call." };
    if (a.understood === false) return { result: "Recorded. Repeat the approved route and evacuation point once, then end the call." };
    return { result: "Recorded. Now ask the teach-back question: where will you go, and by when?" };
  }
  return { result: "Recorded." };
}

function reportType(text: string | null | undefined): ReportType {
  const t = (text ?? "").toLowerCase();
  if (/smoke|humo|연기|烟|धुआ|fumée/.test(t)) return "smoke";
  if (/fire|fuego|flame|불|火|आग|feu/.test(t)) return "fire";
  if (/shak|temblor|흔들|震|झटक|secous/.test(t)) return "shaking";
  if (/wall|damage|collapse|crack|daño|파손|损|नुकसान|dégât/.test(t)) return "damage";
  if (/hurt|injur|herid|부상|伤|घायल|bless/.test(t)) return "injury";
  return "other";
}

async function insertReport(ctx: Ctx, type: ReportType, lat: number, lng: number, textValue: string | null, source: Report["source"]) {
  const zones = await db().all("zones");
  const report: Report = {
    id: uid(), type, lat, lng, zone_id: zoneForPoint(lng, lat, zones)?.id ?? null, source,
    household_id: ctx.household?.id ?? null, call_id: ctx.call.id, text: textValue, synthetic: ctx.call.transport === "sim",
    created_at: nowIso(),
  };
  await db().insert("reports", report);
}

async function reportHazard(ctx: Ctx, a: z.infer<typeof ReportHazard>): Promise<ToolResult> {
  if (!a.seen) return { result: "Recorded: nothing seen. Thank them." };
  const where = a.location_text ? await geocode(a.location_text, ctx.household ? [ctx.household.lng, ctx.household.lat] : undefined) : null;
  const lat = where?.lat ?? ctx.household?.lat;
  const lng = where?.lng ?? ctx.household?.lng;
  if (lat === undefined || lng === undefined) return { result: "Recorded without a location." };
  await insertReport(ctx, a.type, lat, lng, [a.type, a.direction, a.distance].filter(Boolean).join(", "), ctx.call.purpose === "inbound" ? "inbound" : "call");
  await upsertStatus(ctx.call, (ctx.subject ?? ctx.household)!.id, {
    hazard_seen: true, hazard_type: a.type, hazard_direction: a.direction ?? null, hazard_distance: a.distance ?? null,
  });
  return { result: "Recorded. Thank them; do not ask them to go closer." };
}

async function requestHuman(ctx: Ctx, a: z.infer<typeof RequestHuman>): Promise<ToolResult> {
  const { call, subject } = ctx;
  const who = subject?.name ?? "caller";
  if (subject) {
    await upsertStatus(call, subject.id, {
      human_requested: true, human_reason: a.note ? `${a.reason}: ${a.note}` : a.reason,
      ...(a.reason === "distress" || a.reason === "confusion" ? { distress: true } : {}),
      ...(a.reason === "medical_emergency" ? { status: "needs_help" as Status } : {}),
    });
  }
  if (a.reason === "medical_emergency") {
    await ledger({ actor: "agent", action: `flag: life safety, told to hang up and call ${call.vars.emergency_number || "911"}`, kind: "agent", target: who, reason: a.note });
    if (subject) {
      await upsertHelp({ household: subject, zone_id: subject.zone_id ?? (call.vars.zone_id || null), priority: 1, needs: subject.afn_flags,
        reason: `Life safety${a.note ? `: ${a.note}` : ""}`, source: helpSource(call) });
    }
    return { result: `Flagged as life safety. Make sure you said: hang up and call ${call.vars.emergency_number || "911"} now. Then end the call.` };
  }
  if (a.reason === "asked_unapproved" || a.reason === "cannot_answer") {
    await ledger({ actor: "agent", action: `refused: ${a.note ?? "asked for something outside the approved text"}`, allowed: false, kind: "refusal", target: who, reason: "Not in the approved text; a person will call back" });
  } else if (a.reason === "doubts_call") {
    await ledger({ actor: "agent", action: "repeated the verification phrase and callback number (caller doubted the call)", kind: "agent", target: who });
  } else {
    await ledger({ actor: "agent", action: `hand to a person: ${a.reason}`, kind: "agent", target: who, reason: a.note });
  }
  if (subject) {
    await upsertHelp({ household: subject, zone_id: subject.zone_id ?? (call.vars.zone_id || null), priority: 3, needs: [],
      reason: `Call back: ${a.reason.replace(/_/g, " ")}${a.note ? ` (${a.note})` : ""}`, source: helpSource(call) });
  }
  return { result: "Flagged for a person to call back. Tell them a person will call them back." };
}

async function lookupZone(ctx: Ctx, a: z.infer<typeof LookupZone>): Promise<ToolResult> {
  const meta = await getMeta();
  const near: [number, number] | undefined = ctx.household ? [ctx.household.lng, ctx.household.lat] : undefined;
  const hit = await geocode(a.location_text, near);
  if (!hit) return { result: "Could not find that place. Ask once for a nearby intersection or landmark; if still unknown, say a person will call back and use request_human (cannot_answer)." };
  const zones = (await db().all("zones")).filter((z) => z.scenario === meta.scenario);
  const zone = zoneForPoint(hit.lng, hit.lat, zones);
  if (ctx.household) {
    await refreshLocation(ctx.household.id, { lat: hit.lat, lng: hit.lng, accuracy_m: hit.accuracy_m, source: "stated", stated_text: a.location_text, consent: false });
  }
  if (!zone || !zone.directive_text || zone.state === "monitor") {
    return { result: `No active instruction for ${hit.label}. Say you have no instructions for their location and a person will call them back.` };
  }
  // The rest of the call uses this zone's approved texts.
  const vars: CallVars = { ...ctx.call.vars, zone_id: zone.id, zone_name: zone.name, zone_state: zone.state,
    directive_text: zone.directive_text, move_text: zone.move_text ?? "", evac_point: zone.evac_point ?? "" };
  await db().update("calls", ctx.call.id, { vars });
  // A public-line caller's pin moves to where they said they are; they never join a zone's call list.
  if (ctx.household?.device_label === "Public line") await db().update("households", ctx.household.id, { lat: hit.lat, lng: hit.lng });
  return {
    result: `Zone: ${zone.name} (${STATE_LABEL[zone.state]}). Read exactly. Directive: "${zone.directive_text}" Route: "${zone.move_text ?? "(none)"}" Evacuation point: "${zone.evac_point ?? "(none)"}"`,
  };
}

async function readObservation(ctx: Ctx, a: z.infer<typeof ReadObservation>): Promise<ToolResult> {
  const { call, household } = ctx;
  if (!call.hold_id) return { result: "Recorded." };
  const hold = await db().get("holds", call.hold_id);
  // Answers after the hold closed are kept as reports, but never rewrite a sent or cancelled hold's record.
  if (hold && hold.status === "open") {
    const sentinels = hold.sentinels.map((s) =>
      s.household_id === household?.id ? { ...s, answer: a.sees, what: a.what ?? null, direction: a.direction ?? null, answered_at: nowIso() } : s,
    );
    await db().update("holds", hold.id, { sentinels });
  }
  if (household) {
    await db().update("households", household.id, { last_heard: nowIso(), reliability: Math.min(1, household.reliability + 0.05) });
    if (a.sees === "yes") await insertReport(ctx, reportType(a.what), household.lat, household.lng, a.what ?? "matches the alert", "sentinel");
  }
  return { result: "Recorded. Thank them and end the call." };
}

async function receivedAlert(ctx: Ctx, a: z.infer<typeof ReceivedAlert>): Promise<ToolResult> {
  const { call, household } = ctx;
  if (household) await db().update("households", household.id, { last_heard: nowIso(), reliability: Math.min(1, household.reliability + 0.05) });
  if (call.purpose === "canary") {
    const { recordCanary } = await import("./holds");
    await recordCanary(call, a.received);
  }
  return { result: "Recorded. Thank them and end the call." };
}

// ---------- lifecycle ----------

export async function ringCall(call: Call, patch: Partial<Call> = {}) {
  await db().update("calls", call.id, { state: "ringing", started_at: nowIso(), ...patch });
  const target = call.subject_household_id ?? call.household_id;
  if (target && (call.purpose === "resident" || call.purpose === "linked_contact")) {
    await upsertStatus(call, target, { status: "ringing" });
  }
}

export async function answerCall(callId: string) {
  const call = await db().get("calls", callId);
  if (!call || (call.state !== "ringing" && call.state !== "queued")) return call;
  const next = await db().update("calls", callId, { state: "active", answered_at: nowIso(), outcome: "connected", last_activity_at: nowIso() });
  const target = call.subject_household_id ?? call.household_id;
  if (target && (call.purpose === "resident" || call.purpose === "linked_contact" || call.purpose === "inbound")) {
    await upsertStatus(call, target, { status: "on_call" });
  }
  if (call.household_id) await db().update("households", call.household_id, { last_heard: nowIso() });
  return next;
}

/** End a connected call. Runs the post-call pass for real (non-simulated) conversations. */
export async function endCall(callId: string, outcome = "completed") {
  const call = await db().get("calls", callId);
  if (!call || ["ended", "no_answer", "unreachable", "failed", "voicemail", "cancelled"].includes(call.state)) return;
  await db().update("calls", callId, { state: "ended", ended_at: nowIso(), analysis: { ...(call.analysis ?? {}), end_outcome: (call.analysis?.end_outcome as string) ?? outcome } });
  const target = call.subject_household_id ?? call.household_id;
  if (target && (call.purpose === "resident" || call.purpose === "linked_contact" || call.purpose === "inbound")) {
    const campaign_id = await statusCampaignId(call);
    const st = (await db().where("household_status", { campaign_id, household_id: target }))[0];
    if (!st || st.status === "on_call" || st.status === "ringing") await upsertStatus(call, target, { status: "unclear" });
  }
  if (call.transport !== "sim" && call.answered_at && ["resident", "inbound", "linked_contact", "qrt_callback"].includes(call.purpose)) {
    const run = async () => {
      const { runPostCall } = await import("@/lib/agent/postcall");
      await runPostCall(callId).catch((e) => console.error("[postcall]", e));
    };
    try {
      after(run);
    } catch {
      void run();
    }
  }
}

const RETRY_MS = 30_000; // PRD: one retry after 10 minutes, 30 seconds in the demo

/**
 * A call that did not connect (PRD 13): one retry, then the linked contact, then a registry row for
 * people with access and functional needs or in an Order zone. Sentinel and canary silence is handled by
 * the hold (an abstention, never a No).
 */
export async function failCall(callId: string, kind: "no_answer" | "voicemail" | "unreachable" | "failed", note?: string) {
  const call = await db().get("calls", callId);
  if (!call || !["queued", "ringing", "active"].includes(call.state)) return;
  await db().update("calls", callId, { state: kind, outcome: kind === "voicemail" ? "voicemail" : kind === "failed" ? "failed" : "no_answer", ended_at: nowIso() });
  if (kind === "voicemail") {
    await appendTranscript(callId, [{ role: "agent", text: `Voicemail: ${call.vars.directive_text} ${call.vars.move_text} Callback ${call.vars.callback_number}.` }]);
  }
  const household = call.household_id ? await db().get("households", call.household_id) : null;
  if (household && household.role !== "resident") {
    await db().update("households", household.id, { reliability: Math.max(0, household.reliability - 0.1) });
  }
  if (call.purpose !== "resident" && call.purpose !== "linked_contact") return;

  const subject = call.subject_household_id ? await db().get("households", call.subject_household_id) : household;
  if (!subject) return;
  const status: Status = kind === "unreachable" ? "unreachable" : "no_answer";
  await upsertStatus(call, subject.id, { status });
  if (note) await ledger({ actor: "system", action: `call ${kind.replace("_", " ")}`, kind: "system", target: subject.name, reason: note });

  const meta = await getMeta();
  const zone = subject.zone_id ? await db().get("zones", subject.zone_id) : null;
  // A lifted (or monitored) zone gets no more follow-ups.
  if (!zone || zone.state === "lifted" || zone.state === "monitor") return;
  if (call.purpose === "resident" && call.attempt === 1 && kind !== "unreachable") {
    await db().insert("calls", newCall({
      campaign_id: call.campaign_id, household: subject, purpose: "resident",
      vars: buildVars({ zone, household: subject, purpose: "resident", stage: call.vars.stage, meta, alert_text: call.vars.alert_text }),
      attempt: 2, planned_at: isoIn(RETRY_MS), order_index: call.order_index, ring_index: call.ring_index, edge_distance_m: call.edge_distance_m,
    }));
    return;
  }
  if (call.purpose === "resident" && subject.linked_contact_household_id) {
    const contact = await db().get("households", subject.linked_contact_household_id);
    if (contact) {
      await db().insert("calls", newCall({
        campaign_id: call.campaign_id, household: contact, purpose: "linked_contact", subject_household_id: subject.id,
        vars: buildVars({ zone, household: contact, purpose: "linked_contact", stage: call.vars.stage, meta, subject }),
        planned_at: isoIn(1500),
      }));
      await ledger({ actor: "system", action: "calling the linked contact", kind: "system", target: subject.name, reason: `${subject.name} did not answer twice; asking ${contact.name}` });
      return;
    }
  }
  // People who already told us they are leaving or gone are not door-knock rows when their phone goes quiet.
  const said = await db().where("household_status", { household_id: subject.id });
  if (said.some((s) => s.status === "safe" || s.status === "leaving")) return;
  if (subject.afn_flags.length || zone.state === "order") {
    await upsertHelp({ household: subject, zone_id: subject.zone_id, priority: 3, needs: subject.afn_flags,
      reason: `Unreached${subject.afn_flags.length ? ` (${subject.afn_flags.join(", ")})` : ""}: door-knock list`, source: helpSource(call),
      fix: enrolledFix(subject, zone) });
  }
}

// ---------- inbound ----------

/** A call arriving on the public line (Retell inbound or the browser /call page). */
export async function startInboundCall(input: {
  from_number: string | null;
  transport: "retell" | "browser";
  retell_call_id?: string | null;
  lang_code?: string | null;
}): Promise<{ call_id: string; vars: CallVars }> {
  const meta = await getMeta();
  const campaign = await inboundCampaign();
  let household = input.from_number
    ? (await db().where("households", { phone_e164: input.from_number }))[0] ?? null
    : null;
  if (!household) household = await createCaller(input.from_number, input.lang_code ?? "en-US");
  const zone = household.zone_id ? await db().get("zones", household.zone_id) : null;
  const call = newCall({
    campaign_id: campaign.id, household, purpose: "inbound",
    vars: buildVars({ zone, household, purpose: "inbound", stage: "inbound", meta }),
  });
  call.transport = input.transport;
  call.retell_call_id = input.retell_call_id ?? null;
  call.state = input.transport === "retell" ? "active" : "ringing";
  call.started_at = nowIso();
  if (input.transport === "retell") {
    call.answered_at = nowIso();
    call.outcome = "connected";
  }
  await db().insert("calls", call);
  await ledger({ actor: "system", action: "inbound call on the public line", kind: "system", target: household.name, reason: input.transport });
  return { call_id: call.id, vars: call.vars };
}

async function createCaller(from: string | null, lang_code: string): Promise<Household> {
  const meta = await getMeta();
  const zones = (await db().all("zones")).filter((z) => z.scenario === meta.scenario);
  const [lng, lat] = zones.length ? centroidOf(zones[0].geom) : [-118.4, 34.02];
  const lang = languageByCode(lang_code);
  const h: Household = {
    id: uid(), name: from ? `Caller ${from.slice(-4)}` : "Public line caller", address: null, lat, lng,
    has_device: true, device_label: "Public line", synthetic: false, language: lang.name, lang_code: lang.code,
    afn_flags: [], memory_note: null, linked_contact_household_id: null, linked_contact_name: null,
    can_drive_neighbors: false, seats: 0, phone_e164: from, role: "resident", channel: from ? "voice" : "browser",
    zone_id: null, on_post: false, reliability: 0.5, last_heard: nowIso(), presence_at: nowIso(), scenario: meta.scenario, sim_profile: null,
  };
  await db().insert("households", h);
  return h;
}

/** The browser public line: a caller phone plus a ringing inbound call it will auto-answer. */
export async function startBrowserInbound(lang_code: string) {
  const { call_id } = await startInboundCall({ from_number: null, transport: "browser", lang_code });
  const call = await db().get("calls", call_id);
  return { call_id, household_id: call!.household_id! };
}

export async function feedTransport(title: string, detail: string) {
  await feed({ kind: "transport", severity: "warn", title, detail });
}
