import type { Metadata } from "next";
import EvidenceView from "@/components/data/EvidenceView";

export const metadata: Metadata = {
  title: "Phase I evidence",
  description: "NSF SBIR Phase I milestones measured live from this run (Twist 1).",
};

// The page shell is static; the numbers are fetched from GET /api/evidence by the client every 5 s.
export default function EvidencePage() {
  return <EvidenceView />;
}
