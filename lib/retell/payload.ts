// Parsing and normalizing what Retell sends us. Pure (no server-only), so it can be unit tested.
//   Call webhook:      {event: "call_started" | "call_ended" | "call_analyzed" | ..., call: Call}
//   Custom function:   {name, call: Call, args}   (or args at the root when "payload: args only" is on)
//   Inbound webhook:   {event: "call_inbound", event_timestamp, call_inbound: {call_id, agent_id, from_number, to_number, ...}}
import { TOOL_DEFS, TOOL_NAMES, type ToolName } from "../agent/tools";

/** The parts of Retell's call object we use (see /v2/get-call). */
export interface RetellCall {
  call_id: string;
  call_type?: string; // "phone_call" | "web_call"
  agent_id?: string;
  call_status?: string; // registered | not_connected | ongoing | ended | error
  direction?: "inbound" | "outbound";
  from_number?: string;
  to_number?: string;
  metadata?: Record<string, unknown>;
  retell_llm_dynamic_variables?: Record<string, string>;
  start_timestamp?: number;
  end_timestamp?: number;
  duration_ms?: number;
  disconnection_reason?: string;
  transcript?: string;
  call_analysis?: Record<string, unknown>;
}

export interface RetellWebhookEvent {
  event: string;
  call: RetellCall;
}

export interface RetellFunctionCall {
  name: string | null;
  call: RetellCall | null;
  args: Record<string, unknown>;
}

export interface RetellInbound {
  event: string;
  call_inbound: {
    call_id: string | null;
    agent_id: string | null;
    from_number: string | null;
    to_number: string | null;
  } | null;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

export function parseJsonObject(raw: string): Obj | null {
  try {
    const v: unknown = JSON.parse(raw);
    return isObj(v) ? v : null;
  } catch {
    return null;
  }
}

function asCall(v: unknown): RetellCall | null {
  if (!isObj(v) || !str(v.call_id)) return null;
  return v as unknown as RetellCall;
}

export function parseWebhookEvent(raw: string): RetellWebhookEvent | { error: string } {
  const body = parseJsonObject(raw);
  if (!body) return { error: "Body must be a JSON object" };
  const event = str(body.event);
  if (!event) return { error: "Missing event" };
  const call = asCall(body.call);
  if (!call) return { error: "Missing call.call_id" };
  return { event, call };
}

export function parseFunctionCall(raw: string): RetellFunctionCall | { error: string } {
  const body = parseJsonObject(raw);
  if (!body) return { error: "Body must be a JSON object" };
  // Default spec: {name, call, args}. With "payload: args only" the body is the args themselves.
  if ("args" in body || "call" in body) {
    const args = body.args === undefined ? {} : body.args;
    if (!isObj(args)) return { error: "args must be a JSON object" };
    return { name: str(body.name), call: asCall(body.call), args };
  }
  return { name: null, call: null, args: body };
}

export function parseInbound(raw: string): RetellInbound | { error: string } {
  const body = parseJsonObject(raw);
  if (!body) return { error: "Body must be a JSON object" };
  const event = str(body.event) ?? "call_inbound";
  const ci = isObj(body.call_inbound) ? body.call_inbound : null;
  return {
    event,
    call_inbound: ci
      ? { call_id: str(ci.call_id), agent_id: str(ci.agent_id), from_number: str(ci.from_number), to_number: str(ci.to_number) }
      : null,
  };
}

/** Our call id, as sent in metadata.call_id when the call was created (outbound) or answered (inbound). */
export function ourCallId(call: RetellCall | null | undefined): string | null {
  return call && isObj(call.metadata) ? str(call.metadata.call_id) : null;
}

export function callDurationMs(call: RetellCall): number | null {
  if (typeof call.duration_ms === "number") return call.duration_ms;
  if (typeof call.start_timestamp === "number" && typeof call.end_timestamp === "number") {
    return Math.max(0, call.end_timestamp - call.start_timestamp);
  }
  return null;
}

export function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as string[]).includes(name);
}

/**
 * Make Retell's arguments look like the Claude transport's. Retell's schema (retellParameters) makes
 * nullable fields optional, while the shared executor validates the strict Claude form, where every
 * field is present and "not said" is null. So: missing nullable fields become null, a missing array
 * becomes [], and keys outside the tool's schema are dropped (and reported).
 */
export function normalizeToolArgs(name: ToolName, args: Record<string, unknown>): { args: Record<string, unknown>; dropped: string[] } {
  const def = TOOL_DEFS.find((t) => t.name === name);
  if (!def) return { args, dropped: [] };
  const props = def.input_schema.properties;
  const out: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(props)) {
    const v = args[key];
    if (v === undefined) out[key] = schema.type === "array" ? [] : null;
    else out[key] = v;
  }
  const dropped = Object.keys(args).filter((k) => !(k in props));
  return { args: out, dropped };
}
