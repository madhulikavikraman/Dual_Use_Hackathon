// Display labels and colors for the board. Zone colors and the civilian vocabulary come from
// lib/directives (PRD 6.1); everything here is presentation only.
import type { HouseholdView } from "@/lib/contracts";
import { HEAT_STATE_LABEL, HEAT_STATE_SHORT, STATE_LABEL, STATE_SHORT } from "@/lib/directives";
import type {
  AlertItem,
  Campaign,
  CallPurpose,
  Canary,
  HelpSource,
  HelpStatus,
  Hold,
  HoldDecision,
  HoldSentinel,
  LocationSource,
  Mode,
  Need,
  ProposalModel,
  Scenario,
  SentinelAnswer,
  Status,
  Transport,
  ZoneState,
} from "@/lib/types";

export type Tone = "neutral" | "info" | "good" | "warn" | "bad";

// ---------- Scenario and mode ----------

export const SCENARIO_OPTIONS: { id: Scenario; label: string }[] = [
  { id: "westside", label: "Westside Fire (LA)" },
  { id: "heat", label: "Heat wave: senior check-ins" },
  { id: "altadena", label: "West Altadena (Eaton fire framing)" },
  { id: "norte", label: "Norte Fire, San Clemente (live)" },
  { id: "chongqing", label: "Chongqing, China (Twist 2)" },
];

export const scenarioLabel = (s: Scenario) => SCENARIO_OPTIONS.find((o) => o.id === s)?.label ?? s;

export const MODE_LABEL: Record<Mode, string> = {
  civilian: "City mode",
  heat: "Heat · wellness check-ins",
  base: "Installation command post (base mode)",
};

/** Base mode speaks personnel accountability (ADPAAS / NFAAS / AFPAAS): accounted and unaccounted. */
export const WORDING: Record<Mode, { registry: string; reached: string; needsHelp: string }> = {
  civilian: { registry: "Help registry", reached: "Reached", needsHelp: "Needs help · open" },
  heat: { registry: "Help registry", reached: "Reached", needsHelp: "Needs help · open" },
  base: { registry: "Accountability", reached: "Accounted", needsHelp: "Needs assistance" },
};

// ---------- Zone states in the scenario's vocabulary (PRD 16) ----------

const AVOID_LABEL: Record<ZoneState, string> = {
  monitor: "Monitor",
  watch: "Watch",
  warning: "Near-Crisis · Avoid the area",
  order: "Crisis · Leave the area",
  shelter_in_place: "Shelter in Place",
  lifted: "All clear",
};
const BASE_LABEL: Record<ZoneState, string> = { ...AVOID_LABEL, order: "Crisis · Evacuate", shelter_in_place: "Lockdown" };
const AVOID_SHORT: Record<ZoneState, string> = { ...STATE_SHORT, warning: "Avoid", order: "Leave", lifted: "All clear" };
const BASE_SHORT: Record<ZoneState, string> = { ...AVOID_SHORT, order: "Evacuate", shelter_in_place: "Lockdown" };

export const stateLabel = (s: ZoneState, mode: Mode) =>
  mode === "heat" ? HEAT_STATE_LABEL[s] : mode === "base" ? BASE_LABEL[s] : STATE_LABEL[s];

export const stateShort = (s: ZoneState, mode: Mode) =>
  mode === "heat" ? HEAT_STATE_SHORT[s] : mode === "base" ? BASE_SHORT[s] : STATE_SHORT[s];

/** Text that reads well on the zone's state color. */
export const STATE_TEXT: Record<ZoneState, string> = {
  monitor: "#111827",
  watch: "#111827",
  warning: "#111827",
  order: "#ffffff",
  shelter_in_place: "#ffffff",
  lifted: "#ffffff",
};

export const MODEL_LABEL: Record<ProposalModel, string> = {
  fire_envelope: "Fire envelope (toy model)",
  call_pattern: "Call pattern",
  nws: "NWS alert polygon",
  heat_threshold: "Heat thresholds (demo setting)",
};

export function campaignLabel(c: Pick<Campaign, "kind" | "wave">): string {
  switch (c.kind) {
    case "warning":
      return c.wave === 2 ? "Stage 2 · Check" : "Stage 1 · Warning";
    case "order":
      return "Stage 3 · Order relay";
    case "rollcall":
      return "Roll call";
    case "test":
      return "Monthly test call";
    case "checkin":
      return "Check-in";
    case "shelter":
      return "Shelter in place calls";
    case "all_clear":
      return "Lifted calls";
    case "hold":
      return "Hold · sentinels";
    case "canary":
      return "Canary";
    case "qrt_callback":
      return "QRT call-back";
    case "inbound":
      return "Inbound line";
  }
}

// ---------- Households (map pins) ----------

const STATUS_LABEL: Record<Status, string> = {
  pending: "Not called yet",
  queued: "Queued",
  ringing: "Ringing",
  on_call: "On a call",
  safe: "Safe (own word)",
  leaving: "Leaving",
  needs_help: "Needs help",
  wont_leave: "Won't leave",
  unclear: "Unclear",
  wrong_number: "Wrong number",
  no_answer: "No answer",
  unreachable: "Unreachable",
};

export const STATUS_COLOR: Record<Status, string> = {
  pending: "#9ca3af",
  queued: "#93c5fd",
  ringing: "#2563eb",
  on_call: "#1d4ed8",
  safe: "#16a34a",
  leaving: "#f59e0b",
  needs_help: "#dc2626",
  wont_leave: "#9333ea",
  unclear: "#6b7280",
  wrong_number: "#6b7280",
  no_answer: "#6b7280",
  unreachable: "#1f2937",
};

const BASE_STATUS: Partial<Record<Status, string>> = {
  pending: "Unaccounted · not called",
  safe: "Accounted",
  leaving: "Accounted · leaving",
  unclear: "Unaccounted · unclear",
  wrong_number: "Unaccounted · wrong number",
  no_answer: "Unaccounted · no answer",
  unreachable: "Unaccounted · unreachable",
};

/** Heat check-in line: the same stored statuses, in the heat line's words. */
const HEAT_STATUS: Partial<Record<Status, string>> = {
  safe: "Home and cool (own word)",
  leaving: "Going to a cooling center",
  wont_leave: "Staying home",
  needs_help: "Needs help (ride or unwell)",
};

export const statusLabel = (s: Status, mode: Mode) =>
  (mode === "base" ? BASE_STATUS[s] : mode === "heat" ? HEAT_STATUS[s] : undefined) ?? STATUS_LABEL[s];

/** Drawn as hollow rings: nobody gave a usable answer. */
export const HOLLOW_STATUS: Status[] = ["unclear", "no_answer", "wrong_number"];
/** Drawn with a pulse: ringing now. Queued pins are pale blue, so the sweep reads ring by ring. */
export const PULSE_STATUS: Status[] = ["ringing"];

/** The pin's status: a live call wins over the last recorded answer. */
export function displayStatus(h: Pick<HouseholdView, "status" | "call_state">): Status {
  if (h.call_state === "ringing") return "ringing";
  if (h.call_state === "active") return "on_call";
  if (h.call_state === "queued") return "queued";
  return h.status;
}

export const NEED_LABEL: Record<Need, string> = {
  wheelchair: "wheelchair",
  walker: "walker",
  no_car: "no car",
  oxygen: "oxygen",
  powered_medical_device: "powered medical device",
  dialysis: "dialysis",
  bedbound: "bedbound",
  children_alone: "children alone",
  hearing: "deaf / hard of hearing",
  vision: "blind / low vision",
  cognitive: "cognitive",
  other: "other",
};

// ---------- Help registry ----------

export const PRIORITY_COLOR: Record<1 | 2 | 3 | 4, string> = { 1: "#dc2626", 2: "#ea580c", 3: "#eab308", 4: "#8b5cf6" };
export const PRIORITY_LABEL: Record<1 | 2 | 3 | 4, string> = { 1: "Life safety", 2: "Needs help leaving", 3: "Check later", 4: "Salvage (collections, after every person)" };

export const HELP_STATUS_LABEL: Record<HelpStatus, string> = {
  open: "Open",
  assigned: "Assigned",
  en_route: "En route",
  reached: "Reached",
  closed: "Closed",
  unreachable: "Unreachable",
};

export const HELP_STATUS_TONE: Record<HelpStatus, Tone> = {
  open: "bad",
  assigned: "warn",
  en_route: "info",
  reached: "good",
  closed: "neutral",
  unreachable: "neutral",
};

export const LOCATION_SOURCE_LABEL: Record<LocationSource, string> = {
  gps_link: "GPS link",
  stated: "stated",
  enrolled: "enrolled address",
  centroid: "zone centre, low precision",
};

export const HELP_SOURCE_LABEL: Record<HelpSource, string> = {
  stage1: "Stage 1",
  stage2: "Stage 2",
  stage3: "Stage 3",
  inbound: "Inbound",
  rollcall: "Roll call",
  sentinel: "Sentinel",
  manual: "Manual",
  sim: "Simulator",
};

// ---------- Calls ----------

export const PURPOSE_LABEL: Record<CallPurpose, string> = {
  resident: "Resident",
  sentinel: "Sentinel",
  canary: "Canary",
  linked_contact: "Linked contact",
  inbound: "Inbound",
  qrt_callback: "QRT call-back",
  test: "Test call",
};

export const TRANSPORT_LABEL: Record<Transport, string> = { retell: "Phone · Retell", browser: "Browser phone", sim: "Simulator" };

// ---------- Hold and canary ----------

export const ANSWER_LABEL: Record<SentinelAnswer, string> = {
  yes: "Yes, matches",
  no: "No, nothing here",
  unsure: "Not sure",
  silent: "Silent · abstains",
  pending: "Ringing",
};

export const ANSWER_COLOR: Record<SentinelAnswer, string> = {
  yes: "#16a34a",
  no: "#ea580c",
  unsure: "#ca8a04",
  silent: "#6b7280",
  pending: "#2563eb",
};

export const POSITION_LABEL: Record<HoldSentinel["position"], string> = { far: "far edge", near: "near edge", backup: "backup" };

export const READ_INFO: Record<Hold["read"], { label: string; detail: string; tone: Tone }> = {
  pending: { label: "Waiting for reads", detail: "Quorum is two answers. Silence is an abstention, never a No.", tone: "info" },
  confirmed: { label: "Confirmed at the edge", detail: "Two or more edge reads match the alert.", tone: "good" },
  disputed: { label: "Disputed", detail: "Edge reads disagree with the alert. Check the polygon before sending.", tone: "warn" },
  no_read: { label: "No read", detail: "Fewer than two answers. The alert still sends on time.", tone: "warn" },
  dark_zone: { label: "Dark zone", detail: "Every sentinel is silent: probably the network. Hand to the duty officer.", tone: "warn" },
};

export const HOLD_OUTCOME: Record<HoldDecision, string> = {
  send: "Sent (simulated)",
  timer: "Sent on timer, no decision (simulated)",
  bypass: "Sent, hold bypassed by IC order (simulated)",
  cancel: "Cancelled, nothing sent",
  hand_off: "Handed to the authority",
};

export const CANARY_RESULT_LABEL: Record<Canary["result"], string> = {
  yes: "Received the alert",
  no: "Did not receive it",
  silent: "Silent",
  pending: "Ringing",
};

export const CANARY_FLAG: Record<NonNullable<Canary["flag"]>, { label: string; detail: string; tone: Tone }> = {
  clear: { label: "Canary clear", detail: "Delivery matches the polygon.", tone: "good" },
  transport_failure: {
    label: "Transport failure",
    detail: "Delivery does not match the polygon. Flagged to the authority, not a stop.",
    tone: "bad",
  },
  unverified: { label: "Delivery unverified", detail: "The canaries were silent. Flagged to the authority, not a stop.", tone: "warn" },
};

// ---------- Feed ----------

export const FEED_KIND_LABEL: Record<AlertItem["kind"], string> = {
  proposal: "Proposal",
  cluster: "Cluster",
  silence_cluster: "Silence cluster",
  dark_zone: "Dark zone",
  canary_result: "Canary",
  hand_off: "Hand-off",
  needs_help: "Needs help",
  hold: "Hold",
  send: "Send · simulated",
  transport: "Transport",
  info: "Info",
};

export const SEVERITY_TONE: Record<AlertItem["severity"], Tone> = { info: "neutral", warn: "warn", critical: "bad" };
