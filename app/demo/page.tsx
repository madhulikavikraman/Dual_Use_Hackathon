import type { Metadata } from "next";
import DemoConsole from "@/components/data/DemoConsole";

export const metadata: Metadata = {
  title: "Demo console",
  description: "Reset scenarios, drive the simulator, run the models, copy the ArcGIS feeds.",
};

// The feed token goes to the operator's console so the ArcGIS URLs can be copied. The console itself can
// reset the whole run, so it is already operator-only; the feeds carry no phones or names.
export default function DemoPage() {
  const feedToken = process.env.FEED_TOKEN?.trim() || "demo";
  const publicBase = process.env.APP_BASE_URL?.trim() || null;
  return <DemoConsole feedToken={feedToken} defaultBase={publicBase} />;
}
