import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { LocateClientFromRoute } from "@/components/locate/LocateClient";

// /l/[token]: the live-location link a person gets by text after saying yes on the call. Open to anyone with the
// link (proxy.ts): the unguessable token is the key. No name or phone on the page.

export const metadata: Metadata = {
  title: "Share your location",
  description: "Share your phone's live location with the response team until help reaches you.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050505",
};

// The token is runtime data (no generateStaticParams), so the client part reads it inside Suspense.
export default function LocatePage() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center text-lg bg-vf-ink text-vf-smoke">Opening your link…</main>}>
      <LocateClientFromRoute />
    </Suspense>
  );
}
