"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { BoardSnapshot, HouseholdView } from "@/lib/contracts";
import type { Hold, Zone } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export interface BoardContextValue {
  snap: BoardSnapshot;
  /** Poll /api/board now (after an action). */
  refresh: () => void;
  /** Server clock minus client clock, in ms (countdowns use the client clock plus this). */
  clockOffset: number;
  householdById: Map<string, HouseholdView>;
  zoneById: Map<string, Zone>;
  /** Open holds, oldest first: a stable order between polls, whatever order storage returns them in. */
  openHolds: Hold[];
  /** The open hold on screen: the one picked in the hold strip, else the oldest. The map draws the same one. */
  hold: Hold | null;
  selectHold: (id: string) => void;
}

type Derived = "householdById" | "zoneById" | "openHolds" | "hold" | "selectHold";

const BoardContext = createContext<BoardContextValue | null>(null);

const byStart = (a: Hold, b: Hold) =>
  a.started_at === b.started_at ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.started_at < b.started_at ? -1 : 1;

export function BoardProvider({
  snap,
  refresh,
  clockOffset,
  children,
}: Omit<BoardContextValue, Derived> & { children: ReactNode }) {
  const householdById = useMemo(() => new Map(snap.households.map((h) => [h.id, h])), [snap.households]);
  const zoneById = useMemo(() => new Map(snap.zones.map((z) => [z.id, z])), [snap.zones]);
  const openHolds = useMemo(() => snap.holds.filter((h) => h.status === "open").sort(byStart), [snap.holds]);
  const [selectedHoldId, setSelectedHoldId] = useState<string | null>(null);
  const hold = openHolds.find((h) => h.id === selectedHoldId) ?? openHolds[0] ?? null;
  const value = useMemo(
    () => ({ snap, refresh, clockOffset, householdById, zoneById, openHolds, hold, selectHold: setSelectedHoldId }),
    [snap, refresh, clockOffset, householdById, zoneById, openHolds, hold],
  );
  return <BoardContext value={value}>{children}</BoardContext>;
}

export function useBoard(): BoardContextValue {
  const value = useContext(BoardContext);
  if (!value) throw new Error("useBoard must be used inside <BoardProvider>");
  return value;
}

/**
 * Runs an action against the API: on success it toasts and polls the board at once; on failure it
 * rethrows so the dialog that started it can show the error inline.
 */
export function useAct() {
  const { refresh } = useBoard();
  const toast = useToast();
  return useCallback(
    async <T,>(action: () => Promise<T>, success: string | ((result: T) => string)): Promise<T> => {
      const result = await action();
      toast(typeof success === "function" ? success(result) : success, "good");
      refresh();
      return result;
    },
    [refresh, toast],
  );
}
