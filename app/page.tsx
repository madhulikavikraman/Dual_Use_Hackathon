import type { Metadata } from "next";
import { Closing, Footer } from "@/components/landing/Closing";
import { DualUse } from "@/components/landing/DualUse";
import { Global } from "@/components/landing/Global";
import { Hero } from "@/components/landing/Hero";
import { Ladder } from "@/components/landing/Ladder";
import { LiveStrip } from "@/components/landing/LiveStrip";
import { Screens } from "@/components/landing/Screens";
import { StickyBar } from "@/components/landing/StickyBar";
import { Stories } from "@/components/landing/Stories";
import { Collections, Tuesday } from "@/components/landing/Tuesday";

export const metadata: Metadata = {
  title: { absolute: "VoiceFlare: ask the edge before an alert wakes a zone" },
  description:
    "VoiceFlare holds an evacuation order 90 seconds for a named human, asks the people at the zone's edge what they see, shows how many phones it will wake, and calls residents with only the words that human approved. Hackathon demo: synthetic residents; nothing reaches a real alert system.",
};

// The landing page, which is also the demo's setup guide. The shell is a server component: the logo, the copy and
// the data from lib/stories.ts and lib/jurisdictions.ts render on the server. The only client islands are the hold
// replay in the hero, the ladder's reveal and the sticky bar (motion/react, LazyMotion).
export default function Home() {
  return (
    <div id="top" className="vf-landing flex min-h-dvh w-full flex-1 flex-col bg-vf-ink text-vf-bone">
      <StickyBar watchId="hero-ctas" />
      <LiveStrip />
      <main className="flex-1">
        <Hero />
        <DualUse />
        <Stories />
        <Ladder />
        <Screens />
        <Global />
        <Tuesday />
        <Collections />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
