// Dual-use, made visible: one system, two days. The brief asks for a second customer who uses it on an ordinary
// Tuesday, so the fire night and a hot Tuesday share one table: the decider, the moment, who gets called, and the
// same five rungs (watch, ask, slow, hold, hand to a person). The sameness is the layout. Below lg the day switch
// (DualUseSwitch, the only client island) shows one day at a time with the ladder fixed in place; from lg up both
// days sit side by side, rung by rung. Then the rules that never change and the other second customers. Both days
// are demos with synthetic residents. Rung colours match the ladder in Ladder.tsx.
import Link from "next/link";
import type { ReactNode } from "react";
import { DualUseSwitch, type Day, type DayTab } from "./DualUseSwitch";
import { Cta, PlayIcon, Route, Section, ShieldIcon } from "./ui";

type Pair = Record<Day, string>;

const TABS: readonly [DayTab, DayTab] = [
  { id: "fire", emoji: "🔥", label: "The fire night", tone: "#ff2a12" },
  { id: "tuesday", emoji: "🌡️", label: "An ordinary hot Tuesday", tone: "#fbbf24" },
];

const DAY: Record<Day, { emoji: string; label: string; kind: string; accent: string; sr: string; col: string }> = {
  fire: { emoji: "🔥", label: "The fire night", kind: "Crisis", accent: "text-vf-ember", sr: "On the fire night: ", col: "lg:col-start-3" },
  tuesday: { emoji: "🌡️", label: "An ordinary hot Tuesday", kind: "Every day", accent: "text-amber-400", sr: "On a hot Tuesday: ", col: "lg:col-start-4" },
};

/**
 * Below lg only the chosen day's cells show; after the first switch they fade in, a beat apart, as they reappear
 * (a CSS animation restarts when display leaves none). From lg up both show and nothing moves.
 */
const SWAP: Record<Day, string> = {
  fire: "max-lg:group-data-[day=tuesday]/dual:hidden max-lg:group-data-[switched=true]/dual:motion-safe:animate-[vf-rise_0.45s_cubic-bezier(0.22,1,0.36,1)_both] max-lg:group-data-[switched=true]/dual:motion-reduce:animate-[vf-fade_0.2s_ease-out_both]",
  tuesday: "max-lg:group-data-[day=fire]/dual:hidden max-lg:group-data-[switched=true]/dual:motion-safe:animate-[vf-rise_0.45s_cubic-bezier(0.22,1,0.36,1)_both] max-lg:group-data-[switched=true]/dual:motion-reduce:animate-[vf-fade_0.2s_ease-out_both]",
};

/** One column template for every row, so the rung numbers, the rung words and both days line up from top to bottom. */
const COLS = "grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 sm:gap-x-6 lg:grid-cols-[2.75rem_9.5rem_minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-6";

const SETUP: { label: string; text: Pair }[] = [
  {
    label: "The decider",
    text: {
      fire: "The overnight supervisor of an emergency call line.",
      tuesday: "A named person at a city or county heat check-in line for older residents.",
    },
  },
  {
    label: "The moment",
    text: {
      fire: "A wildfire at night, before an Evacuation Order wakes a zone.",
      tuesday: "A hot day, when a neighborhood gets a National Weather Service heat alert or its live temperature climbs.",
    },
  },
  {
    label: "Who gets called",
    text: {
      fire: "Sentinels at the zone’s edge, then the residents inside it.",
      tuesday: "Older residents who opted in. People who live alone or have no air conditioning go first.",
    },
  },
  {
    label: "The demo",
    text: {
      fire: "Westside LA, or the Norte Fire in San Clemente at its live location. Synthetic residents.",
      tuesday: "San Fernando Valley demo zones. Synthetic residents.",
    },
  },
];

const RUNGS: { word: string; tone: string; text: Pair }[] = [
  {
    word: "Watch",
    tone: "#a3a3ad",
    text: {
      fire: "Zones sit on the Cal OES ladder. A fire model proposes changes; only the supervisor can approve one.",
      tuesday: "Live temperatures and National Weather Service heat alerts, neighborhood by neighborhood.",
    },
  },
  {
    word: "Ask",
    tone: "#fbbf24",
    text: {
      fire: "Sentinels at the zone’s edge get a call: does this match what you see?",
      tuesday: "Seniors who opted in get a call: can you stay cool? Do you need water, a ride to a cooling center, or a visit?",
    },
  },
  {
    word: "Slow",
    tone: "#ff8a3d",
    text: {
      fire: "Calls go edge-first, in waves. The evacuation moves block by block: patches about half a mile (800 m) on a side, several per wave, on assigned exit roads, so the roads don’t jam.",
      tuesday: "Calls go in priority order, not all at once. A named person approves the heat message and the cooling-center list.",
    },
  },
  {
    word: "Hold",
    tone: "#ff2a12",
    text: {
      fire: "Before an Order, a 90-second hold shows how many phones it will wake. The hold can delay an alert, never stop one.",
      tuesday: "Nothing goes out until that person approves it.",
    },
  },
  {
    word: "Hand to a person",
    tone: "#f5f5f4",
    text: {
      fire: "From the help registry, with consent, a person’s live location goes to the response team and a helper goes to the exact spot. Pickup vans come for people who can’t leave.",
      tuesday: "A ride to a cooling center or a wellness visit, with the same helper flow as the fire night. Heat-stroke warning signs mean 911. No answer twice means the linked contact, then a door knock.",
    },
  },
];

const INVARIANTS = [
  "A named human decides. A model only proposes.",
  "The agent reads only the words that person approved.",
  "It never gives an ETA and never says anyone is safe.",
  "Silence is never treated as safe.",
  "Every decision goes in the ledger, with a name and a reason.",
];

const OTHERS: { emoji: string; name: string; text: string; link?: { href: string; label: string; internal?: boolean } }[] = [
  {
    emoji: "🪖",
    name: "Military bases",
    text: "Base mode has its own ladder: avoid, evacuate to the accountability point, lockdown, all clear.",
  },
  {
    emoji: "🖼️",
    name: "Galleries and archives",
    text: "The collections line offers help moving collections, only at Warning. It always ranks below people.",
    link: { href: "#collections", label: "How the collections line works" },
  },
  {
    emoji: "🌏",
    name: "Six jurisdictions",
    text: "US-California, China, Japan, Greece/EU, India and Australia.",
    link: { href: "/global", label: "Compare the six profiles", internal: true },
  },
];

const LINK =
  "text-[15px] font-semibold text-vf-bone underline decoration-vf-ember/60 underline-offset-4 transition-colors hover:text-vf-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember";

/** One day's text in a row. Below lg the tab names the day; from lg up a hidden prefix does, for screen readers. */
function DayCell({ day, order, as: Tag = "div", className = "", children }: { day: Day; order: number; as?: "div" | "dd"; className?: string; children: ReactNode }) {
  return (
    <Tag className={`${SWAP[day]} ${DAY[day].col} lg:row-start-1 lg:px-5 ${className}`} style={{ animationDelay: `${order * 50}ms` }}>
      <span className="max-lg:hidden lg:sr-only">{DAY[day].sr}</span>
      {children}
    </Tag>
  );
}

export function DualUse() {
  return (
    <Section
      id="dual-use"
      title="Dual-use: one system, two days"
      className="bg-vf-coal/70"
      lede="The brief asks for a second customer who uses it on an ordinary Tuesday: the engine and the rules that run a wildfire night also run a heat check-in line for older residents on a hot day."
    >
      <DualUseSwitch tabs={TABS} label="Pick a day">
        <p className="mt-4 text-sm leading-relaxed text-vf-smoke lg:hidden">Switch the day. The rungs stay in place; only the work on each one changes.</p>

        <div className="relative isolate mt-8 lg:mt-12">
          {/* The two day columns, tinted from top to bottom (wide screens only). */}
          <div aria-hidden="true" className={`pointer-events-none absolute inset-0 -z-10 hidden lg:grid ${COLS}`}>
            <div className="col-start-3 rounded-2xl border border-vf-flare/25 bg-[linear-gradient(180deg,rgba(255,42,18,0.11),rgba(255,42,18,0.025)_45%)]" />
            <div className="col-start-4 rounded-2xl border border-amber-400/25 bg-[linear-gradient(180deg,rgba(251,191,36,0.09),rgba(251,191,36,0.02)_45%)]" />
          </div>

          <div className={`hidden pb-5 pt-6 lg:grid ${COLS}`}>
            {(["fire", "tuesday"] as const).map((d) => (
              <div key={d} className={`${DAY[d].col} px-5`}>
                <p className={`text-sm font-semibold ${DAY[d].accent}`}>{DAY[d].kind}</p>
                <p className="mt-1 font-display text-2xl font-semibold leading-tight text-vf-bone">
                  <span aria-hidden="true" className="vf-emoji mr-2">
                    {DAY[d].emoji}
                  </span>
                  {DAY[d].label}
                </p>
              </div>
            ))}
          </div>

          <dl className="border-b border-white/10">
            {SETUP.map((row, r) => (
              <div key={row.label} className={`grid ${COLS} gap-y-1 border-t border-white/10 py-4`}>
                <dt className="col-span-2 text-sm font-semibold text-vf-smoke lg:pt-0.5">{row.label}</dt>
                {(["fire", "tuesday"] as const).map((d) => (
                  <DayCell key={d} day={d} order={r} as="dd" className="col-span-2 row-start-2 text-[15px] leading-relaxed text-vf-bone/90 lg:col-end-auto">
                    {row.text[d]}
                  </DayCell>
                ))}
              </div>
            ))}
          </dl>

          <p className="mb-6 mt-10 text-sm font-semibold text-vf-ember">The same five rungs</p>
          <ol>
            {RUNGS.map((rung, i) => {
              const next = RUNGS[i + 1];
              return (
                <li key={rung.word} className={`relative grid ${COLS} pb-8 lg:pb-10`}>
                  {next ? (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-[1.375rem] top-12 w-0.5 -translate-x-1/2 rounded-full opacity-60"
                      style={{ background: `linear-gradient(${rung.tone}, ${next.tone})` }}
                    />
                  ) : null}
                  <span
                    aria-hidden="true"
                    className="relative col-start-1 row-start-1 flex size-11 items-center justify-center rounded-full border-2 bg-vf-ink font-display text-lg font-semibold tabular-nums"
                    style={{ borderColor: rung.tone, color: rung.tone, boxShadow: `0 0 28px -8px ${rung.tone}` }}
                  >
                    {i + 1}
                  </span>
                  <h3 className="col-start-2 row-start-1 self-center font-display text-2xl font-semibold leading-tight tracking-[-0.01em] text-vf-bone lg:self-start lg:pt-1.5">
                    {rung.word}
                  </h3>
                  {(["fire", "tuesday"] as const).map((d) => (
                    <DayCell key={d} day={d} order={SETUP.length + i} className="col-start-2 row-start-2 mt-3 lg:mt-0 lg:pt-2">
                      <p className="max-w-[60ch] text-[16px] leading-relaxed text-vf-bone/90">{rung.text[d]}</p>
                    </DayCell>
                  ))}
                </li>
              );
            })}
          </ol>

          <div className="grid gap-8 border-t border-white/10 pt-8 sm:grid-cols-2 lg:grid-cols-[2.75rem_9.5rem_minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-6 lg:pb-8">
            <div className="lg:col-start-3 lg:px-5">
              <p className="text-sm font-semibold text-vf-bone">
                <span aria-hidden="true" className="vf-emoji mr-1.5">
                  🔥
                </span>
                Watch the fire night
              </p>
              <div className="mt-3">
                <Cta href="/board?autoplay=1" icon={<PlayIcon />}>
                  Play the full fire
                </Cta>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-vf-smoke">The Westside fire plays on the board by itself, with captions.</p>
            </div>
            <div className="lg:col-start-4 lg:px-5">
              <p className="text-sm font-semibold text-vf-bone">
                <span aria-hidden="true" className="vf-emoji mr-1.5">
                  🌡️
                </span>
                See the Tuesday
              </p>
              <div className="mt-3">
                <Cta href="/demo" variant="secondary">
                  Heat check-ins
                </Cta>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-vf-smoke">
                Opens <Route>/demo</Route>, where you load the heat scenario.
              </p>
            </div>
          </div>
        </div>
      </DualUseSwitch>

      <div className="mt-14 rounded-2xl border border-white/10 bg-vf-ink/70 p-6 sm:p-8">
        <h3 className="font-display text-xl font-semibold text-vf-bone">Same on both days</h3>
        <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
          {INVARIANTS.map((line) => (
            <li key={line} className="flex gap-2.5 text-[15px] leading-relaxed text-vf-bone/90">
              <ShieldIcon className="mt-1 text-vf-ember" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-12">
        <h3 className="font-display text-xl font-semibold text-vf-bone">Other second customers, same rules</h3>
        <ul className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
          {OTHERS.map((o) => (
            <li key={o.name} className="flex flex-col gap-2 bg-vf-ink p-5 sm:p-6">
              <span aria-hidden="true" className="vf-emoji text-3xl">
                {o.emoji}
              </span>
              <span className="mt-1 font-display text-lg font-semibold leading-snug text-vf-bone">{o.name}</span>
              <span className="text-[15px] leading-relaxed text-vf-smoke">{o.text}</span>
              {o.link ? (
                <span className="mt-auto pt-3">
                  {o.link.internal ? (
                    <Link href={o.link.href} className={LINK}>
                      {o.link.label}
                    </Link>
                  ) : (
                    <a href={o.link.href} className={LINK}>
                      {o.link.label}
                    </a>
                  )}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
