// /global/flood: Twist 2 for floods. A flood is the same problem in every country: warnings that wake everyone, or
// come late. VoiceFlare's ladder (watch, ask, slow, hold, hand to a person) carries over; the official words, the
// decider, the channel and the number change. Anchor: the July 2026 Pimpri-Chinchwad floods. Facts from lib/floods.ts.
// Static shell (prerendered); the country switch is the only client island.
import Image from "next/image";
import Link from "next/link";
import AnchorCard from "./AnchorCard";
import CountrySwitch from "./CountrySwitch";
import FloodLadder from "./FloodLadder";
import SourceList from "./SourceList";
import StaysChanges from "./StaysChanges";
import { Section, focusRing } from "./ui";

const SECTIONS: { id: string; label: string }[] = [
  { id: "ladder", label: "Ladder" },
  { id: "countries", label: "Six countries" },
  { id: "same", label: "Same and different" },
  { id: "sources", label: "Sources" },
];

function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-vf-ash/80 bg-vf-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="VoiceFlare home" className={`flex shrink-0 items-center gap-2.5 rounded-md ${focusRing}`}>
            <Image src="/brand/voiceflare-mark.png" alt="" width={822} height={822} loading="eager" className="h-8 w-8" />
            <Image src="/brand/voiceflare-wordmark.png" alt="" width={941} height={94} loading="eager" className="hidden h-3.5 w-auto min-[400px]:block" />
          </Link>
          <span aria-hidden="true" className="hidden h-5 w-px bg-vf-ash sm:block" />
          <nav aria-label="Breadcrumb" className="hidden sm:block">
            <ol className="flex items-center gap-2 font-display text-sm font-semibold">
              <li>
                <Link href="/global" className={`rounded text-vf-smoke hover:text-vf-bone ${focusRing}`}>
                  Global
                </Link>
              </li>
              <li aria-hidden="true" className="text-vf-smoke/60">
                /
              </li>
              <li aria-current="page" className="text-vf-bone">
                Floods
              </li>
            </ol>
          </nav>
        </div>
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="flex items-center gap-5 text-sm text-vf-smoke">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={`rounded hover:text-vf-bone ${focusRing}`}>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <Link
          href="/global"
          className={`shrink-0 rounded-lg border border-vf-ash px-3 py-1.5 text-sm text-vf-bone transition-colors hover:border-vf-flare/60 ${focusRing}`}
        >
          <span className="sm:hidden">Global</span>
          <span className="hidden sm:inline">All of Twist 2</span>
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section aria-labelledby="flood-title" className="relative">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 lg:px-8 lg:pb-20 lg:pt-12">
        <div className="vfg-rise min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-vf-smoke">
            <span aria-hidden="true">🌊</span>
            Twist 2, make it global: floods
          </p>
          <h1
            id="flood-title"
            className="mt-6 text-balance font-display text-5xl font-bold leading-[0.95] tracking-tight text-vf-bone sm:text-6xl lg:text-[3.5rem] xl:text-[3.75rem]"
          >
            Floods are the same problem everywhere.
          </h1>
          <p className="mt-6 text-xl leading-snug text-vf-bone sm:text-2xl">
            Warnings wake everyone, or they come late.
          </p>
          <p className="mt-3 max-w-prose text-base leading-relaxed text-vf-smoke">
            Rain gauges and dam releases give hours of notice. Still, in Pune, Valencia and Lismore the warnings came late.
            VoiceFlare&apos;s ladder for floods is the same in every country: watch, ask, slow, hold, hand to a person. The
            official words, the decider and the number change with the place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#ladder"
              className={`inline-flex min-h-11 items-center rounded-lg bg-vf-flare px-4 text-sm font-semibold text-vf-ink transition-colors hover:bg-[#ff4b30] ${focusRing}`}
            >
              See the flood ladder
            </a>
            <a
              href="#countries"
              className={`inline-flex min-h-11 items-center rounded-lg border border-vf-ash px-4 text-sm font-semibold text-vf-bone transition-colors hover:border-vf-flare/60 ${focusRing}`}
            >
              Pick a country
            </a>
          </div>
        </div>
        <AnchorCard />
      </div>
    </section>
  );
}

function Footer() {
  const links = [
    { href: "/", label: "Home" },
    { href: "/global", label: "Global" },
    { href: "/board", label: "Supervisor board" },
    { href: "/twists", label: "Twist log" },
    { href: "/evidence", label: "Evidence" },
  ];
  return (
    <footer className="border-t border-vf-ash/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-8">
        <div className="flex max-w-2xl gap-3">
          <Image src="/brand/voiceflare-mark.png" alt="" width={822} height={822} className="h-7 w-7 shrink-0" />
          <p className="text-sm leading-relaxed text-vf-smoke">
            Official terms are quoted from the sources on this page. The ladder lines for each country are VoiceFlare&apos;s
            design, not official plans, and VoiceFlare never replaces or holds a country&apos;s own warning. USC x InnovateLA
            Dual-Use Hackathon, Resilience Comms track.
          </p>
        </div>
        <nav aria-label="VoiceFlare pages">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={`rounded text-vf-bone/85 hover:text-vf-flare ${focusRing}`}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

export default function FloodPage() {
  return (
    <div className="vfg-root vff-root flex min-h-screen flex-1 flex-col bg-vf-ink text-vf-bone [color-scheme:dark]">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-vf-bone px-4 py-2 text-sm font-semibold text-vf-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        Skip to content
      </a>
      <TopBar />
      <main id="main" className="flex-1">
        <Hero />

        <Section
          id="ladder"
          title="The flood ladder"
          lede="The gentlest alert that still works. Five steps, in order; each asks a little more of people, and a named person decides every step that moves them."
        >
          <FloodLadder />
        </Section>

        <Section
          id="countries"
          title="Six countries, one ladder"
          lede="Pick a country. Its official warning levels, order words, decider, channel, number and helpers change; the ladder does not. Each country has one recent flood and what it taught."
        >
          <CountrySwitch initial="IN" />
        </Section>

        <Section
          id="same"
          title="What stays, what changes"
          lede="Six rules travel to every flood plain unchanged. Six adapters take the local words, people and law."
        >
          <StaysChanges />
        </Section>

        <Section id="sources" title="Sources" lede="Every fact on this page links to where it came from. Hover a link to see the claim it supports.">
          <SourceList />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
