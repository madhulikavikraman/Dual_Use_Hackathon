// VoiceFlare domain types. Shared by server routes, the engine and client pages.
// All timestamps are ISO 8601 UTC strings.

export type Stage = "checkin" | "warning" | "order" | "all_clear";
export type Mode = "civilian" | "campus" | "base";

export type Status =
  | "pending" | "queued" | "ringing" | "on_call"
  | "safe" | "leaving" | "needs_help" | "wont_leave" | "unclear" | "wrong_number"
  | "no_answer" | "unreachable";

export type Need =
  | "wheelchair" | "walker" | "no_car" | "oxygen" | "powered_medical_device" | "dialysis"
  | "bedbound" | "children_alone" | "hearing" | "vision" | "cognitive" | "other";

export const NEEDS: Need[] = [
  "wheelchair", "walker", "no_car", "oxygen", "powered_medical_device", "dialysis",
  "bedbound", "children_alone", "hearing", "vision", "cognitive", "other",
];

// ---------- Zones ----------

/** Cal OES standard vocabulary, stored values (decision D-03). */
export type ZoneState = "monitor" | "watch" | "warning" | "order" | "shelter_in_place" | "lifted";
export const ZONE_STATES: ZoneState[] = ["monitor", "watch", "warning", "order", "shelter_in_place", "lifted"];

export type ZoneSource = "human" | "model" | "nws" | "seed";
export type Scenario = "westside" | "altadena" | "usc" | "chongqing";

export interface Zone {
  id: string; // e.g. "LA-CC"
  name: string;
  scenario: Scenario;
  geom: GeoJSON.Polygon;
  state: ZoneState;
  directive_text: string | null; // read verbatim by the agent
  move_text: string | null; // approved route text, read verbatim
  evac_point: string | null; // approved evacuation point name
  evac_point_lat: number | null;
  evac_point_lng: number | null;
  fact_sheet: string | null; // approved answers: pets policy, closures
  population_est: number | null; // dose preview (estimate)
  area_sq_mi: number | null;
  hazard_origin: [number, number] | null; // [lng, lat] the hazard comes from (edge-first ordering)
  source: ZoneSource;
  approved_by: string | null;
  approved_at: string | null;
  version: number;
  updated_at: string;
}

export interface ZoneEvent {
  id: string;
  zone_id: string;
  from_state: ZoneState;
  to_state: ZoneState;
  source: ZoneSource;
  actor: string;
  reason: string;
  hold_id: string | null;
  created_at: string;
}

export type ProposalModel = "fire_envelope" | "call_pattern" | "nws";
export type ProposalStatus = "open" | "approved" | "edited" | "rejected";

export interface Proposal {
  id: string;
  zone_id: string;
  proposed_state: ZoneState;
  model: ProposalModel;
  reason: string;
  score: number;
  envelope: GeoJSON.Polygon | null; // e.g. the fire envelope ellipse that triggered it
  status: ProposalStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  created_at: string;
}

// ---------- People ----------

export type Role = "resident" | "sentinel" | "canary" | "staff";
export type Channel = "voice" | "sms" | "landline" | "browser";

export interface Household {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  has_device: boolean; // a volunteer phone page (and maybe a real number) plays this person
  device_label: string | null; // "Phone 1".."Phone 6"
  synthetic: boolean;
  language: string;
  lang_code: string;
  afn_flags: Need[];
  memory_note: string | null;
  linked_contact_household_id: string | null; // linked contact is another device-holder
  linked_contact_name: string | null;
  can_drive_neighbors: boolean;
  seats: number;
  phone_e164: string | null; // volunteer devices only (Retell transport)
  role: Role;
  channel: Channel;
  zone_id: string | null; // by point-in-polygon at seed / reset
  on_post: boolean; // sentinel currently on shift
  reliability: number; // 0..1, from answered vs silent asks
  last_heard: string | null; // last time this person answered anything
  presence_at: string | null; // browser phone heartbeat
  scenario: Scenario;
  sim_profile: SimProfile | null; // how a synthetic person answers in the simulator
  /** Collections line: what cannot be replaced and the grab list, in the owner's words (museums, libraries, archives,
   * galleries, collectors). Lives first: salvage is offered only at Warning, never under an Order. */
  collection_note?: string | null;
}

/** Scripted behavior for synthetic people (never used for real phones). */
export type SimProfile =
  | "leaving" | "needs_help_leaving" | "needs_help_now" | "staying" | "already_left"
  | "no_answer" | "unclear" | "voicemail"
  | "sentinel_yes" | "sentinel_no" | "sentinel_unsure" | "silent"
  | "canary_no" | "canary_yes";

// ---------- Campaigns and calls ----------

export type CampaignKind =
  | "checkin" | "warning" | "order" | "all_clear" | "shelter"
  | "hold" | "canary" | "rollcall" | "qrt_callback" | "test" | "inbound";

export interface Campaign {
  id: string;
  kind: CampaignKind;
  stage: Stage; // legacy stage, kept for the original board
  mode: Mode;
  zone_id: string | null;
  zone_name: string | null;
  polygon: GeoJSON.Polygon | null;
  alert_text: string;
  directive_text: string | null;
  move_text: string | null;
  evac_point: string | null;
  wave: 1 | 2 | 3 | null;
  order_rule: "edge_first" | "risk_first" | "none";
  started_by: string;
  verification_phrase: string | null;
  callback_number: string | null;
  hold_id: string | null;
  status: "running" | "done" | "cancelled";
  created_at: string;
}

export type CallState =
  | "queued" | "ringing" | "active" | "ended" | "no_answer" | "unreachable" | "failed" | "voicemail" | "cancelled";
export type CallPurpose = "resident" | "sentinel" | "canary" | "linked_contact" | "inbound" | "qrt_callback" | "test";
export type Transport = "browser" | "retell" | "sim";

/** The variables every agent sees, on both transports (PRD section 8). */
export interface CallVars {
  purpose: CallPurpose;
  zone_id: string;
  zone_name: string;
  zone_state: ZoneState | "";
  directive_text: string;
  move_text: string;
  evac_point: string;
  alert_text: string;
  stage: string; // "1" | "2" | "3" | "hold" | "canary" | ...
  language: string;
  lang_code: string;
  person_name: string;
  subject_name: string; // linked-contact calls: the person we are asking about
  callback_number: string;
  verification_phrase: string;
  memory_note: string;
  simulated: "true" | "false";
  mode: Mode;
  emergency_number: string; // what "hang up and call ... now" says in this jurisdiction (911, 119, 112...)
  collection_note: string; // collections line: what they hold and the grab list ("" for most households)
}

export interface Call {
  id: string;
  campaign_id: string | null;
  household_id: string | null;
  subject_household_id: string | null; // linked-contact calls: who we are asking about
  purpose: CallPurpose;
  called_party: "resident" | "linked_contact";
  attempt: number;
  state: CallState;
  transport: Transport;
  retell_call_id: string | null;
  outcome: "connected" | "no_answer" | "voicemail" | "failed" | null;
  messages: unknown[]; // Anthropic MessageParam[] on the browser transport
  transcript: string | null;
  summary: string | null;
  analysis: Record<string, unknown> | null;
  vars: CallVars;
  order_index: number; // edge-first rank within the campaign
  ring_index: number; // which ~200 m ring from the hazard edge
  edge_distance_m: number | null;
  hold_id: string | null;
  planned_at: string; // when it may ring (dispatch queue)
  started_at: string | null; // rang
  answered_at: string | null;
  ended_at: string | null;
  last_activity_at: string | null; // last turn on the browser transport (abandoned-call timeout)
  simulated: boolean;
  sim: SimPlan | null; // simulator script for synthetic people (and autopilot devices)
  created_at: string;
}

/** How the simulator will play a call: when it answers (null = never) and when it finishes. */
export interface SimPlan {
  profile: SimProfile;
  answer_at: string | null;
  done_at: string;
  applied: boolean;
}

export interface HouseholdStatus {
  campaign_id: string;
  household_id: string;
  status: Status;
  understood: boolean | null;
  destination: string | null;
  needs: Need[];
  needs_note: string | null;
  device_battery_hours: number | null;
  animals: string | null;
  people: number | null;
  refusal_reason: string | null;
  seats_for_neighbors: number | null;
  hazard_seen: boolean | null;
  hazard_type: string | null;
  hazard_direction: string | null;
  hazard_distance: string | null;
  distress: boolean;
  human_requested: boolean;
  human_reason: string | null;
  via: "resident" | "linked_contact";
  assigned_run: string | null;
  location_text: string | null;
  updated_at: string;
  simulated: boolean;
}

// ---------- Intent pipeline ----------

export type PrimaryIntent =
  | "needs_help_now" | "needs_help_leaving" | "leaving" | "staying" | "already_left"
  | "hazard_report" | "no_hazard_seen" | "info_request" | "wrong_number" | "not_in_zone"
  | "unclear" | "voicemail" | "silence";

export const PRIMARY_INTENTS: PrimaryIntent[] = [
  "needs_help_now", "needs_help_leaving", "leaving", "staying", "already_left",
  "hazard_report", "no_hazard_seen", "info_request", "wrong_number", "not_in_zone",
  "unclear", "voicemail", "silence",
];

export type IntentFlag =
  | "medical" | "mobility" | "oxygen" | "no_car" | "children" | "pets" | "language_mismatch" | "hostile" | "duplicate";

export interface Intent {
  id: string;
  call_id: string;
  household_id: string | null;
  primary_intent: PrimaryIntent;
  flags: IntentFlag[];
  needs: Need[];
  people: number | null;
  location_text: string | null;
  destination: string | null;
  can_leave: boolean | null;
  understood: boolean | null;
  language: string | null;
  confidence: number;
  summary: string | null;
  source: "in_call" | "post_call" | "retell" | "reconciled";
  review_needed: boolean;
  created_at: string;
}

// ---------- Help registry ----------

export type HelpStatus = "open" | "assigned" | "en_route" | "reached" | "closed" | "unreachable";
export type HelpSource = "stage1" | "stage2" | "stage3" | "inbound" | "rollcall" | "sentinel" | "manual" | "sim";
export type LocationSource = "gps_link" | "stated" | "enrolled" | "centroid";

export type HelpKind = "people" | "salvage";

export interface HelpRequest {
  id: string;
  household_id: string | null;
  phone: string | null; // QRT view only; never in feeds
  name: string | null;
  language: string | null;
  zone_id: string | null;
  priority: 1 | 2 | 3 | 4; // 1 life safety, 2 needs help leaving, 3 check later / unreached and vulnerable, 4 salvage (collections)
  /** "salvage" rows (collections line) never merge with or outrank a person's row; absent means "people". */
  kind?: HelpKind;
  needs: Need[];
  device_battery_hours: number | null;
  animals: string | null;
  people: number | null;
  reason: string | null; // short, enum-like: "medical_emergency", "wheelchair, no car", "unreached"
  status: HelpStatus;
  assigned_to: string | null;
  run_id: string | null;
  source: HelpSource;
  last_lat: number | null;
  last_lng: number | null;
  last_accuracy_m: number | null;
  last_source: LocationSource;
  last_stated_text: string | null;
  last_consent: boolean;
  last_observed_at: string;
  synthetic: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationFix {
  id: string;
  household_id: string | null;
  help_request_id: string | null;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  source: LocationSource;
  stated_text: string | null;
  consent: boolean;
  observed_at: string;
}

export interface PickupRun {
  id: string;
  label: string; // "Accessible van A"
  vehicle: "accessible_van" | "car";
  stops: string[]; // help_request ids in route order
  status: "planned" | "en_route" | "done";
  created_at: string;
}

// ---------- Hold, canary ----------

export type HoldDecision = "send" | "cancel" | "hand_off" | "timer" | "bypass";
export type SentinelAnswer = "yes" | "no" | "unsure" | "silent" | "pending";

export interface HoldTally {
  yes: number;
  no: number;
  unsure: number;
  silent: number;
  pending: number;
}

export interface HoldSentinel {
  household_id: string;
  call_id: string | null;
  position: "far" | "near" | "backup";
  answer: SentinelAnswer;
  what: string | null;
  direction: string | null;
  answered_at: string | null;
  independent: boolean; // enrolled sentinels are independent; recent callers are not
}

export interface Hold {
  id: string;
  zone_id: string;
  proposed_state: ZoneState;
  alert_text: string;
  directive_text: string | null;
  move_text: string | null;
  evac_point: string | null;
  polygon: GeoJSON.Polygon;
  polygon_label: string; // "Culver City and Palms" or "Countywide (wrong polygon)"
  population_est: number;
  area_sq_mi: number;
  started_at: string;
  deadline: string;
  extended_once: boolean;
  tally: HoldTally;
  sentinels: HoldSentinel[];
  read: "pending" | "confirmed" | "disputed" | "no_read" | "dark_zone";
  decision: HoldDecision | null;
  decided_by: string | null;
  reason: string | null;
  decided_at: string | null;
  sent_at: string | null;
  /** "handed_off" is legacy; a hand-off now keeps the hold open (it still sends at 0:00) and sets handed_off_*. */
  status: "open" | "sent" | "cancelled" | "handed_off";
  handed_off_by: string | null; // Hand to authority: who handed it, and when; the timer keeps running
  handed_off_at: string | null;
  opened_by: string;
  open_reason: string;
}

export interface Canary {
  id: string;
  hold_id: string;
  household_id: string;
  call_id: string | null;
  inside: boolean; // a canary is normally outside the polygon
  result: "yes" | "no" | "silent" | "pending";
  flag: "clear" | "transport_failure" | "unverified" | null;
  observed_at: string | null;
  created_at: string;
}

// ---------- Pattern watch ----------

export type ReportType = "smoke" | "fire" | "shaking" | "damage" | "injury" | "flood" | "power" | "other";

export interface Report {
  id: string;
  type: ReportType;
  lat: number;
  lng: number;
  zone_id: string | null;
  source: "call" | "seeded" | "inbound" | "sentinel";
  household_id: string | null;
  call_id: string | null;
  text: string | null;
  synthetic: boolean;
  created_at: string;
}

export interface Cluster {
  id: string;
  cell: string; // hex cell key, about 0.7 km^2
  zone_id: string | null;
  kind: "hazard" | "help" | "silence" | "volume";
  count: number;
  baseline: number;
  score: number;
  corroborated: boolean;
  sentinel_reads: number; // hoax mirror: reports high, reads zero
  status: "open" | "proposed" | "dismissed";
  center_lat: number;
  center_lng: number;
  member_ids: string[];
  first_at: string;
  last_at: string;
}

// ---------- Ledger, feed, twists ----------

export interface LedgerEntry {
  id: string;
  actor: string; // a human name, "agent", "system" or "timer"
  action: string; // "approve_zone", "send", "refused: asked for an ETA", ...
  allowed: boolean;
  kind: "decision" | "refusal" | "system" | "agent";
  target: string | null;
  reason: string | null;
  created_at: string;
}

export interface AlertItem {
  id: string;
  campaign_id: string | null;
  zone_id: string | null;
  kind:
    | "proposal" | "cluster" | "dark_zone" | "canary_result" | "hand_off" | "silence_cluster"
    | "needs_help" | "hold" | "send" | "info" | "transport";
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string | null;
  geo: unknown;
  created_at: string;
}

export interface TwistEntry {
  id: string;
  twist_no: number;
  title: string;
  twist_text: string | null;
  what_changed: string;
  why: string | null;
  proof: string | null;
  commits: string[];
  created_at: string;
}

export interface SimEvent {
  at: string; // when it fires
  kind: "answer" | "seed_report" | "silence" | "usgs_event";
  call_id?: string;
  payload?: Record<string, unknown>;
  done: boolean;
}

export interface SimRun {
  id: string;
  preset: SimPreset;
  active: boolean;
  started_at: string;
  plan: SimEvent[];
}

export type SimPreset = "normal" | "tower_down" | "fire_spreading" | "mass_no_answer" | "earthquake" | "hoax_flood" | "dark_zone";

/** Single-row settings and counters. */
export interface Meta {
  id: "meta";
  scenario: Scenario;
  mode: Mode;
  /** Jurisdiction profile code (lib/jurisdictions.ts): vocabulary, emergency number, units, datum. */
  jurisdiction: string;
  sim_preset: SimPreset;
  verification_phrase: string;
  callback_number: string;
  cost_minutes: number; // telephony minutes used (cost counter)
  cost_usd: number;
  usgs_event: { mag: number; place: string; lat: number; lng: number; at: string } | null;
  /** Rehearsal without volunteers: the simulator answers for the six device phones too. */
  autopilot_devices: boolean;
  /** Demo of the January 9 failure: the next hold composes a countywide polygon. */
  wrong_polygon: boolean;
  updated_at: string;
}
