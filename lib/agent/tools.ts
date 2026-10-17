// The agent's tool allowlist (PRD section 9). Seven tools, the same on both transports: Claude uses them
// on the browser phone; Retell exposes them as custom functions on the phone network. The allowlist IS
// the interface: there is no tool to change a zone, send an alert, or extend a hold.
import type { CallPurpose } from "@/lib/types";

export type ToolName =
  | "record_status" | "report_hazard" | "request_human" | "end_call" | "lookup_zone" | "read_observation" | "received_alert";

export const TOOL_NAMES: ToolName[] = [
  "record_status", "report_hazard", "request_human", "end_call", "lookup_zone", "read_observation", "received_alert",
];

type Schema = Record<string, unknown>;
const str = (description: string): Schema => ({ type: ["string", "null"], description });
const bool = (description: string): Schema => ({ type: ["boolean", "null"], description });
const int = (description: string): Schema => ({ type: ["integer", "null"], description });
const num = (description: string): Schema => ({ type: ["number", "null"], description });

const NEED_ENUM = [
  "wheelchair", "walker", "no_car", "oxygen", "powered_medical_device", "dialysis",
  "bedbound", "children_alone", "hearing", "vision", "cognitive", "other",
];

export interface ToolDef {
  name: ToolName;
  description: string;
  input_schema: { type: "object"; properties: Record<string, Schema>; required: string[]; additionalProperties: false };
}

function def(name: ToolName, description: string, properties: Record<string, Schema>): ToolDef {
  return { name, description, input_schema: { type: "object", properties, required: Object.keys(properties), additionalProperties: false } };
}

export const TOOL_DEFS: ToolDef[] = [
  def(
    "record_status",
    "Record what the person told you, after you have confirmed it back to them. Call once per person, and again only if an answer changes. Use null for anything not asked or not answered.",
    {
      status: {
        type: "string",
        enum: ["leaving", "staying", "already_left", "needs_help_leaving", "needs_help_now", "unclear", "wrong_number", "not_in_zone"],
        description: "needs_help_now = life safety (medical, trapped, fire at the house). needs_help_leaving = can leave only with help (wheelchair, oxygen, no car, children alone, pets).",
      },
      understood: bool("Teach-back passed: the person repeated where they will go and by when (or the instruction) correctly."),
      destination: str("Where they will go, as they said it (e.g. 'Westchester Recreation Center')."),
      people: int("People at the address including the speaker."),
      needs: { type: "array", items: { type: "string", enum: NEED_ENUM }, description: "Access and functional needs mentioned. Empty array if none." },
      device_battery_hours: num("Hours of battery left on a powered medical device, if mentioned."),
      animals: str("Pets or animals mentioned, short (e.g. 'small dog')."),
      location_text: str("Where the person is right now, in their words (address, intersection, landmark)."),
      location_consent: bool("The person agreed their location may be shared with the response team."),
      can_leave: bool("Whether they can leave on their own."),
      refusal_reason: str("If staying, the reason they gave, short."),
      memory_note: str("One short fact worth remembering for the next call (e.g. 'oxygen concentrator is charged'). No diagnoses."),
    },
  ),
  def(
    "report_hazard",
    "Record what a resident sees, only if they are safe or already leaving. Never ask anyone to go and look.",
    {
      seen: { type: "boolean", description: "They see a hazard." },
      type: { type: "string", enum: ["smoke", "fire", "shaking", "damage", "injury", "flood", "power", "other"], description: "What they see." },
      direction: str("Direction from them, e.g. 'west'."),
      distance: str("Rough distance, e.g. 'two blocks'."),
      location_text: str("Where they are, if different from their address."),
    },
  ),
  def(
    "request_human",
    "Hand the person to a human. Use for a medical emergency (after telling them to hang up and call the emergency number), for anything you cannot answer from the approved text, and whenever the person is confused, distressed, refuses, or doubts the call. Also use it when the person asks for something you are not allowed to give (an ETA, whether it is safe to stay, where another person is): describe the request in note. Someone who needs help to leave is recorded with record_status, not here. Collections line only: reason salvage logs a request for help moving the items on their grab list; it always ranks below every person.",
    {
      reason: {
        type: "string",
        enum: ["medical_emergency", "cannot_answer", "confusion", "distress", "refusal", "doubts_call", "asked_unapproved", "salvage"],
        description: "Why a person is needed.",
      },
      urgency: { type: "string", enum: ["now", "soon", "later"], description: "now = life safety." },
      note: str("Short: what they asked or need, e.g. 'asked for an ETA', 'asked if it is safe to stay'."),
    },
  ),
  def("end_call", "End the call after saying goodbye.", {
    outcome: { type: "string", enum: ["completed", "wrong_person", "voicemail", "caller_hung_up", "no_response"], description: "How the call ended." },
  }),
  def(
    "lookup_zone",
    "When the person says they are somewhere other than their enrolled address, look up the zone for that place. Returns the zone and the directive a human approved for it, which you then read verbatim. If no zone is found, you have no instruction for them.",
    { location_text: { type: "string", description: "The place in their words: address, intersection or landmark." } },
  ),
  def(
    "read_observation",
    "Sentinel calls only: record whether what the person sees matches the alert you read.",
    {
      sees: { type: "string", enum: ["yes", "no", "unsure"], description: "Does the alert match what they see?" },
      what: str("What they see, short (e.g. 'smoke to the west')."),
      direction: str("Direction, if given."),
    },
  ),
  def("received_alert", "Canary and test calls only: did they receive the alert (canary) or can they hear this call (test)?", {
    received: { type: "string", enum: ["yes", "no"], description: "Their answer." },
  }),
];

/** Which tools each kind of call may use. */
export function toolsForPurpose(p: CallPurpose): ToolName[] {
  switch (p) {
    case "resident":
      return ["record_status", "report_hazard", "request_human", "lookup_zone", "end_call"];
    case "inbound":
      return ["lookup_zone", "record_status", "report_hazard", "request_human", "end_call"];
    case "linked_contact":
    case "qrt_callback":
      return ["record_status", "request_human", "end_call"];
    case "sentinel":
      return ["read_observation", "request_human", "end_call"];
    case "canary":
    case "test":
      return ["received_alert", "request_human", "end_call"];
  }
}

export function toolDefsFor(p: CallPurpose): ToolDef[] {
  const allowed = new Set(toolsForPurpose(p));
  return TOOL_DEFS.filter((t) => allowed.has(t.name));
}

/**
 * Retell custom-function form of a tool: nullable fields become optional (Retell's LLM does not need the
 * strict-mode null pattern). Required = the non-nullable fields.
 */
export function retellParameters(t: ToolDef): Schema {
  const properties: Record<string, Schema> = {};
  const required: string[] = [];
  for (const [k, v] of Object.entries(t.input_schema.properties)) {
    const type = v.type;
    if (Array.isArray(type)) {
      properties[k] = { ...v, type: type.find((x) => x !== "null") };
    } else {
      properties[k] = v;
      required.push(k);
    }
  }
  return { type: "object", properties, required };
}
