"use client";

// Live-location links and helpers sent, for the board's registry list and the QRT view. One poll of
// GET /api/registry/live (desk only) shared by every row on the screen.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { DispatchSummary, LiveRegistry, ShareSummary } from "@/lib/contracts";
import { usePoll } from "@/lib/client/usePoll";
import { getLiveRegistry } from "./api";

const POLL_MS = 2000;

export interface RowLive {
  share: ShareSummary | null; // newest link for the row
  dispatch: DispatchSummary | null; // newest helper sent to the row
}

interface LiveValue {
  live: LiveRegistry | null;
  byHelp: Map<string, RowLive>;
  refresh: () => void;
}

const Ctx = createContext<LiveValue | null>(null);

export function LiveRegistryProvider({ children }: { children: ReactNode }) {
  const { data, refresh } = usePoll(getLiveRegistry, POLL_MS);
  const byHelp = useMemo(() => {
    const m = new Map<string, RowLive>();
    // Both lists come newest first: keep the first one seen per row.
    for (const s of data?.shares ?? []) {
      if (!s.help_request_id) continue;
      const cur = m.get(s.help_request_id) ?? { share: null, dispatch: null };
      if (!cur.share) m.set(s.help_request_id, { ...cur, share: s });
    }
    for (const d of data?.dispatches ?? []) {
      const cur = m.get(d.help_request_id) ?? { share: null, dispatch: null };
      if (!cur.dispatch) m.set(d.help_request_id, { ...cur, dispatch: d });
    }
    return m;
  }, [data]);
  const value = useMemo(() => ({ live: data, byHelp, refresh }), [data, byHelp, refresh]);
  return <Ctx value={value}>{children}</Ctx>;
}

const EMPTY: LiveValue = { live: null, byHelp: new Map(), refresh: () => {} };

/** Live data for the rows; outside a provider (an older screen) it is simply empty. */
export function useLiveRegistry(): LiveValue {
  return useContext(Ctx) ?? EMPTY;
}
