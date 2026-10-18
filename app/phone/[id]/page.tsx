import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import PhoneClient from "@/components/phone/PhoneClient";

// /phone/[id] — the browser phone a volunteer opens on their real phone (QR code on /phones).
// The id is runtime data (no generateStaticParams), so the client part renders inside Suspense.

export const metadata: Metadata = {
  title: "Phone · VoiceFlare",
  description: "Browser phone for the VoiceFlare emergency information line (hackathon demo).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
};

function Loading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-400">Connecting to the line…</main>
  );
}

export default function PhonePage() {
  return (
    <Suspense fallback={<Loading />}>
      <PhoneClient />
    </Suspense>
  );
}
