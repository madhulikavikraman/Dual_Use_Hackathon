// Typed fetch helpers for the supervisor's screen and the QRT view. Client-safe.
// Every action endpoint may still be in progress: errors come back as ApiError with a readable message.
import type {
  ApproveZoneBody,
  ApproveZoneResult,
  BoardSnapshot,
  DecideProposalBody,
  DemoResetBody,
  HoldDecisionBody,
  OpenHoldBody,
  RegistryPatchBody,
  StartCampaignBody,
  ZoneDefaults,
} from "@/lib/contracts";
import type { Campaign, HelpRequest, Hold, PickupRun, Proposal, ZoneState } from "@/lib/types";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Name and reason for the ledger. Sent with actions whose contract has no reason field yet. */
export interface Signed {
  actor: string;
  reason: string;
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
    throw new ApiError(0, "The server did not answer. Check the connection and try again.");
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const serverMessage =
      data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : null;
    const fallback =
      res.status === 404 ? `Not available yet: ${method} ${path.split("?")[0]} (404)` : `Request failed (${res.status})`;
    throw new ApiError(res.status, serverMessage ?? fallback);
  }
  return data as T;
}

const enc = encodeURIComponent;

export const getBoard = () => request<BoardSnapshot>("/api/board");

export const getZoneDefaults = (zoneId: string, state: ZoneState) =>
  request<ZoneDefaults>(`/api/zones/${enc(zoneId)}/defaults?state=${enc(state)}`);

export const approveZone = (zoneId: string, body: ApproveZoneBody) =>
  request<ApproveZoneResult>(`/api/zones/${enc(zoneId)}/approve`, "POST", body);

export const decideProposal = (proposalId: string, body: DecideProposalBody) =>
  request<{ proposal: Proposal; result: ApproveZoneResult | null }>(`/api/proposals/${enc(proposalId)}/decide`, "POST", body);

// The campaign, call-back and pickup-run routes take only a name today; the reason rides along for the
// ledger (extra keys are ignored by the route's schema until it logs them).
export const startCampaign = (body: StartCampaignBody & { reason: string }) =>
  request<Campaign>("/api/campaigns", "POST", body);

export const openHold = (body: OpenHoldBody) => request<Hold>("/api/holds", "POST", body);

export const decideHold = (holdId: string, body: HoldDecisionBody) =>
  request<Hold>(`/api/holds/${enc(holdId)}/decision`, "POST", body);

export const patchRegistry = (rowId: string, body: RegistryPatchBody) =>
  request<HelpRequest>(`/api/registry/${enc(rowId)}`, "PATCH", body);

export const callBack = (rowId: string, signed: Signed) =>
  request<{ call_id: string }>(`/api/registry/${enc(rowId)}/callback`, "POST", signed);

export const buildPickupRuns = (signed: Signed) => request<{ runs: PickupRun[] }>("/api/registry/runs", "POST", signed);

/** "Ask the board": a read-only answer from a summary of the live board (3 to 500 characters). */
export const askBoard = (question: string) => request<{ answer: string }>("/api/ask", "POST", { question });

export const resetDemo = (scenario: NonNullable<DemoResetBody["scenario"]>) =>
  request<unknown>("/api/demo/reset", "POST", { scenario } satisfies DemoResetBody);

export const EXPORT_CSV_URL = "/api/export/csv?kind=registry";
