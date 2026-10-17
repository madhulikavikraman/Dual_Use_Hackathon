import "server-only";
import fs from "node:fs";
import path from "node:path";
import { COMPOSITE_KEYS, TABLES, type Match, type Row, type Store, type TableName } from "./tables";

// File-backed store for running the demo on one machine without Supabase.
// Data lives in memory (on globalThis, so every route bundle in the process shares it) and is
// written to .data/secondkey.json shortly after each change. Not for multi-instance hosting.

type Data = Record<TableName, Record<string, unknown>[]>;

interface Holder {
  data: Data;
  timer: ReturnType<typeof setTimeout> | null;
}

// SECONDKEY_DATA_FILE lets a test script run against its own file without touching the dev server's data.
const FILE = process.env.SECONDKEY_DATA_FILE ?? path.join(process.cwd(), ".data", "secondkey.json");

const g = globalThis as unknown as { __secondKeyStore?: Holder };

function emptyData(): Data {
  return Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Data;
}

function holder(): Holder {
  if (g.__secondKeyStore) return g.__secondKeyStore;
  let data = emptyData();
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as Partial<Data>;
      data = { ...data, ...parsed };
      for (const t of TABLES) if (!Array.isArray(data[t])) data[t] = [];
    }
  } catch (e) {
    console.error("[store] could not read", FILE, e);
  }
  g.__secondKeyStore = { data, timer: null };
  return g.__secondKeyStore;
}

function persist() {
  const h = holder();
  if (h.timer) return;
  h.timer = setTimeout(() => {
    h.timer = null;
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      const tmp = `${FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(h.data));
      fs.renameSync(tmp, FILE);
    } catch (e) {
      console.error("[store] could not write", FILE, e);
    }
  }, 150);
}

const clone = <T>(v: T): T => structuredClone(v);

function keyOf(table: TableName, row: Record<string, unknown>): string {
  const keys = COMPOSITE_KEYS[table];
  if (keys) return keys.map((k) => String(row[k])).join("|");
  return String(row.id);
}

function matches(row: Record<string, unknown>, match: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(match)) {
    if (v === undefined) continue;
    if (row[k] !== v) return false;
  }
  return true;
}

export function localStore(): Store {
  const rows = (t: TableName) => holder().data[t];
  return {
    backend: "local",
    async all<T extends TableName>(table: T) {
      return clone(rows(table)) as unknown as Row<T>[];
    },
    async where<T extends TableName>(table: T, match: Match<T>) {
      return clone(rows(table).filter((r) => matches(r, match as Record<string, unknown>))) as unknown as Row<T>[];
    },
    async get<T extends TableName>(table: T, id: string) {
      const r = rows(table).find((x) => x.id === id);
      return r ? (clone(r) as unknown as Row<T>) : null;
    },
    async insert<T extends TableName>(table: T, input: Row<T> | Row<T>[]) {
      const list = (Array.isArray(input) ? input : [input]) as unknown as Record<string, unknown>[];
      rows(table).push(...clone(list));
      persist();
    },
    async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>) {
      const r = rows(table).find((x) => x.id === id);
      if (!r) return null;
      Object.assign(r, clone(patch));
      persist();
      return clone(r) as unknown as Row<T>;
    },
    async updateWhere<T extends TableName>(table: T, match: Match<T>, patch: Partial<Row<T>>) {
      let n = 0;
      for (const r of rows(table)) {
        if (matches(r, match as Record<string, unknown>)) {
          Object.assign(r, clone(patch));
          n++;
        }
      }
      if (n) persist();
      return n;
    },
    async upsert<T extends TableName>(table: T, input: Row<T> | Row<T>[]) {
      const list = (Array.isArray(input) ? input : [input]) as unknown as Record<string, unknown>[];
      const existing = rows(table);
      for (const row of list) {
        const k = keyOf(table, row);
        const i = existing.findIndex((x) => keyOf(table, x) === k);
        if (i >= 0) existing[i] = { ...existing[i], ...clone(row) };
        else existing.push(clone(row));
      }
      persist();
    },
    async remove<T extends TableName>(table: T, match: Match<T>) {
      const before = rows(table);
      const kept = before.filter((r) => !matches(r, match as Record<string, unknown>));
      holder().data[table] = kept;
      persist();
      return before.length - kept.length;
    },
    async clear(table: TableName) {
      holder().data[table] = [];
      persist();
    },
  };
}
