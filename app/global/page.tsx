import type { Metadata } from "next";
import GlobalPage from "@/components/global/GlobalPage";
import "@/components/global/global.css";

export const metadata: Metadata = {
  title: "Global",
  description:
    "Twist 2: the same VoiceFlare in any country. Six things never change; six adapters do. Los Angeles and Chongqing side by side, with profiles for Japan, Greece, India and Australia.",
};

// Static shell, prerendered. The adapter switch, the GCJ-02 explainer and the "Load the Chongqing scenario" button
// are client components; the button posts to /api/demo/reset and then opens /board.
export default function Page() {
  return <GlobalPage />;
}
