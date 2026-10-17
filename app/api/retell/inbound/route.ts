import { retellDynamicVariables } from "@/lib/agent/prompt";
import { startInboundCall } from "@/lib/engine/calls";
import { json } from "@/lib/http";
import { retellAgentFor } from "@/lib/retell/client";
import { readVerifiedRetellBody } from "@/lib/retell/guard";
import { parseInbound } from "@/lib/retell/payload";

// POST /api/retell/inbound — Retell's inbound-call webhook, set per phone number (inbound_webhook_url,
// see scripts/retell-setup.ts). The call rings while we answer (10 s timeout, 3 attempts in all), so
// this must be fast. We register the call with the engine and return
//   {call_inbound: {dynamic_variables, metadata: {call_id}, override_agent_id?}}
// so the agent gets the caller's variables and every later webhook and tool call maps back to our call.

interface InboundResponse {
  call_inbound: {
    dynamic_variables: Record<string, string>;
    metadata: Record<string, string>;
    override_agent_id?: string;
  };
}

// Retries carry the same call_inbound.call_id: answer them with the same call instead of a new one.
const g = globalThis as unknown as { __secondKeyInbound?: Map<string, { at: number; body: Promise<InboundResponse> }> };
const inflight = (g.__secondKeyInbound ??= new Map<string, { at: number; body: Promise<InboundResponse> }>());
const TTL_MS = 10 * 60 * 1000;

async function register(retellCallId: string | null, fromNumber: string | null, boundAgentId: string | null): Promise<InboundResponse> {
  const { call_id, vars } = await startInboundCall({ from_number: fromNumber, transport: "retell", retell_call_id: retellCallId });
  const body: InboundResponse = {
    call_inbound: {
      dynamic_variables: retellDynamicVariables(vars),
      metadata: { call_id, lang_code: vars.lang_code, transport: "retell" },
    },
  };
  // A caller we know (enrolled number) gets the agent for their language; otherwise the number's own agent.
  const agent = retellAgentFor(vars.lang_code);
  if (agent && (!agent.fallback || !boundAgentId)) body.call_inbound.override_agent_id = agent.agent_id;
  return body;
}

export async function POST(req: Request) {
  const checked = await readVerifiedRetellBody(req);
  if ("response" in checked) return checked.response;

  const parsed = parseInbound(checked.raw);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  if (parsed.event !== "call_inbound" || !parsed.call_inbound) {
    // Inbound SMS (chat_inbound) is not part of this build: let Retell's defaults apply.
    return json({});
  }
  const { call_id: retellCallId, from_number, agent_id } = parsed.call_inbound;

  const now = Date.now();
  for (const [k, v] of inflight) if (now - v.at > TTL_MS) inflight.delete(k);
  let entry = retellCallId ? inflight.get(retellCallId) : undefined;
  if (!entry) {
    entry = { at: now, body: register(retellCallId, from_number, agent_id) };
    if (retellCallId) inflight.set(retellCallId, entry);
  }

  try {
    return json(await entry.body);
  } catch (e) {
    if (retellCallId) inflight.delete(retellCallId);
    console.error(`[retell inbound] could not start the inbound call from ${from_number ?? "unknown"}`, e);
    // Non-2xx: Retell retries, then falls back to the number's inbound agent with default variables.
    return json({ error: "could not start the inbound call" }, 500);
  }
}
