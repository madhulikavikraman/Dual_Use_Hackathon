import type { Metadata } from "next";
import FloodPage from "@/components/flood/FloodPage";
import "@/components/global/global.css";
import "@/components/flood/flood.css";

export const metadata: Metadata = {
  title: "Floods",
  description:
    "Twist 2 for floods: the same VoiceFlare ladder (watch, ask, slow, hold, hand to a person) in India, Japan, China, Greece, California and Australia, anchored on the July 2026 Pimpri-Chinchwad floods. Every fact is sourced.",
};

// Static shell, prerendered. The country switch is the only client component.
export default function Page() {
  return <FloodPage />;
}
