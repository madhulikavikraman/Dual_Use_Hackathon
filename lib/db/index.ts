import "server-only";
import { storageBackend } from "@/lib/env";
import { localStore } from "./local";
import { supabaseStore } from "./supabase";
import type { Store } from "./tables";

export type { Store, TableName, Tables, Row, Match } from "./tables";

let store: Store | null = null;

/** The server's data store: Supabase when configured, otherwise the local file store. */
export function db(): Store {
  if (store) return store;
  store = storageBackend() === "supabase" ? supabaseStore() : localStore();
  return store;
}

export const nowIso = () => new Date().toISOString();
export const isoIn = (ms: number) => new Date(Date.now() + ms).toISOString();
export const uid = () => crypto.randomUUID();

// In-process mutex so overlapping ticks (several boards polling) do not double-dispatch.
const g = globalThis as unknown as { __secondKeyLocks?: Map<string, Promise<unknown>> };
const locks = (g.__secondKeyLocks ??= new Map());

/** Run fn with the named lock. If the lock is busy and `skipIfBusy`, return null at once. */
export async function withLock<T>(name: string, fn: () => Promise<T>, skipIfBusy = false): Promise<T | null> {
  const busy = locks.get(name);
  if (busy && skipIfBusy) return null;
  const prev = busy ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  const chained = prev.then(() => mine);
  locks.set(name, chained);
  await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(name) === chained) locks.delete(name);
  }
}
