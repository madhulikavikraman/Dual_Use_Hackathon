import type { Metadata, Viewport } from "next";
import PublicLine from "@/components/phone/PublicLine";

// /call — the public line in the browser (the same agent as the phone number, for any language).

export const metadata: Metadata = {
  title: "Emergency information line · Second Key",
  description: "Call the Second Key demo line from the browser in eight languages.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
};

export default function CallPage() {
  return <PublicLine />;
}
