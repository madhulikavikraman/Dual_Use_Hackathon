// /global: the Twist 2 answer. "Let's make it global... if you are solving for fire-fighters in Los Angeles, how can
// ones in China implement it?" The product does not change; six adapters do (PRD 17.2, decisions D-37 to D-41).
// Static shell (prerendered); the switch, the GCJ-02 explainer and the load button are client islands.
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { JURISDICTIONS } from "@/lib/jurisdictions";
import { HERITAGE } from "@/lib/stories";
import AdapterSwitch from "./AdapterSwitch";
import AdapterTable from "./AdapterTable";
import ChinaExample from "./ChinaExample";
import GcjExplainer from "./GcjExplainer";
import LadderMatrix from "./LadderMatrix";
import LoadChongqingButton from "./LoadChongqingButton";
import LocalText from "./LocalText";
import ProfileCards from "./ProfileCards";
import { INVARIANTS, PLACES, hostOf } from "./content";

const SECTIONS: { id: string; label: string }[] = [
  { id: "invariants", label: "Never changes" },
  { id: "adapters", label: "Adapters" },
  { id: "china", label: "China" },
  { id: "maps", label: "Maps" },
  { id: "ladder", label: "Ladder" },
  { id: "more", label: "More countries" },
];

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember";

function Section({ id, title, lede, children }: { id: string; title: string; lede?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-16 border-t border-vf-ash/70">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <h2 id={`${id}-h`} className="font-display text-3xl font-bold leading-tight tracking-tight text-vf-bone sm:text-4xl">
            {title}
          </h2>
          {lede ? <p className="mt-3 text-base leading-relaxed text-vf-smoke sm:text-lg">{lede}</p> : null}
        </div>
        <div className="mt-8 lg:mt-10">{children}</div>
      </div>
    </section>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-vf-ash/80 bg-vf-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="VoiceFlare home" className={`flex shrink-0 items-center gap-2.5 rounded-md ${focusRing}`}>
            <Image src="/brand/voiceflare-mark.png" alt="" width={822} height={822} loading="eager" className="h-8 w-8" />
            <Image src="/brand/voiceflare-wordmark.png" alt="" width={941} height={94} loading="eager" className="h-3.5 w-auto" />
          </Link>
          <span aria-hidden="true" className="hidden h-5 w-px bg-vf-ash sm:block" />
          <span className="hidden font-display text-sm font-semibold text-vf-bone sm:block">Global</span>
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
          href="/board"
          className={`shrink-0 rounded-lg border border-vf-ash px-3 py-1.5 text-sm text-vf-bone transition-colors hover:border-vf-flare/60 ${focusRing}`}
        >
          <span className="sm:hidden">Board</span>
          <span className="hidden sm:inline">Open the board</span>
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section aria-labelledby="global-title" className="relative">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 lg:px-8 lg:pb-20 lg:pt-12">
        <div className="vfg-rise min-w-0">
          <figure>
            <blockquote className="border-l-2 border-vf-flare pl-4 text-[0.95rem] leading-relaxed text-vf-smoke">
              <p>
                &ldquo;How does the same solution hold up in another part of the world? For example, if you are solving for
                fire-fighters in Los Angeles, how can ones in China implement it?&rdquo;
              </p>
            </blockquote>
            <figcaption className="mt-2 pl-4 text-xs text-vf-smoke/80">Twist 2, Saturday 4:30 AM</figcaption>
          </figure>
          <h1
            id="global-title"
            className="mt-8 text-balance font-display text-5xl font-bold leading-[0.95] tracking-tight text-vf-bone sm:text-6xl lg:text-[3.5rem] xl:text-[3.75rem]"
          >
            Same product, any country.
          </h1>
          <p className="mt-6 text-xl leading-snug text-vf-bone sm:text-2xl">The product does not change; six adapters do.</p>
          <p className="mt-3 max-w-prose text-base leading-relaxed text-vf-smoke">
            Every country has its own words for &lsquo;leave now&rsquo;, its own emergency number and its own rules on AI and
            data. VoiceFlare keeps the human key and swaps six adapters. Built for Los Angeles and Chongqing; profiled for Japan,
            Greece, India and Australia.
          </p>
          <div className="mt-8">
            <LoadChongqingButton
              note={
                <>
                  Puts the Beibei scenario on the board. It replaces the current run; the twist log is kept. Or{" "}
                  <Link
                    href="/board"
                    className={`rounded text-vf-bone underline decoration-vf-smoke/50 underline-offset-4 hover:text-vf-flare ${focusRing}`}
                  >
                    open the board as it is
                  </Link>
                  .
                </>
              }
            />
          </div>
        </div>
        <AdapterSwitch initial="CN" />
      </div>
    </section>
  );
}

function Collections() {
  const { name, one_liner, flow, stories } = HERITAGE;
  if (!one_liner && !flow.length && !stories.length) return null;
  return (
    <Section
      id="collections"
      title={`The ${name}, in any country`}
      lede={
        <>
          {one_liner} It rides the same six adapters, so a library in {PLACES.IN.place} hears {JURISDICTIONS.IN.call_now} and an
          archive in {PLACES.CN.place} hears {JURISDICTIONS.CN.call_now}.
        </>
      }
    >
      {flow.length ? (
        <ol className="grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {flow.map((f) => (
            <li key={f.stage} className="border-t-2 border-vf-bone/70 pt-4">
              <h3 className="font-display text-lg font-semibold text-vf-bone">{f.stage}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-vf-bone/85">{f.what_happens}</p>
              <p className="mt-2 text-sm leading-relaxed text-vf-smoke">{f.rule}</p>
            </li>
          ))}
        </ol>
      ) : null}
      {stories.length ? (
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {stories.map((s) => (
            <li key={s.id} className="rounded-2xl border border-vf-ash bg-vf-coal p-5">
              <h3 className="font-display text-lg font-semibold text-vf-bone">{s.title}</h3>
              <p className="mt-0.5 text-sm text-vf-smoke">{[s.where, s.when].filter(Boolean).join(", ")}</p>
              {s.what_happened ? <p className="mt-3 text-sm leading-relaxed text-vf-bone/90">{s.what_happened}</p> : null}
              {s.what_voiceflare_changes ? (
                <p className="mt-2 text-sm leading-relaxed text-vf-smoke">{s.what_voiceflare_changes}</p>
              ) : null}
              {s.source_url ? (
                <a
                  href={s.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className={`mt-3 inline-block text-xs text-vf-smoke underline decoration-vf-smoke/40 underline-offset-2 hover:text-vf-bone ${focusRing}`}
                >
                  Source: {hostOf(s.source_url)}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

function Footer() {
  const links = [
    { href: "/", label: "Home" },
    { href: "/board", label: "Supervisor board" },
    { href: "/twists", label: "Twist log" },
    { href: "/evidence", label: "Evidence" },
    { href: "/demo", label: "Demo console" },
  ];
  return (
    <footer className="border-t border-vf-ash/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-8">
        <div className="flex max-w-2xl gap-3">
          <Image src="/brand/voiceflare-mark.png" alt="" width={822} height={822} className="h-7 w-7 shrink-0" />
          <p className="text-sm leading-relaxed text-vf-smoke">
            Directive wording outside California is a demo paraphrase, never an official text. Residents are synthetic except six
            volunteer phones, and nothing reaches a real alert system. USC x InnovateLA Dual-Use
            Hackathon, Resilience Comms track.
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

export default function GlobalPage() {
  return (
    <div className="vfg-root flex min-h-screen flex-1 flex-col bg-vf-ink text-vf-bone [color-scheme:dark]">
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
          id="invariants"
          title="Six things that never change"
          lede="They are the safety properties, and they are what travels. They run the same in Chongqing, Ōfunato or Rhodes as in Los Angeles."
        >
          <ol className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {INVARIANTS.map((v, i) => (
              <li key={v.title} className="border-t-2 border-vf-bone/80 pt-4">
                <span aria-hidden="true" className="font-display text-sm font-semibold text-vf-smoke">
                  {i + 1}
                </span>
                <h3 className="mt-1 font-display text-lg font-semibold text-vf-bone">{v.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-vf-smoke">{v.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section
          id="adapters"
          title="Six adapters: Los Angeles and Chongqing"
          lede="Each row is one slot. The words, the number, the channel, the model and the data rules are local; the rules above them are not."
        >
          <AdapterTable />
          <p className="mt-3 text-sm text-vf-smoke sm:hidden">Scroll the table sideways to see both columns.</p>
          <Link
            href="/global/flood"
            className={`mt-6 flex items-center gap-3 rounded-2xl border border-vf-ash bg-vf-coal p-4 transition-colors hover:border-vf-flare/60 sm:p-5 ${focusRing}`}
          >
            <span aria-hidden="true" className="text-2xl">🌊</span>
            <span className="min-w-0 flex-1 text-sm text-vf-smoke">
              <span className="block font-display text-base font-semibold text-vf-bone">Floods, in all six countries</span>
              The same ladder for rising water: official warning words, deciders and lessons, from Pune to Lismore.
            </span>
            <span aria-hidden="true" className="text-vf-flare">→</span>
          </Link>
        </Section>

        <Section
          id="china"
          title="China, worked through: Chongqing"
          lede="The twist asked how firefighters in China could use this. Chongqing's 2022 mountain fires, and the law that followed, already have VoiceFlare's shape."
        >
          <ChinaExample />
        </Section>

        <Section
          id="maps"
          title="Maps: store WGS-84, convert only to draw"
          lede="Approved basemaps in mainland China (AMap, Tencent) use GCJ-02, a shifted datum, while phones report WGS-84. Draw raw GPS on a Chinese basemap and it lands about 100 to 700 m off. VoiceFlare stores WGS-84 always and converts only when it draws, so who is called first and which sentinels are asked are always worked out in one datum."
        >
          <GcjExplainer />
          <p className="mt-3 text-sm text-vf-smoke">
            Computed live by lib/geo-cn.ts. Public maps in China also need an approval number (
            <LocalText text="审图号" lang={PLACES.CN.script} />
            ); Tianditu uses CGCS2000.
          </p>
        </Section>

        <Section
          id="ladder"
          title="One ladder, six sets of words"
          lede="VoiceFlare stores six states. Each place has its own words for them, on the phone and on the board, and a named human approves every step up."
        >
          <LadderMatrix />
          <p className="mt-3 text-sm text-vf-smoke sm:hidden">Scroll the table sideways to see all six places.</p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-vf-smoke">
            In China a red warning is a hazard level, not an order. Moving people takes a separate relocation order (
            <LocalText text="转移指令" lang={PLACES.CN.script} />
            ), and VoiceFlare never promotes a red warning into one on its own: the human key matters more there, not less.
          </p>
        </Section>

        <Section
          id="more"
          title="Four more countries, already profiled"
          lede="The same six rules with each country's own number, decider and alert channel. Every profile lists its sources."
        >
          <ProfileCards />
        </Section>

        <Collections />
      </main>
      <Footer />
    </div>
  );
}
