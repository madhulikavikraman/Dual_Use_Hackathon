import "server-only";
import { serverEnv } from "@/lib/env";
import { json } from "@/lib/http";
import { callIdForRetell } from "@/lib/engine/retellEvents";
import { startInboundCall } from "@/lib/engine/calls";
import { authorizeRetellRequest, RETELL_SIGNATURE_HEADER } from "./verify";
import { ourCallId, type RetellCall } from "./payload";

// Shared plumbing for the Retell route handlers: signature check on the raw body, and mapping a
// Retell call to our call id.

function retellApiKey(): string | undefined {
  try {
    return serverEnv().RETELL_API_KEY;
  } catch {
    return process.env.RETELL_API_KEY?.trim() || undefined;
  }
}

let warnedSkip = false;

/** Read the raw body and authorize it. Returns the raw body, or the error Response to send. */
export async function readVerifiedRetellBody(req: Request): Promise<{ raw: string; verified: boolean } | { response: Response }> {
  const raw = await req.text();
  const auth = authorizeRetellRequest(raw, req.headers.get(RETELL_SIGNATURE_HEADER), {
    apiKey: retellApiKey(),
    skipVerify: process.env.RETELL_SKIP_VERIFY === "1",
    nodeEnv: process.env.NODE_ENV,
  });
  if (!auth.ok) {
    if (auth.status === 401) console.warn(`[retell] rejected ${new URL(req.url).pathname}: ${auth.error}`);
    return { response: json({ error: auth.error }, auth.status) };
  }
  if (!auth.verified && !warnedSkip) {
    warnedSkip = true;
    console.warn("[retell] RETELL_SKIP_VERIFY=1 in development: accepting unsigned Retell requests");
  }
  return { raw, verified: auth.verified };
}

// One in-flight lookup per Retell call, so parallel tool calls on an unknown inbound call create one row.
const g = globalThis as unknown as { __secondKeyRetellCalls?: Map<string, Promise<string | null>> };
const resolving = (g.__secondKeyRetellCalls ??= new Map<string, Promise<string | null>>());

/**
 * Our call id for a Retell call: metadata.call_id, else the engine's lookup by Retell call id. With
 * `createInbound`, an inbound call we have never seen (the inbound webhook was not configured or
 * failed) is registered through startInboundCall so its tools still write rows.
 */
export async function resolveCallId(call: RetellCall | null, opts: { createInbound?: boolean } = {}): Promise<string | null> {
  const fromMeta = ourCallId(call);
  if (fromMeta || !call?.call_id) return fromMeta;
  const retellId = call.call_id;
  const pending = resolving.get(retellId);
  if (pending) return pending;
  const p = (async () => {
    const known = await callIdForRetell(retellId).catch((e) => {
      console.error("[retell] callIdForRetell failed", e);
      return null;
    });
    if (known || !opts.createInbound || call.direction !== "inbound") return known;
    const started = await startInboundCall({
      from_number: call.from_number ?? null,
      transport: "retell",
      retell_call_id: retellId,
    });
    console.warn(`[retell] inbound call ${retellId} had no metadata.call_id; registered as ${started.call_id}`);
    return started.call_id;
  })();
  resolving.set(retellId, p);
  try {
    const id = await p;
    if (!id) resolving.delete(retellId); // allow a later retry
    else setTimeout(() => resolving.delete(retellId), 30 * 60 * 1000).unref?.();
    return id;
  } catch (e) {
    resolving.delete(retellId);
    throw e;
  }
}

/** Plain-text response (custom-function results are handed to the LLM as a string). */
export function textResponse(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers } });
}
