// Second customers on an ordinary Tuesday (PRD section 16): campus, base and the collections line. Then the
// collections line itself, from lib/stories.ts (HERITAGE): its flow from enrolment to after the fire, each stage with
// its rule, and real cases once the research adds them (none are invented here). Lives first, always.
import { HERITAGE } from "@/lib/stories";
import { ExternalLink, Section, ShieldIcon, hostOf } from "./ui";

const CUSTOMERS: { id: string; who: string; mode: string; text: string; link?: { href: string; label: string } }[] = [
  {
    id: "campus",
    who: "USC Department of Public Safety",
    mode: "Campus mode",
    text: "Before a TrojansAlert, buildings and quads are the zones and the resident assistants and officers already on post are the sentinels. The words are avoid the area, shelter in place and all clear. A 20-second test call each month keeps the roster alive.",
  },
  {
    id: "base",
    who: "An installation’s command post",
    mode: "Base mode",
    text: "Before a base-wide lockdown, housing areas, gates and the flight line are the zones, and gate posts and housing phones are the sentinels. The registry speaks personnel accountability (ADPAAS, NFAAS, AFPAAS): accounted and unaccounted.",
  },
  {
    id: "collections",
    who: "Museums, libraries, archives and collectors",
    mode: HERITAGE.name || "Collections line",
    text: "They enroll, keep a short grab list of what to save first and answer a monthly test call. When a warning comes, they can ask for help moving it while there is still time. Lives first, always.",
    link: { href: "#collections", label: "How the collections line works" },
  },
];

/** Stage colours follow the board's zone states: an ordinary day, a warning, an order, after. */
const STAGE_TONE = ["#4ade80", "#f97316", "#ff2a12", "#a3a3ad"];

export function Tuesday() {
  return (
    <Section
      id="tuesday"
      title="On an ordinary Tuesday"
      lede="People at the edge only answer on the bad night if the line is part of ordinary days. The same screen serves 3 customers between emergencies."
    >
      <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
        {CUSTOMERS.map((c) => (
          <li key={c.id} className="flex flex-col bg-vf-ink p-6 sm:p-7">
            <p className="text-sm text-vf-ember">{c.mode}</p>
            <h3 className="mt-2 font-display text-xl font-semibold leading-snug text-vf-bone">{c.who}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-vf-smoke">{c.text}</p>
            {c.link ? (
              <p className="mt-auto pt-5">
                <a
                  href={c.link.href}
                  className="text-[15px] font-semibold text-vf-bone underline decoration-vf-ember/60 underline-offset-4 transition-colors hover:text-vf-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember"
                >
                  {c.link.label}
                </a>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Collections() {
  const { flow, stories } = HERITAGE;
  if (!HERITAGE.one_liner && flow.length === 0 && stories.length === 0) return null;
  return (
    <section id="collections" aria-labelledby="collections-title" className="relative isolate scroll-mt-16 overflow-hidden pb-24 pt-4 sm:pb-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-64 top-0 -z-10 size-[720px] rounded-full bg-[radial-gradient(closest-side,rgba(255,107,61,0.12),transparent)]"
      />
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-vf-ember/25 bg-[linear-gradient(160deg,rgba(255,107,61,0.08),rgba(14,14,17,0.9)_45%)] p-6 sm:p-10 lg:p-12">
          <h2
            id="collections-title"
            className="font-display text-[clamp(1.9rem,1.35rem+2vw,3rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-vf-bone"
          >
            {HERITAGE.name || "Collections line"}
          </h2>
          {HERITAGE.one_liner ? <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-vf-bone/90">{HERITAGE.one_liner}</p> : null}
          <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-vf-smoke">
            For a gallery, a library, an archive or a private collection in the path of fire, flood or storm: the same calls, the
            same human approval, and a place in the queue that always comes after people.
          </p>

          {flow.length > 0 ? (
            <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {flow.map((f, i) => (
                <li key={f.stage} className="border-t-2 pt-5" style={{ borderColor: STAGE_TONE[i] ?? STAGE_TONE[STAGE_TONE.length - 1] }}>
                  <p className="font-display text-sm font-semibold tabular-nums text-vf-smoke">{i + 1}</p>
                  <h3 className="mt-1 font-display text-xl font-semibold text-vf-bone">{f.stage}</h3>
                  {f.what_happens ? <p className="mt-2 text-[15px] leading-relaxed text-vf-smoke">{f.what_happens}</p> : null}
                  {f.rule ? (
                    <p className="mt-4 flex gap-2 text-sm leading-relaxed text-vf-bone/90">
                      <ShieldIcon className="mt-0.5 text-vf-ember" />
                      <span>
                        <span className="sr-only">Rule: </span>
                        {f.rule}
                      </span>
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}

          {stories.length > 0 ? (
            <div className="mt-14">
              <h3 className="font-display text-2xl font-semibold text-vf-bone">Real cases, with sources</h3>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {stories.map((s) => (
                  <article key={s.id} aria-labelledby={`heritage-${s.id}`} className="rounded-xl border border-white/10 bg-vf-ink/70 p-6">
                    {s.when || s.where ? <p className="text-sm text-vf-ember">{[s.when, s.where].filter(Boolean).join(", ")}</p> : null}
                    <h4 id={`heritage-${s.id}`} className="mt-1 font-display text-xl font-semibold leading-snug text-vf-bone">
                      {s.title}
                    </h4>
                    {s.what_happened ? <p className="mt-3 text-[15px] leading-relaxed text-vf-smoke">{s.what_happened}</p> : null}
                    {s.what_voiceflare_changes ? (
                      <p className="mt-3 text-[15px] leading-relaxed text-vf-bone/90">
                        <span className="font-semibold text-vf-bone">With VoiceFlare: </span>
                        {s.what_voiceflare_changes}
                      </p>
                    ) : null}
                    {s.source_url ? (
                      <p className="mt-4 text-sm text-vf-bone/85">
                        <ExternalLink href={s.source_url}>{hostOf(s.source_url)}</ExternalLink>
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
