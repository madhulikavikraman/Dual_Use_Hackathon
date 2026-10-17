// Retell request signatures: call webhooks, custom-function calls and the inbound-call webhook all carry
// the same header. Scheme (docs.retellai.com/features/secure-webhook, identical to retell-sdk 6.2.7
// lib/webhook_auth.js):
//   X-Retell-Signature: v=<unix ms>,d=<hex HMAC-SHA256(rawBody + v, RETELL_API_KEY)>
//   reject when |now - v| > 5 minutes; always verify the RAW body string, never re-serialized JSON.
// Pure module (no "server-only", no env reads) so scripts and unit tests can import it.
import { createHmac, timingSafeEqual } from "node:crypto";

export const RETELL_SIGNATURE_HEADER = "x-retell-signature";
export const RETELL_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

const SIGNATURE = /^v=(\d+),d=([0-9a-f]{64})$/i;

function hmacHex(apiKey: string, message: string): string {
  return createHmac("sha256", apiKey).update(message, "utf8").digest("hex");
}

/** Produce a header value the way Retell does (for tests and local tooling). */
export function signRetellBody(rawBody: string, apiKey: string, timestampMs: number = Date.now()): string {
  const ts = Math.trunc(timestampMs);
  return `v=${ts},d=${hmacHex(apiKey, rawBody + ts)}`;
}

/** True when `signature` is a fresh, valid Retell signature of `rawBody` under `apiKey`. */
export function verifyRetellSignature(
  rawBody: string,
  apiKey: string,
  signature: string | null | undefined,
  opts: { now?: number; maxAgeMs?: number } = {},
): boolean {
  if (!apiKey || typeof signature !== "string") return false;
  const m = SIGNATURE.exec(signature.trim());
  if (!m) return false;
  const ts = Number(m[1]);
  if (!Number.isSafeInteger(ts)) return false;
  const now = opts.now ?? Date.now();
  const maxAge = opts.maxAgeMs ?? RETELL_SIGNATURE_MAX_AGE_MS;
  if (!Number.isFinite(now) || Math.abs(now - ts) > maxAge) return false;
  const expected = Buffer.from(hmacHex(apiKey, rawBody + ts), "hex");
  const given = Buffer.from(m[2], "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export interface RetellAuthConfig {
  /** RETELL_API_KEY (the key with the webhook badge in the Retell dashboard). */
  apiKey: string | undefined;
  /** RETELL_SKIP_VERIFY === "1". Honored only when nodeEnv is "development". */
  skipVerify: boolean;
  nodeEnv: string | undefined;
  now?: number;
}

export type RetellAuthResult =
  | { ok: true; verified: boolean } // verified=false: skipped (local development only)
  | { ok: false; status: 401 | 503; error: string };

/**
 * The decision every Retell route makes before touching the body:
 * - RETELL_SKIP_VERIFY=1 with NODE_ENV=development: accept unsigned requests (crafted local tests).
 * - no RETELL_API_KEY: 503 "Retell not configured".
 * - missing or wrong signature: 401.
 */
export function authorizeRetellRequest(rawBody: string, signature: string | null | undefined, cfg: RetellAuthConfig): RetellAuthResult {
  if (cfg.skipVerify && cfg.nodeEnv === "development") return { ok: true, verified: false };
  if (!cfg.apiKey) return { ok: false, status: 503, error: "Retell not configured" };
  if (!signature) return { ok: false, status: 401, error: "Missing X-Retell-Signature header" };
  if (!verifyRetellSignature(rawBody, cfg.apiKey, signature, { now: cfg.now })) {
    return { ok: false, status: 401, error: "Invalid Retell signature" };
  }
  return { ok: true, verified: true };
}
