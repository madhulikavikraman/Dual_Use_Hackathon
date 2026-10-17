// Fetch helpers for the live-location link, the helper link and the desk's live registry. Client-safe.
import type {
  DispatchSummary,
  HelperUpdateBody,
  HelperView,
  LiveRegistry,
  LocateBody,
  LocateResult,
  SendHelperBody,
  ShareView,
} from "@/lib/contracts";

export class LinkError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      cache: "no-store",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new LinkError(0, "No connection. It will try again.");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new LinkError(res.status, data?.error || `Request failed (${res.status})`);
  return data as T;
}

const enc = encodeURIComponent;

export const getShare = (token: string) => request<ShareView>(`/api/locate/${enc(token)}`);
export const postShare = (token: string, body: LocateBody) => request<LocateResult>(`/api/locate/${enc(token)}`, "POST", body);

export const getHelper = (token: string) => request<HelperView>(`/api/helper/${enc(token)}`);
export const postHelper = (token: string, body: HelperUpdateBody) => request<HelperView>(`/api/helper/${enc(token)}`, "POST", body);

export const getLiveRegistry = () => request<LiveRegistry>("/api/registry/live");
export const sendHelper = (rowId: string, body: SendHelperBody) =>
  request<{ dispatch: DispatchSummary; via: string }>(`/api/registry/${enc(rowId)}/dispatch`, "POST", body);
