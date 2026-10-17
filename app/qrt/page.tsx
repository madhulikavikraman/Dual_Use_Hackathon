import type { Metadata } from "next";
import { QrtScreen } from "./QrtScreen";

export const metadata: Metadata = {
  title: "Quick response team",
  description: "The help registry for the quick response team: last-seen map, row actions, pickup runs and a printable door-knock sheet.",
};

export default function QrtPage() {
  return <QrtScreen />;
}
