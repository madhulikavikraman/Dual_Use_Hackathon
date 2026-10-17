"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { BoardSnapshot, HouseholdView } from "@/lib/contracts";
import type { Zone } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export interface BoardContextValue {
  snap: BoardSnapshot;
  /** Poll /api/board now (after an action). */
  refresh: () => void;
  /** Server clock minus client clock, in ms (countdowns use the client clock plus this). */
  clockOffset: number;
  householdById: Map<string, HouseholdView>;
  zoneById: Map<string, Zone>;
}

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({
  snap,
  refresh,
  clockOffset,
  children,
}: Omit<BoardContextValue, "householdById" | "zoneById"> & { children: ReactNode }) {
  const householdById = useMemo(() => new Map(snap.households.map((h) => [h.id, h])), [snap.households]);
  const zoneById = useMemo(() => new Map(snap.zones.map((z) => [z.id, z])), [snap.zones]);
  const value = useMemo(
    () => ({ snap, refresh, clockOffset, householdById, zoneById }),
    [snap, refresh, clockOffset, householdById, zoneById],
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
