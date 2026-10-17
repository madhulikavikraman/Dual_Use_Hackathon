import "server-only";
import type { z } from "zod";

/** JSON response helpers for route handlers. */
export const json = (data: unknown, status = 200, headers?: Record<string, string>) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const bad = (message: string) => new HttpError(400, message);
export const notFound = (what: string) => new HttpError(404, `${what} not found`);
export const conflict = (message: string) => new HttpError(409, message);

/** Parse and validate a JSON body with a zod schema; throws HttpError(400) on failure. */
export async function body<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw bad("Body must be JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw bad(parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  }
  return parsed.data;
}

/** Wrap a handler: HttpErrors become JSON errors with their status; anything else is a 500. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("[api]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

/** CORS headers for public feeds read by ArcGIS Online. */
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};
