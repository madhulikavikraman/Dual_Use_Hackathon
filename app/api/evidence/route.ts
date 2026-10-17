import { connection, type NextRequest } from "next/server";
import { computeEvidence, evidenceCsv } from "@/lib/engine/evidence";
import { handle, json } from "@/lib/http";

/**
 * GET /api/evidence — the NSF SBIR Phase I milestones and the safety bar, computed live from this run (Twist 1).
 * `?format=csv` returns one CSV for a grant reviewer; `?download=1` serves either format as an attachment.
 */
export async function GET(req: NextRequest) {
  await connection();
  return handle(async () => {
    const e = await computeEvidence();
    const params = req.nextUrl.searchParams;
    const stamp = e.generated_at.replace(/[-:]/g, "").slice(0, 15);
    if (params.get("format") === "csv") {
      return new Response(evidenceCsv(e), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="second-key-phase1-evidence-${stamp}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const headers: Record<string, string> = params.get("download")
      ? { "Content-Disposition": `attachment; filename="second-key-phase1-evidence-${stamp}.json"` }
      : {};
    return json(e, 200, headers);
  });
}
