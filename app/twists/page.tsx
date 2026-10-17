import type { Metadata } from "next";
import TwistsView from "@/components/data/TwistsView";

export const metadata: Metadata = {
  title: "Twist log",
  description: "Each twist: what changed in the build, why, proof and commits.",
};

export default function TwistsPage() {
  return <TwistsView />;
}
