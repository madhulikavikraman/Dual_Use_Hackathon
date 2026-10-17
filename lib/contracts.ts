// API contracts shared by route handlers and client pages. Client-safe (types only, no server imports).
import type {
  AlertItem, Call, CallPurpose, CallState, Campaign, CampaignKind, Canary, Cluster, DispatchStatus, HelpRequest, HelpStatus, Helper, Hold,
  Household, LedgerEntry, LocationSource, Meta, Need, PickupRun, Proposal, Report, ShareConsentSource, ShareStatus, ShareVia, SimPreset,
  Status, Transport, Zone, ZoneState,
} from "@/lib/types";

// ---------- GET /api/board (polled every ~1 s by the board; each poll also advances the tick) ----------

export interface HouseholdView extends Household {
  status: Status; // latest across campaigns, "pending" if never called
  status_at: string | null;
  via: "resident" | "linked_contact" | null;
  understood: boolean | null;
  destination: string | null;
  needs: Need[];
  human_requested: boolean;
  call_state: CallState | null; // latest call to this person
  call_id: string | null;
  ring_index: number | null;
}

export interface CallView {
  id: string;
  household_id: string | null;
  household_name: string | null;
  device_label: string | null;
  purpose: CallPurpose;
  state: CallState;
  transport: Transport;
  language: string;
  zone_id: string;
  campaign_id: string | null;
  hold_id: string | null;
  attempt: number;
  simulated: boolean;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  summary: string | null;
  last_line: string | null; // last thing said, for the live strip
}

export interface BoardMetrics {
  real_phones: number; // volunteer devices in this scenario
  real_accounted: number; // volunteer devices with a final status (synthetic rows excluded, D-20)
  reached: number; // households with a connected call in any campaign
  in_campaigns: number;
  understood_pct: number | null; // of reached residents, teach-back passed
  needs_help_open: number;
  calls_active: number;
  calls_queued: number;
  refusals: number;
  human_decisions: number;
  cost_minutes: number;
  cost_usd: number;
}

export interface BoardSnapshot {
  now: string;
  backend: "local" | "supabase";
  retell: boolean; // phone-network transport configured
  meta: Meta;
  zones: Zone[];
  proposals: Proposal[];
  households: HouseholdView[];
  calls: CallView[]; // newest first, last 80
  campaigns: Campaign[]; // newest first, last 20
  holds: Hold[]; // open first, then last 5
  canaries: Canary[];
  registry: HelpRequest[]; // open-ish first, sorted by priority then age
  runs: PickupRun[];
  ledger: LedgerEntry[]; // newest first, last 150
  feed: AlertItem[]; // newest first, last 50
  clusters: Cluster[];
  reports: Report[]; // last 200
  metrics: BoardMetrics;
}

// ---------- Action bodies (POST/PATCH JSON). Every human action carries a name and a reason. ----------

export interface ApproveZoneBody {
  state: ZoneState;
  /** Omitted texts fall back to the zone's approved defaults for the state; the directive is never empty. */
  directive_text?: string;
  move_text?: string;
  evac_point?: string | null;
  approved_by: string;
  reason: string;
  /** Incident commander order: skip the hold for an Order (logged). */
  bypass_hold?: boolean;
}
export interface ApproveZoneResult {
  zone: Zone;
  campaign: Campaign | null; // Stage 1 / Stage 3 / shelter calls started
  hold: Hold | null; // an Order opens a hold instead of changing the zone at once
}

export interface ZoneDefaults {
  directive_text: string;
  move_text: string;
  evac_point: string | null;
}

export interface DecideProposalBody {
  decision: "approve" | "reject";
  actor: string;
  reason: string;
  // On approve, the same fields as ApproveZoneBody may override the defaults:
  directive_text?: string;
  move_text?: string;
  evac_point?: string | null;
}

export interface DecideProposalResult {
  proposal: Proposal;
  result: ApproveZoneResult | null;
}

export interface StartCampaignBody {
  zone_id: string;
  kind: Extract<CampaignKind, "warning" | "order" | "rollcall" | "test" | "checkin" | "shelter" | "all_clear">;
  wave?: 1 | 2 | 3;
  started_by: string;
  reason?: string;
}

export interface OpenHoldBody {
  zone_id: string;
  proposed_state: Extract<ZoneState, "order" | "shelter_in_place">;
  alert_text?: string; // defaults to the zone's directive for the proposed state
  directive_text?: string;
  move_text?: string;
  evac_point?: string | null;
  opened_by: string;
  reason: string;
  /** "county" composes the deliberately wrong countywide polygon (January 9 demo). */
  polygon?: "zone" | "county";
}

export interface HoldDecisionBody {
  decision: "send" | "hold_once" | "edit" | "cancel" | "hand_off";
  actor: string;
  reason: string;
  /** For "edit": replace the polygon with the zone's own polygon (default) or a provided one. */
  polygon?: GeoJSON.Polygon | "zone";
}

export interface RegistryPatchBody {
  status?: HelpStatus;
  assigned_to?: string | null;
  actor: string;
  reason?: string;
}

export interface DemoResetBody {
  scenario?: "westside" | "heat" | "altadena" | "chongqing" | "norte";
}

export interface DemoSimBody {
  /** Directive vocabulary: civilian (Cal OES), heat (heat check-in line for older residents), base (installation lockdown). */
  mode?: "civilian" | "heat" | "base";
  preset?: SimPreset; // switch the simulator preset
  autopilot_devices?: boolean;
  wrong_polygon?: boolean;
  event?: "tower_down" | "earthquake" | "hoax_flood" | "fire_spreading" | "mass_no_answer" | "dark_zone";
}

// ---------- Phone (browser transport) ----------

/** GET /api/phone/[id] — polled every ~1 s by /phone/[id]; also the presence heartbeat. */
export interface PhoneState {
  household: Pick<Household, "id" | "name" | "language" | "lang_code" | "device_label" | "role" | "zone_id">;
  call: (Pick<Call, "id" | "state" | "purpose" | "started_at" | "answered_at" | "ended_at"> & {
    lines: { role: "agent" | "person"; text: string; at: string }[];
    lang_code: string;
    zone_name: string;
  }) | null;
  retell: boolean;
  simulated: boolean;
  /** A live-location link this person agreed to on a call (sent or live). The demo devices get it here, on screen. */
  location_share?: { token: string; status: ShareStatus; expires_at: string } | null;
}

/** POST /api/phone/[id] body. */
export interface PhoneActionBody {
  action: "answer" | "decline" | "say" | "hangup";
  call_id: string;
  text?: string; // for "say": what the person said (speech-to-text or typed)
}

/** Response to "answer" and "say": what the agent says next. */
export interface PhoneTurnResult {
  reply: string; // agent's spoken line ("" when nothing to say)
  ended: boolean; // agent ended the call
  lang_code: string;
}

// ---------- Live location (/l/[token], open: the token is the key) ----------

/** GET /api/locate/[token]: what the resident's page shows. No name, no phone, no ETA. */
export interface ShareView {
  status: ShareStatus;
  consent_quote: string;
  consented_at: string;
  expires_at: string;
  last_fix_at: string | null;
  last_accuracy_m: number | null;
  ping_count: number;
  /** A responder has their location (a helper was sent). Never an arrival time. */
  helper_assigned: boolean;
  reached: boolean;
  emergency_number: string;
  synthetic: boolean;
  now: string;
}

/** POST /api/locate/[token]. Without `action` it is a GPS fix. */
export type LocateBody =
  | { action?: "fix"; lat: number; lng: number; accuracy_m: number; heading?: number | null; speed?: number | null; captured_at?: string }
  | { action: "stop" }
  | { action: "stated"; text: string };

export interface LocateResult extends ShareView {
  stated?: { found: boolean; label: string | null };
}

// ---------- Live registry for the board and QRT (GET /api/registry/live, desk only) ----------

export interface ShareSummary {
  id: string;
  help_request_id: string | null;
  household_id: string | null;
  status: ShareStatus;
  consent_source: ShareConsentSource;
  consent_quote: string;
  consented_at: string;
  expires_at: string;
  last_fix_at: string | null;
  last_accuracy_m: number | null;
  ping_count: number;
  sent_via: ShareVia | null;
  synthetic: boolean;
}

export interface DispatchSummary {
  id: string;
  help_request_id: string;
  helper_label: string;
  status: DispatchStatus;
  dispatched_by: string;
  reason: string;
  note: string | null;
  sent_via: string | null;
  created_at: string;
  updated_at: string;
  /** The helper's page (/helper/[token]). Shown to the dispatcher, who is the one sending it. */
  link: string;
}

export interface LiveRegistry {
  now: string;
  shares: ShareSummary[]; // newest first
  dispatches: DispatchSummary[]; // newest first
  roster: Helper[];
  sms: "retell" | "twilio" | "simulated";
}

/** POST /api/registry/[id]/dispatch: send a helper to the row's latest location (a named human and a reason). */
export interface SendHelperBody {
  helper_id?: string;
  helper_label?: string;
  helper_phone?: string | null;
  actor: string;
  reason: string;
}

// ---------- Helper page (/helper/[token], open: the token is the key) ----------

export interface HelperView {
  now: string;
  status: DispatchStatus;
  helper_label: string;
  dispatched_by: string;
  reason: string;
  created_at: string;
  note: string | null;
  person: {
    name: string | null;
    phone: string | null;
    language: string | null;
    people: number | null;
    needs: Need[];
    priority: 1 | 2 | 3 | 4;
    reason: string | null;
    animals: string | null;
    device_battery_hours: number | null;
    zone_id: string | null;
    zone_name: string | null;
    help_status: HelpStatus;
    synthetic: boolean;
  };
  location: {
    lat: number;
    lng: number;
    accuracy_m: number | null;
    source: LocationSource;
    observed_at: string;
    stated_text: string | null;
  } | null;
  share_status: ShareStatus | null;
  emergency_number: string;
}

export interface HelperUpdateBody {
  status: Extract<DispatchStatus, "en_route" | "arrived" | "reached" | "cannot_reach">;
  note?: string;
}

// ---------- Twists ----------

export interface TwistBody {
  twist_no: number;
  title: string;
  twist_text?: string;
  what_changed: string;
  why?: string;
  proof?: string;
  commits?: string[];
}
