"use client";

import { useSyncExternalStore } from "react";

// The supervisor's name, kept in localStorage so every decision dialog is pre-filled with it.
// The header input and the dialogs share it through this tiny store.

const KEY = "secondkey.supervisor";
const listeners = new Set<() => void>();
let sessionValue = ""; // used when storage is unavailable (private mode, blocked site data)

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? sessionValue;
  } catch {
    return sessionValue;
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

export function setSupervisorName(name: string) {
  sessionValue = name;
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // Storage unavailable: sessionValue keeps the name for this tab.
  }
  listeners.forEach((l) => l());
}

/** The saved supervisor name ("" until mounted or when none is saved). */
export function useSupervisorName(): string {
  return useSyncExternalStore(subscribe, read, () => "");
}
