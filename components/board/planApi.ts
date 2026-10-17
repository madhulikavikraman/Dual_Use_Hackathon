// Client calls for block-by-block plans (app/api/zones/[id]/plan/*). Every action carries a name and a reason.
import type { EvacPlan, EvacTemplates } from "@/lib/types";

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("The server did not answer. Check the connection and try again.");
  }
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

const base = (zoneId: string) => `/api/zones/${encodeURIComponent(zoneId)}/plan`;
type Signed = { actor: string; reason: string };

export const proposePlan = (zoneId: string, actor?: string) => post<{ plan: EvacPlan }>(base(zoneId), actor ? { actor } : {});
export const approvePlan = (zoneId: string, s: Signed, extra: { wave_minutes?: number; templates?: Partial<EvacTemplates> } = {}) =>
  post<{ plan: EvacPlan }>(`${base(zoneId)}/approve`, { approved_by: s.actor, reason: s.reason, ...extra });
export const rejectPlan = (zoneId: string, s: Signed) => post<{ plan: EvacPlan }>(`${base(zoneId)}/reject`, s);
export const advanceWave = (zoneId: string, s: Signed) => post<{ plan: EvacPlan }>(`${base(zoneId)}/advance`, s);
export const holdWave = (zoneId: string, s: Signed, release = false) => post<{ plan: EvacPlan }>(`${base(zoneId)}/hold`, { ...s, release });
export const everyoneGoNow = (zoneId: string, s: Signed) => post<{ plan: EvacPlan }>(`${base(zoneId)}/go-now`, s);
