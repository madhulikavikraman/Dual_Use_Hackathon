import "server-only";
import { randomBytes } from "node:crypto";
import type { LocateResult, PhoneState, ShareSummary, ShareView } from "@/lib/contracts";
import { db, nowIso, uid, withLock } from "@/lib/db";
import { geocode } from "@/lib/geocode";
import { metersBetween } from "@/lib/geo";
import { HttpError } from "@/lib/http";
import { jurisdictionFor } from "@/lib/jurisdictions";
import { isE164, publicBase, sendSms } from "@/lib/sms";
import type { Call, HelpRequest, HelpSource, Household, LocationShare, ShareConsentSource, ShareStatus, ShareVia } from "@/lib/types";
import { DISPATCH_ACTIVE, SHARE_ACTIVE } from "@/lib/types";
import { feed, getMeta, ledger } from "./log";
import { recordFix, refreshLocation, upsertHelp, type Fix } from "./registry";

// Live location with consent (PRD item 61, decision D-12). On a call the agent asks once; on a clear yes it records
// the person's words and a link is texted (or, on the six demo devices, shown on the browser phone). The person
// opens /l/[token] and taps Share: each GPS fix lands in the locations table (source gps_link, consent true) and
// refreshes their registry row. The share stops when they stop it, when help reaches them, or after 4 hours.
// The location is for the response team only: public feeds keep the hex cell (app/api/feeds).

export const SHARE_TTL_MS = 4 * 60 * 60_000;
/** Server-side floor between two fixes on one link (the page sends at most every 5 s, sooner only after 25 m). */
export const MIN_PING_GAP_MS = 2_000;
const MAX_ACCURACY_M = 5_000;
const MAX_SPEED_MS = 90; // about 320 km/h beyond both accuracy radii: a bad fix, not a person
const SIM_PINGS = 3;
const SIM_PING_EVERY_MS = 6_000;

/** 24 random bytes = 192 bits, base64url (32 characters). */
export const newToken = () => randomBytes(24).toString("base64url");
export const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;

export const shareLink = (token: string, origin?: string | null) => `${publicBase(origin)}/l/${token}`;

const newestFirst = <T extends { created_at: string }>(a: T, b: T) => (a.created_at < b.created_at ? 1 : -1);
const isLive = (s: LocationShare) => SHARE_ACTIVE.includes(s.status) && Date.parse(s.expires_at) > Date.now();

export async function shareByToken(token: string): Promise<LocationShare | null> {
  if (!TOKEN_RE.test(token)) return null;
  return (await db().where("location_shares", { token }))[0] ?? null;
}

/** The person's current link (sent or live, not expired), if any. */
export async function activeShareFor(householdId: string): Promise<LocationShare | null> {
  return (await db().where("location_shares", { household_id: householdId })).filter(isLive).sort(newestFirst)[0] ?? null;
}

function sourceFor(call: Call | null): HelpSource {
  if (!call) return "manual";
  if (call.transport === "sim") return "sim";
  if (call.purpose === "inbound") return "inbound";
  return call.vars.stage === "2" ? "stage2" : call.vars.stage === "3" ? "stage3" : "stage1";
}

const VIA_LABEL: Record<ShareVia, string> = {
  twilio: "texted (Twilio)",
  retell: "texted (Retell)",
  browser_phone: "shown on the browser phone (demo: no text sent)",
  simulated: "not texted (demo: no text-message provider set)",
};

export interface CreateShareInput {
  household: Household;
  call: Call | null;
  consent_quote: string;
  consent_source: ShareConsentSource;
  synthetic: boolean;
  /** Who heard the yes: "agent" on a call, "system" for Retell's post-call analysis. */
  actor?: string;
  origin?: string | null;
}

export interface CreateShareResult {
  share: LocationShare;
  created: boolean;
  via: ShareVia;
  link: string;
}

/**
 * Record consent and send the link. Never creates a second share: a person with a link still on keeps it, and a call
 * that already produced a share (even one the person stopped) never produces another.
 */
export async function createShare(input: CreateShareInput): Promise<CreateShareResult> {
  const h = input.household;
  const result = await withLock(`share:${h.id}`, async (): Promise<CreateShareResult> => {
    const existing = await activeShareFor(h.id);
    const byCall = input.call ? (await db().where("location_shares", { call_id: input.call.id }))[0] : undefined;
    const prior = existing ?? byCall;
    if (prior) return { share: prior, created: false, via: prior.sent_via ?? "simulated", link: shareLink(prior.token, input.origin) };

    // The share hangs off the person's registry row; someone who shares without one (staying inside an Order zone)
    // gets a "check later" row, so the response team can see the pin and send someone.
    const open = (await db().where("help_requests", { household_id: h.id })).filter((r) => r.status !== "closed" && (r.kind ?? "people") === "people");
    const row: HelpRequest =
      open[0] ??
      (await upsertHelp({
        household: h, zone_id: h.zone_id ?? (input.call?.vars.zone_id || null), priority: 3, needs: h.afn_flags,
        reason: "Shared live location: check on them", source: sourceFor(input.call),
      }));

    const now = nowIso();
    const share: LocationShare = {
      id: uid(),
      token: newToken(),
      household_id: h.id,
      help_request_id: row.id,
      call_id: input.call?.id ?? null,
      phone: h.phone_e164,
      consent_quote: input.consent_quote.trim().slice(0, 400),
      consent_source: input.consent_source,
      consented_at: now,
      status: "sent",
      expires_at: new Date(Date.now() + SHARE_TTL_MS).toISOString(),
      last_lat: null,
      last_lng: null,
      last_accuracy_m: null,
      last_heading: null,
      last_speed: null,
      last_fix_at: null,
      ping_count: 0,
      sent_via: null,
      stop_reason: null,
      synthetic: input.synthetic,
      created_at: now,
      updated_at: now,
    };
    await db().insert("location_shares", share);

    const link = shareLink(share.token, input.origin);
    let via: ShareVia;
    let note: string | null = null;
    // A simulated call (the simulator, or autopilot playing a device) never sends a real text.
    if (!input.synthetic && isE164(h.phone_e164)) {
      const sms = await sendSms(
        h.phone_e164,
        `Emergency information line: you agreed to share your live location with the response team until help reaches you. Open ${link} and tap Share. You can stop at any time. (Hackathon demo)`,
      );
      via = sms.via === "simulated" ? (h.has_device ? "browser_phone" : "simulated") : sms.via;
      note = sms.note;
    } else {
      via = h.has_device ? "browser_phone" : "simulated";
    }
    await db().update("location_shares", share.id, { sent_via: via });

    await ledger({
      actor: input.actor ?? "agent",
      action: `live location: consent recorded, link ${VIA_LABEL[via]}`,
      kind: "agent",
      target: h.name,
      reason: `"${share.consent_quote}" (${input.consent_source.replace("_", " ")})${note && via !== "twilio" && via !== "retell" ? `; ${note}` : ""}`,
    });
    await feed({
      kind: "info", zone_id: row.zone_id,
      title: "Live location link sent",
      detail: `P${row.priority} · ${row.zone_id ?? "no zone"} · ${VIA_LABEL[via]}. Waiting for the person to tap it.${share.synthetic ? " Synthetic." : ""}`,
    });
    return { share: { ...share, sent_via: via }, created: true, via, link };
  });
  return result!;
}

// ---------- settling: expiry, help reached ----------

async function finish(share: LocationShare, status: ShareStatus, reason: string, actor: string): Promise<LocationShare> {
  const next = await db().update("location_shares", share.id, { status, stop_reason: reason, updated_at: nowIso() });
  const h = share.household_id ? await db().get("households", share.household_id) : null;
  await ledger({ actor, action: `live location ${status}`, kind: "system", target: h?.name ?? null, reason });
  return next ?? { ...share, status, stop_reason: reason };
}

/** Expire a link after 4 hours, and close it once the person's registry row is reached or closed. */
async function settle(share: LocationShare): Promise<LocationShare> {
  if (!SHARE_ACTIVE.includes(share.status)) return share;
  if (Date.parse(share.expires_at) <= Date.now()) return finish(share, "expired", "4 hours after consent", "timer");
  if (share.help_request_id) {
    const row = await db().get("help_requests", share.help_request_id);
    if (row && (row.status === "reached" || row.status === "closed")) return finish(share, "closed", `help request ${row.status}`, "system");
  }
  return share;
}

/** Reached or closed on the board or by a helper: stop the person's link and stand down any helper still out. */
export async function onHelpFinal(helpId: string, status: "reached" | "closed", actor: string) {
  for (const s of (await db().where("location_shares", { help_request_id: helpId })).filter((x) => SHARE_ACTIVE.includes(x.status))) {
    await finish(s, "closed", `help request ${status} (${actor})`, "system");
  }
  for (const d of (await db().where("dispatches", { help_request_id: helpId })).filter((x) => DISPATCH_ACTIVE.includes(x.status))) {
    await db().update("dispatches", d.id, { status: status === "reached" ? "reached" : "cancelled", updated_at: nowIso() });
  }
}

const GONE: Record<ShareStatus, string> = {
  sent: "",
  live: "",
  stopped: "You stopped sharing. Nothing more is sent from this link.",
  expired: "This link has expired (4 hours). Nothing more is sent.",
  closed: "Help has reached you, so this link stopped sharing.",
};

// ---------- the resident's page ----------

export async function shareView(share: LocationShare): Promise<ShareView> {
  const [row, dispatches, meta] = await Promise.all([
    share.help_request_id ? db().get("help_requests", share.help_request_id) : Promise.resolve(null),
    share.help_request_id ? db().where("dispatches", { help_request_id: share.help_request_id }) : Promise.resolve([]),
    getMeta(),
  ]);
  return {
    status: share.status,
    consent_quote: share.consent_quote,
    consented_at: share.consented_at,
    expires_at: share.expires_at,
    last_fix_at: share.last_fix_at,
    last_accuracy_m: share.last_accuracy_m,
    ping_count: share.ping_count,
    helper_assigned: dispatches.some((d) => DISPATCH_ACTIVE.includes(d.status)),
    reached: row?.status === "reached" || dispatches.some((d) => d.status === "reached"),
    emergency_number: jurisdictionFor(meta.jurisdiction).call_now,
    synthetic: share.synthetic,
    now: nowIso(),
  };
}

export async function viewByToken(token: string): Promise<ShareView> {
  const share = await shareByToken(token);
  if (!share) throw new HttpError(404, "This link is not valid.");
  return shareView(await settle(share));
}

export interface PingInput {
  lat: number;
  lng: number;
  accuracy_m: number;
  heading?: number | null;
  speed?: number | null;
  captured_at?: string | null;
}

function checkFix(p: PingInput) {
  const ok = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  if (!ok(p.lat) || !ok(p.lng) || p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) throw new HttpError(422, "Coordinates out of range.");
  if (Math.abs(p.lat) < 1e-6 && Math.abs(p.lng) < 1e-6) throw new HttpError(422, "No position (0, 0).");
  if (!ok(p.accuracy_m) || p.accuracy_m <= 0 || p.accuracy_m > MAX_ACCURACY_M) throw new HttpError(422, `Accuracy must be between 0 and ${MAX_ACCURACY_M} m.`);
  if (p.captured_at) {
    const t = Date.parse(p.captured_at);
    if (!Number.isFinite(t) || t > Date.now() + 60_000 || t < Date.now() - 10 * 60_000) throw new HttpError(422, "The fix is too old or from the future.");
  }
}

/** One GPS fix from the link. 404 unknown, 410 stopped / expired / closed, 422 implausible, 429 too fast. */
export async function pingShare(token: string, p: PingInput): Promise<ShareView> {
  const out = await withLock(`ping:${token}`, async () => {
    const found = await shareByToken(token);
    if (!found) throw new HttpError(404, "This link is not valid.");
    const share = await settle(found);
    if (!SHARE_ACTIVE.includes(share.status)) throw new HttpError(410, GONE[share.status]);
    checkFix(p);
    const now = Date.now();
    if (share.last_fix_at && now - Date.parse(share.last_fix_at) < MIN_PING_GAP_MS) throw new HttpError(429, "Too many fixes: at most one every 2 seconds.");
    if (share.last_lat !== null && share.last_lng !== null && share.last_fix_at) {
      const dt = Math.max(1, (now - Date.parse(share.last_fix_at)) / 1000);
      const moved = metersBetween([share.last_lng, share.last_lat], [p.lng, p.lat]) - p.accuracy_m - (share.last_accuracy_m ?? 0);
      if (moved > MAX_SPEED_MS * dt) throw new HttpError(422, "That fix jumps too far from the last one; it was not recorded.");
    }
    const accuracy = Math.round(p.accuracy_m * 10) / 10;
    const fix: Fix = { lat: p.lat, lng: p.lng, accuracy_m: accuracy, source: "gps_link", stated_text: null, consent: true };
    let helpId = share.help_request_id;
    if (share.household_id) {
      const row = await refreshLocation(share.household_id, fix, helpId);
      helpId ??= row?.id ?? null;
    } else {
      await recordFix(null, helpId, fix);
    }
    const first = share.status === "sent";
    const at = nowIso();
    const next = (await db().update("location_shares", share.id, {
      status: "live", last_lat: p.lat, last_lng: p.lng, last_accuracy_m: accuracy,
      last_heading: typeof p.heading === "number" && Number.isFinite(p.heading) ? p.heading : null,
      last_speed: typeof p.speed === "number" && Number.isFinite(p.speed) ? p.speed : null,
      last_fix_at: at, ping_count: share.ping_count + 1, help_request_id: helpId, updated_at: at,
    }))!;
    if (first) {
      const row = helpId ? await db().get("help_requests", helpId) : null;
      const h = share.household_id ? await db().get("households", share.household_id) : null;
      // The board feed carries no name and no phone; the ledger names who it is about, as every ledger line does.
      await feed({
        kind: "needs_help", severity: "warn", zone_id: row?.zone_id ?? null,
        title: "Live location received",
        detail: `${row ? `P${row.priority} · ${row.zone_id ?? "no zone"} · ` : ""}accuracy ${Math.round(accuracy)} m · response team only${share.synthetic ? " · synthetic" : ""}`,
      });
      await ledger({ actor: "system", action: "live location received", kind: "system", target: h?.name ?? null, reason: `First GPS fix on the link, accuracy ${Math.round(accuracy)} m` });
    }
    return next;
  });
  return shareView(out!);
}

/** The person stops sharing from the link. */
export async function stopShare(token: string): Promise<ShareView> {
  const found = await shareByToken(token);
  if (!found) throw new HttpError(404, "This link is not valid.");
  const share = await settle(found);
  if (!SHARE_ACTIVE.includes(share.status)) return shareView(share);
  const h = share.household_id ? await db().get("households", share.household_id) : null;
  return shareView(await finish(share, "stopped", "Stopped by the person on the link", h ? `${h.name} (on the link)` : "resident (on the link)"));
}

/** "Tell us where you are" on the link (no GPS, or permission denied): geocoded through the stated-location path. */
export async function statedOnLink(token: string, text: string): Promise<LocateResult> {
  const found = await shareByToken(token);
  if (!found) throw new HttpError(404, "This link is not valid.");
  const share = await settle(found);
  if (share.status === "expired" || share.status === "closed") throw new HttpError(410, GONE[share.status]);
  const words = text.trim().slice(0, 200);
  if (words.length < 3) throw new HttpError(422, "Type a street address, a cross street or a landmark.");
  const h = share.household_id ? await db().get("households", share.household_id) : null;
  const hit = await geocode(words, h ? [h.lng, h.lat] : undefined);
  if (hit && h) {
    // Consent: they typed it on the response team's link. A fresh GPS fix still wins (registry rank).
    await refreshLocation(h.id, { lat: hit.lat, lng: hit.lng, accuracy_m: hit.accuracy_m, source: "stated", stated_text: words, consent: true }, share.help_request_id);
  }
  await ledger({
    actor: "system", kind: "system", target: h?.name ?? null,
    action: hit ? "location typed on the link (geocoded)" : "location typed on the link (not found on the map)",
    reason: words,
  });
  if (!hit) {
    const row = share.help_request_id ? await db().get("help_requests", share.help_request_id) : null;
    await feed({ kind: "needs_help", severity: "warn", zone_id: row?.zone_id ?? null, title: "Typed location not found on the map", detail: `“${words}” — call them back to confirm.` });
  }
  return { ...(await shareView(share)), stated: { found: Boolean(hit), label: hit?.label ?? null } };
}

// ---------- the browser phone and the board ----------

/** For /phone/[id]: the person's live link, so the demo devices get it on screen. */
export async function phoneShare(householdId: string): Promise<PhoneState["location_share"]> {
  const s = await activeShareFor(householdId);
  return s ? { token: s.token, status: s.status, expires_at: s.expires_at } : null;
}

export function shareSummary(s: LocationShare): ShareSummary {
  return {
    id: s.id, help_request_id: s.help_request_id, household_id: s.household_id, status: s.status, consent_source: s.consent_source,
    consent_quote: s.consent_quote, consented_at: s.consented_at, expires_at: s.expires_at, last_fix_at: s.last_fix_at,
    last_accuracy_m: s.last_accuracy_m, ping_count: s.ping_count, sent_via: s.sent_via, synthetic: s.synthetic,
  };
}

// ---------- tick: expiry and the simulator's pings ----------

function jitter(lat: number, lng: number, minM: number, maxM: number): [number, number] {
  const d = minM + Math.random() * (maxM - minM);
  const a = Math.random() * 2 * Math.PI;
  return [lat + (d * Math.cos(a)) / 111_320, lng + (d * Math.sin(a)) / (111_320 * Math.cos((lat * Math.PI) / 180))];
}

/** Where a synthetic person "is": the place they stated on the call, else the enrolled address. */
async function simBase(share: LocationShare): Promise<[number, number] | null> {
  if (share.help_request_id) {
    const prior = (await db().where("locations", { help_request_id: share.help_request_id }))
      .filter((f) => f.source === "stated")
      .sort((a, b) => (a.observed_at < b.observed_at ? 1 : -1))[0];
    if (prior) return [prior.lat, prior.lng];
  }
  const h = share.household_id ? await db().get("households", share.household_id) : null;
  return h ? [h.lat, h.lng] : null;
}

/** Called by every tick: expire links, close those whose help arrived, and play synthetic people's phones. */
export async function locateTick(): Promise<number> {
  let n = 0;
  const shares = (await db().all("location_shares")).filter((s) => SHARE_ACTIVE.includes(s.status));
  for (const s of shares) {
    const settled = await settle(s);
    if (settled.status !== s.status) {
      n++;
      continue;
    }
    // Synthetic people (and autopilot devices) "tap the link": two or three pings, 5-15 m around their spot.
    if (!s.synthetic || s.ping_count >= SIM_PINGS) continue;
    const last = Date.parse(s.last_fix_at ?? s.created_at);
    if (Date.now() - last < SIM_PING_EVERY_MS) continue;
    const base = await simBase(s);
    if (!base) continue;
    const [lat, lng] = jitter(base[0], base[1], 5, 15);
    try {
      await pingShare(s.token, { lat, lng, accuracy_m: 6 + Math.round(Math.random() * 8), heading: null, speed: 0, captured_at: nowIso() });
      n++;
    } catch (e) {
      if (!(e instanceof HttpError)) console.error("[locate] sim ping", e);
    }
  }
  return n;
}
