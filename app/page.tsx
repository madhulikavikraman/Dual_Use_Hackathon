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
  title: { absolute: "VoiceFlare: help that understands you" },
  description:
    "VoiceFlare helps people evacuate, so fewer lives are lost and getting out is easier: calls in each household's language, block-by-block waves so roads stay clear, and a helper sent to anyone who cannot leave alone. A named person approves every word. Hackathon demo: synthetic residents; nothing reaches a real alert system.",
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
