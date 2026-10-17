import { connection, type NextRequest } from "next/server";
import { householdsCsv, KINDS, ledgerCsv, registryCsv, type Kind } from "@/lib/csvExport";
import { bad, handle } from "@/lib/http";

// CSV exports for the field (PRD 11 "Export: CSV for the field", backlog item 19). The registry CSV includes
// phone numbers ON PURPOSE: it is the QRT's working list for call-backs and door knocks, unlike the public
// GeoJSON feeds, which strip phones and names. Treat a downloaded file as sensitive (purge 72 h after close).
// Live GPS is the one thing a file never carries exactly: the person agreed to share it until help reaches them, and a
// download outlives that. Those rows export the hex-cell centre; the QRT view and the helper's link have the live fix.

/** GET /api/export/csv?kind=registry|households|ledger (registry by default). */
export async function GET(req: NextRequest) {
  await connection();
  return handle(async () => {
    const kind = (req.nextUrl.searchParams.get("kind") ?? "registry") as Kind;
    if (!KINDS.includes(kind)) throw bad(`kind must be one of ${KINDS.join(", ")}`);
    const csv = kind === "registry" ? await registryCsv() : kind === "households" ? await householdsCsv() : await ledgerCsv();
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="voiceflare-${kind}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
