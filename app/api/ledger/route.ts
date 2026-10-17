import { connection } from "next/server";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/http";

/** GET /api/ledger — every human decision and every refused action, newest first. */
export async function GET() {
  await connection();
  return handle(async () => {
    const rows = (await db().all("ledger")).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return json({ rows });
  });
}
