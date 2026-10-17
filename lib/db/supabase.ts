import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { COMPOSITE_KEYS, type Match, type Row, type Store, type TableName } from "./tables";

// Supabase adapter: same Store interface over supabase-js with the service-role key.
// Requires supabase/schema.sql and supabase/migrations/002_second_key.sql to be applied.

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

const keyCols = (t: TableName) => COMPOSITE_KEYS[t] ?? ["id"];

function clean<T>(match: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(match as Record<string, unknown>).filter(([, v]) => v !== undefined));
}

export function supabaseStore(): Store {
  const db = () => supabaseAdmin();
  return {
    backend: "supabase",
    async all<T extends TableName>(table: T) {
      const out: Row<T>[] = [];
      // Page through in 1,000-row chunks (PostgREST default cap).
      for (let from = 0; ; from += 1000) {
        const data = check(await db().from(table).select("*").range(from, from + 999), `select ${table}`);
        out.push(...((data ?? []) as Row<T>[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
    async where<T extends TableName>(table: T, match: Match<T>) {
      const data = check(await db().from(table).select("*").match(clean(match)), `select ${table}`);
      return (data ?? []) as Row<T>[];
    },
    async get<T extends TableName>(table: T, id: string) {
      const data = check(await db().from(table).select("*").eq("id", id).maybeSingle(), `get ${table}`);
      return (data ?? null) as Row<T> | null;
    },
    async insert<T extends TableName>(table: T, rows: Row<T> | Row<T>[]) {
      const list = Array.isArray(rows) ? rows : [rows];
      if (!list.length) return;
      check(await db().from(table).insert(list as never[]), `insert ${table}`);
    },
    async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>) {
      const data = check(
        await db().from(table).update(patch as never).eq("id", id).select("*").maybeSingle(),
        `update ${table}`,
      );
      return (data ?? null) as Row<T> | null;
    },
    async updateWhere<T extends TableName>(table: T, match: Match<T>, patch: Partial<Row<T>>) {
      const data = check(
        await db().from(table).update(patch as never).match(clean(match)).select(keyCols(table).join(",")),
        `update ${table}`,
      );
      return (data as unknown[] | null)?.length ?? 0;
    },
    async upsert<T extends TableName>(table: T, rows: Row<T> | Row<T>[]) {
      const list = Array.isArray(rows) ? rows : [rows];
      if (!list.length) return;
      check(
        await db().from(table).upsert(list as never[], { onConflict: keyCols(table).join(",") }),
        `upsert ${table}`,
      );
    },
    async remove<T extends TableName>(table: T, match: Match<T>) {
      const data = check(
        await db().from(table).delete().match(clean(match)).select(keyCols(table).join(",")),
        `delete ${table}`,
      );
      return (data as unknown[] | null)?.length ?? 0;
    },
    async clear(table: TableName) {
      const col = keyCols(table)[0];
      check(await db().from(table).delete().not(col, "is", null), `clear ${table}`);
    },
  };
}
