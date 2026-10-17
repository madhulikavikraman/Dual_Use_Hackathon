// /poster: the 24 x 36 in Demo Day poster (Twist 3). Print it with Chrome's --print-to-pdf; the page sets
// @page size itself. Content: components/poster/Poster.tsx.
import type { Metadata } from "next";
import { Poster } from "@/components/poster/Poster";

export const metadata: Metadata = {
  title: "Poster",
  description: "VoiceFlare's 24 x 36 inch Demo Day poster.",
};

export default function PosterPage() {
  return <Poster />;
}
