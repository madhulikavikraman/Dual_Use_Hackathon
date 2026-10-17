import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { HelperClientFromRoute } from "@/components/helper/HelperClient";

// /helper/[token]: the link a helper gets when a named human sends them to a registry row. Open to anyone with the
// link (proxy.ts): the unguessable token is the key.

export const metadata: Metadata = {
  title: "Helper",
  description: "The person's latest location, needs and status buttons for a helper sent by the response team.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

// The token is runtime data (no generateStaticParams), so the client part reads it inside Suspense.
export default function HelperPage() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center text-lg bg-slate-100 text-slate-600">Opening the assignment…</main>}>
      <HelperClientFromRoute />
    </Suspense>
  );
}
