// Minimal Retell REST helper (https://api.retellai.com, "Authorization: Bearer <RETELL_API_KEY>").
// Pure module: the API key is passed in, so both the server (lib/retell/client.ts) and
// scripts/retell-setup.ts use it. Retell errors come back as {status: "error", message}.

export const RETELL_API_BASE = "https://api.retellai.com";

export class RetellApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly detail: unknown = null,
  ) {
    super(message);
    this.name = "RetellApiError";
  }
}

const HINTS: Record<number, string> = {
  400: "bad request, check the payload against the API reference",
  401: "RETELL_API_KEY is missing or invalid",
  402: "no credits or payment method on the Retell account",
  404: "not found",
  422: "Retell cannot find that agent, LLM or phone number under this API key",
  429: "rate limited, retry in a few seconds",
};

export type RetellMethod = "GET" | "POST" | "PATCH" | "DELETE";

export async function retellRequest<T>(
  apiKey: string,
  method: RetellMethod,
  path: string,
  body?: unknown,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  if (!apiKey) throw new RetellApiError("Retell not configured: RETELL_API_KEY is not set", null);
  let res: Response;
  try {
    res = await fetch(`${RETELL_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
      cache: "no-store",
    });
  } catch (e) {
    const why = e instanceof Error ? (e.name === "TimeoutError" ? "timed out" : e.message) : String(e);
    throw new RetellApiError(`Retell ${method} ${path}: network error (${why})`, null);
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : text.slice(0, 300) || res.statusText;
    const hint = HINTS[res.status] ? `, ${HINTS[res.status]}` : "";
    throw new RetellApiError(`Retell ${method} ${path} failed (${res.status}${hint}): ${msg}`, res.status, data);
  }
  return data as T;
}

/** Normalize a phone number to E.164. US 10- and 11-digit forms are accepted; anything else needs a "+". */
export function toE164(input: string): string | null {
  const raw = input.trim();
  const digits = raw.replace(/[^\d]/g, "");
  if (raw.startsWith("+")) return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
