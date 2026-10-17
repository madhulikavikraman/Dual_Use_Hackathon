"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

// The name of the person at this screen, kept in localStorage so every decision dialog is pre-filled
// with it. The header input and the dialogs share it through this tiny store. The board's supervisor and
// the QRT lead are kept apart: the demo laptop has both pages open, and a name typed on the QRT page must
// never end up signing the supervisor's decisions in the ledger.

export type Operator = "supervisor" | "qrt";

const KEYS: Record<Operator, string> = { supervisor: "secondkey.supervisor", qrt: "secondkey.qrt" };

export const OPERATOR_LABEL: Record<Operator, string> = { supervisor: "Supervisor", qrt: "QRT lead" };

/** Whose name a screen's dialogs are signed with: the board is the supervisor's, /qrt provides "qrt". */
export const OperatorContext = createContext<Operator>("supervisor");

export const useOperator = (): Operator => useContext(OperatorContext);

const listeners = new Set<() => void>();
// Used when storage is unavailable (private mode, blocked site data).
const sessionValues: Record<Operator, string> = { supervisor: "", qrt: "" };

function read(operator: Operator): string {
  try {
    return localStorage.getItem(KEYS[operator]) ?? sessionValues[operator];
  } catch {
    return sessionValues[operator];
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function setOperatorName(operator: Operator, name: string) {
  sessionValues[operator] = name;
  try {
    localStorage.setItem(KEYS[operator], name);
  } catch {
    // Storage unavailable: sessionValues keeps the name for this tab.
  }
  listeners.forEach((l) => l());
}

/** The saved name for `operator` ("" until mounted or when none is saved). */
export function useOperatorName(operator: Operator): string {
  return useSyncExternalStore(subscribe, () => read(operator), () => "");
}

export const setSupervisorName = (name: string) => setOperatorName("supervisor", name);

/** The saved supervisor name ("" until mounted or when none is saved). */
export const useSupervisorName = (): string => useOperatorName("supervisor");
