// The Demo Day poster (Twist 3), 24 x 36 in portrait = 2304 x 3456 CSS px. Real incidents come from lib/stories.ts
// and country profiles from lib/jurisdictions.ts, so the poster updates when the research lands; empty parts hide.
// Product facts and measured results are the team's own (scripts/e2e.ts). Everything in the demo is simulated.
import Image from "next/image";
import { FIRES, HERITAGE, LIVE, STATS, type FireStory, type LiveIncident, type Stat } from "@/lib/stories";
import { JURISDICTIONS } from "@/lib/jurisdictions";
import { FitBox } from "./FitBox";
import { Arcs, Chip, QrCode, Section, SectionHead, host } from "./primitives";

const REPO = "https://github.com/madhulikavikraman/Dual_Use_Hackathon";

const POSTER_CSS = `
@page { size: 24in 36in; margin: 0; }
@page vfposter { size: 24in 36in; margin: 0; }
html, body { margin: 0 !important; padding: 0 !important; background: #050505 !important; }
.vf-poster { page: vfposter; width: 2304px; height: 3456px; overflow: hidden; position: relative;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.vf-poster * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
nextjs-portal { display: none !important; }
@media print {
  html, body { width: 24in !important; height: 36in !important; min-height: 0 !important; overflow: hidden !important; }
}
`;

export function Poster() {
  return (
    <div className="vf-poster bg-vf-ink font-sans text-vf-bone">
      <style dangerouslySetInnerHTML={{ __html: POSTER_CSS }} />
      <Backdrop />
      <FitBox>
        <div className="flex min-h-[3456px] w-[2304px] flex-col gap-[16px] px-[60px] pb-[36px] pt-[40px]">
          <Header />
          <Problem />
          <div className="grid flex-1 grid-cols-2 gap-[16px]">
            <div className="flex flex-col gap-[16px]">
              <Ladder />
              <Call />
              <Global />
              <WhoPays />
            </div>
            <div className="flex flex-col gap-[16px]">
              <Board />
              <FailsSafe />
              <Collections />
              <Results />
            </div>
          </div>
          <Footer />
        </div>
      </FitBox>
    </div>
  );
}

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute left-[-440px] top-[-600px] h-[1400px] w-[1400px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,42,18,0.30) 0%, rgba(255,42,18,0.09) 38%, rgba(5,5,5,0) 68%)" }}
      />
      <Arcs className="absolute right-[-240px] top-[-190px] w-[1350px] text-vf-flare opacity-[0.09]" rings={5} stroke={5} dot={false} />
      <div
        className="absolute bottom-[-620px] right-[-520px] h-[1500px] w-[1500px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,107,61,0.15) 0%, rgba(5,5,5,0) 64%)" }}
      />
      <div className="absolute inset-x-0 top-0 h-[12px]" style={{ background: "linear-gradient(90deg,#a8120a,#ff2a12 55%,#ff6b3d)" }} />
      <div className="absolute inset-x-0 bottom-0 h-[12px]" style={{ background: "linear-gradient(90deg,#ff6b3d,#ff2a12 45%,#a8120a)" }} />
    </div>
  );
}

/* 1. Logo and the one-line promise ---------------------------------------------------------------------------- */

function Header() {
  return (
    <header className="grid grid-cols-[400px_minmax(0,1fr)] items-center gap-[52px]">
      <Image
        src="/brand/voiceflare-logo-transparent.png"
        alt="VoiceFlare"
        width={989}
        height={666}
        unoptimized
        loading="eager"
        className="h-auto w-[400px]"
      />
      <div>
        <p className="font-mono text-[24px] uppercase tracking-[0.16em] text-vf-ember">
          USC Viterbi × InnovateLA Dual-Use Hackathon · Resilience Comms · Sponsor: Retell AI
        </p>
        <h1 className="mt-[4px] font-display text-[136px] font-bold leading-[0.95] tracking-[-0.015em]">
          Ask before you <span className="text-vf-flare">wake a city.</span>
        </h1>
        <p className="mt-[14px] text-[34px] leading-[1.26] text-vf-bone/90">
          Before an automated alert wakes a zone, VoiceFlare asks the people at its edge, shows how many phones it will
          wake, holds it for a named human, then calls every resident in their own language.
        </p>
      </div>
    </header>
  );
}

/* 2. The problem (FIRES, LIVE, STATS from lib/stories.ts) ----------------------------------------------------- */

function Problem() {
  if (!LIVE && FIRES.length === 0 && STATS.length === 0) return null;
  const compact = FIRES.length > 2;
  return (
    <Section n="01" title="The problem" kicker="Real alerts · real fires · sourced">
      {LIVE ? <LiveBanner live={LIVE} /> : null}
      {STATS.length > 0 ? (
        <div
          className="mb-[14px] grid gap-[14px]"
          style={{ gridTemplateColumns: `repeat(${Math.min(STATS.length, 4)}, minmax(0, 1fr))` }}
        >
          {STATS.map((s) => (
            <StatTile key={`${s.value}-${s.label}`} stat={s} />
          ))}
        </div>
      ) : null}
      {FIRES.length > 0 ? (
        <div className="grid gap-[14px]" style={{ gridTemplateColumns: `repeat(${Math.min(FIRES.length, 3)}, minmax(0, 1fr))` }}>
          {FIRES.map((f) => (
            <FireCard key={f.id} fire={f} compact={compact} />
          ))}
        </div>
      ) : null}
    </Section>
  );
}

function LiveBanner({ live }: { live: LiveIncident }) {
  const sources = live.links.map(host).join(" · ");
  const detail = [live.place, live.alert_notes].filter(Boolean).join(". ");
  return (
    <div className="mb-[14px] flex items-start gap-[20px] rounded-[18px] border-2 border-vf-flare/70 bg-vf-flare/10 px-[22px] py-[10px]">
      <span className="mt-[4px] shrink-0 rounded-full bg-vf-flare px-[16px] py-[3px] font-mono text-[24px] font-bold uppercase tracking-[0.14em] text-vf-ink">
        Live
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-[18px]">
          <p className="font-display text-[36px] font-bold leading-[1.1]">
            {live.name}
            {live.status_line ? <span className="text-vf-flare"> · {live.status_line}</span> : null}
          </p>
          <p className="ml-auto shrink-0 font-mono text-[20px] text-vf-smoke">
            As of {live.as_of}
            {sources ? ` · ${sources}` : ""}
          </p>
        </div>
        {detail ? <p className="mt-[2px] line-clamp-2 text-[28px] leading-[1.25] text-vf-bone/85">{detail}</p> : null}
      </div>
    </div>
  );
}

function StatTile({ stat }: { stat: Stat }) {
  return (
    <div className="flex flex-col rounded-[18px] border-2 border-vf-ash bg-vf-ink/75 px-[22px] py-[12px]">
      <p className="whitespace-nowrap font-display text-[64px] font-bold leading-none text-vf-flare">{stat.value}</p>
      <p className="mt-[6px] text-[27px] leading-[1.22] text-vf-bone/90">{stat.label}</p>
      {stat.source ? <p className="mt-auto truncate pt-[4px] font-mono text-[18px] text-vf-smoke/80">{host(stat.source)}</p> : null}
    </div>
  );
}

function FireCard({ fire, compact }: { fire: FireStory; compact: boolean }) {
  const wrong = compact ? fire.what_went_wrong.slice(0, 1) : fire.what_went_wrong;
  return (
    <article className="flex flex-col rounded-[18px] border-2 border-vf-flare/25 bg-vf-ink/75 px-[22px] py-[14px]">
      <p className="font-mono text-[20px] uppercase tracking-[0.1em] text-vf-ember">
        {fire.when} · {fire.where}
      </p>
      <h3 className="mt-[4px] font-display text-[36px] font-bold leading-[1.05]">{fire.name}</h3>
      {fire.damage ? <p className="mt-[4px] text-[26px] font-semibold leading-[1.2] text-vf-flare">{fire.damage}</p> : null}
      <ul className="mt-[8px] space-y-[6px]">
        {wrong.map((w) => (
          <li key={w} className="flex gap-[12px] text-[28px] leading-[1.25] text-vf-bone/90">
            <span className="mt-[16px] h-[4px] w-[16px] shrink-0 bg-vf-flare" />
            <span>{w}</span>
          </li>
        ))}
      </ul>
      {fire.voiceflare.length > 0 ? (
        <div className="mt-auto flex flex-wrap items-center gap-[6px] pt-[10px]">
          <span className="mr-[2px] font-mono text-[19px] uppercase tracking-[0.12em] text-vf-smoke">VoiceFlare →</span>
          {fire.voiceflare.map((v) => (
            <span
              key={String(v.feature)}
              className="rounded-full border-2 border-vf-flare/60 bg-vf-flare/10 px-[12px] py-[1px] text-[23px] leading-[1.25]"
            >
              {v.feature}
            </span>
          ))}
        </div>
      ) : null}
      {fire.limits && !compact ? (
        <p className="mt-[8px] text-[24px] italic leading-[1.25] text-vf-smoke">{fire.limits}</p>
      ) : null}
      {fire.sources.length > 0 ? (
        <p className="truncate pt-[6px] font-mono text-[17px] text-vf-smoke/75">{fire.sources.map(host).join(" · ")}</p>
      ) : null}
    </article>
  );
}

/* 3. The ladder: how it works ---------------------------------------------------------------------------------- */

const RUNGS: { word: string; text: string }[] = [
  { word: "Watch", text: "Feeds and models only propose." },
  { word: "Ask", text: "Sentinels at the edge: does this match what you see?" },
  { word: "Slow", text: "Show the dose: the wrong countywide polygon wakes about 9.8 million phones; Culver City and Palms, 41,000." },
  { word: "Hold", text: "An Order waits 90 s: Send · Hold once · Edit polygon · Cancel · Hand off. No decision? It sends on time." },
  { word: "Hand to a person", text: "A named human approves; silence becomes a door knock." },
];

function Ladder() {
  return (
    <Section n="02" title="The ladder" kicker="How it works">
      <ol className="relative space-y-[10px]">
        <span aria-hidden className="absolute bottom-[26px] left-[21px] top-[22px] w-[4px] bg-vf-flare/45" />
        {RUNGS.map((r, i) => (
          <li key={r.word} className="relative flex gap-[18px]">
            <span className="relative z-10 grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full border-[3px] border-vf-flare bg-vf-ink font-mono text-[24px] font-bold text-vf-flare">
              {i + 1}
            </span>
            <p className="min-w-0 text-[30px] leading-[1.26] text-vf-bone/90">
              <span className="mr-[12px] font-display text-[38px] font-bold uppercase leading-none text-vf-flare">
                {r.word}
              </span>
              {r.text}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* 4. The board ------------------------------------------------------------------------------------------------- */

function Board() {
  return (
    <figure className="flex flex-col rounded-[26px] border border-vf-ash bg-vf-coal/85 px-[22px] pb-[18px] pt-[18px]">
      <SectionHead n="03" title="The supervisor's board" kicker="Demo · simulated" />
      <div className="relative overflow-hidden rounded-[14px] border-2 border-vf-ash">
        <Image
          src="/poster/board.png"
          alt="The VoiceFlare supervisor's board during the Westside demo"
          width={3840}
          height={2160}
          unoptimized
          loading="eager"
          className="block h-auto w-full"
        />
        <span className="absolute bottom-[1.1%] left-[0.6%] rounded-[8px] bg-vf-ink px-[12px] py-[4px] font-mono text-[18px] uppercase tracking-[0.12em] text-vf-ember">
          Simulated · synthetic residents
        </span>
      </div>
      <figcaption className="mt-[12px] text-[30px] leading-[1.26] text-vf-bone/85">
        Nobody decided within 90 s, so the Order sent on time, its dose (about 9.8 million phones, wrong polygon) and the
        sentinels&apos; disputed read on record. Canaries ring; calls run in Spanish, French, Tagalog, Chinese.
      </figcaption>
    </figure>
  );
}

/* 5. One call in any language ---------------------------------------------------------------------------------- */

const LANGS = ["English", "Español", "한국어", "普通话", "हिन्दी", "Français", "Հայերեն", "Filipino"];

function Call() {
  return (
    <Section n="04" title="One call, any language" kicker="Retell AI + Claude">
      <p className="text-[30px] leading-[1.26] text-vf-bone/90">
        Retell AI carries the voice on the phone network; Claude is the agent. It reads only the human-approved directive,
        route and shelter, in the person&apos;s language, and says it is an automated voice.
      </p>
      <div className="mt-[10px] flex flex-wrap gap-[8px]">
        {LANGS.map((l) => (
          <Chip key={l}>{l}</Chip>
        ))}
      </div>
      <div className="mt-[12px] rounded-[18px] border-2 border-vf-flare/50 bg-vf-ink/80 px-[22px] py-[10px]">
        <p className="font-mono text-[20px] uppercase tracking-[0.14em] text-vf-ember">Live Claude call · Mandarin</p>
        <p className="mt-[2px] text-[30px] leading-[1.26]">It read the Chinese directive word for word, then filed:</p>
        <p className="mt-[4px] font-display text-[40px] font-bold leading-[1.1] text-vf-flare">
          “needs help leaving: wheelchair, no car”
        </p>
      </div>
    </Section>
  );
}

/* 6. Fails safe ------------------------------------------------------------------------------------------------ */

const REGISTRY = [
  { p: "P1", label: "needs help now" },
  { p: "P2", label: "needs help leaving" },
  { p: "P3", label: "unreached" },
  { p: "P4", label: "salvage" },
];

function FailsSafe() {
  const rows: { k: string; v: string }[] = [
    { k: "Hold", v: "Capped at 90 s; it never blocks a send." },
    { k: "Canary", v: "A phone inside and one outside the polygon check delivery." },
    { k: "Silence", v: "No answer → retry → named linked contact → door-knock row." },
  ];
  return (
    <Section n="05" title="Fails safe" kicker="Silence is a signal">
      <ul className="space-y-[6px]">
        {rows.map((r) => (
          <li key={r.k} className="text-[30px] leading-[1.26] text-vf-bone/90">
            <span className="mr-[12px] font-display text-[32px] font-bold uppercase text-vf-flare">{r.k}</span>
            {r.v}
          </li>
        ))}
      </ul>
      <p className="mt-[10px] font-mono text-[20px] uppercase tracking-[0.14em] text-vf-ember">
        Help registry → quick response team
      </p>
      <div className="mt-[6px] grid grid-cols-4 gap-[8px]">
        {REGISTRY.map((r, i) => (
          <div
            key={r.p}
            className="rounded-[14px] border-2 px-[14px] py-[8px]"
            style={{ borderColor: `rgba(255,42,18,${0.95 - i * 0.22})`, background: `rgba(255,42,18,${0.2 - i * 0.045})` }}
          >
            <p className="font-display text-[36px] font-bold leading-none">{r.p}</p>
            <p className="mt-[2px] text-[26px] leading-[1.1] text-vf-bone/90">{r.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-[10px] text-[30px] leading-[1.26] text-vf-bone/90">
        <span className="mr-[12px] font-display text-[32px] font-bold uppercase text-vf-flare">Ledger</span>
        Every human decision with a name and a reason, and every AI refusal.
      </p>
    </Section>
  );
}

/* 7. Global (Twist 2) ------------------------------------------------------------------------------------------ */

const ADAPTERS = [
  "Ladder words",
  "Decider",
  "Emergency number",
  "Public channel + dose source",
  "Voice platform + AI model",
  "Privacy + maps",
];
const CHONGQING = [
  "Colour warnings are hazard levels; only a relocation order (转移指令) moves people. A red warning is never auto-promoted.",
  "Calls say 119. The dose counts 12379 and carrier SMS audiences.",
  "Sentinels are the grid workers China already asks to acknowledge (叫应).",
  "A CAC-filed domestic model sits behind the same seven tools (no Claude in mainland China). PIPL consent; GCJ-02 maps.",
];

function Global() {
  const places = Object.values(JURISDICTIONS);
  return (
    <Section n="06" title="Make it global" kicker="Twist 2">
      <div className="flex flex-wrap items-center gap-[8px]">
        <span className="mr-[4px] text-[30px] leading-[1.26] text-vf-bone/90">Six invariants stay; six adapters change:</span>
        {ADAPTERS.map((a) => (
          <Chip key={a} tone="flare">
            {a}
          </Chip>
        ))}
      </div>
      <div className="mt-[12px] rounded-[18px] border-2 border-vf-flare/40 bg-vf-ink/80 px-[22px] py-[10px]">
        <p className="font-display text-[32px] font-bold leading-[1.1]">
          Chongqing, China <span className="text-vf-smoke">· the August 2022 Beibei fire ground</span>
        </p>
        <ul className="mt-[6px] space-y-[4px]">
          {CHONGQING.map((c) => (
            <li key={c} className="flex gap-[12px] text-[30px] leading-[1.24] text-vf-bone/90">
              <span className="mt-[16px] h-[4px] w-[16px] shrink-0 bg-vf-flare" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-[10px] flex flex-wrap items-center gap-[8px]">
        <span className="mr-[2px] font-mono text-[20px] uppercase tracking-[0.12em] text-vf-smoke">Profiled</span>
        {places.map((j) => (
          <Chip key={j.code}>
            {j.name.split(",")[0]}
            <span className="ml-[10px] font-mono font-bold text-vf-flare">{j.call_now}</span>
          </Chip>
        ))}
      </div>
    </Section>
  );
}

/* 8. Collections line (HERITAGE from lib/stories.ts) ----------------------------------------------------------- */

function Collections() {
  return (
    <Section n="07" title={HERITAGE.name} kicker="Lives first, always">
      <p className="text-[30px] leading-[1.26] text-vf-bone/90">{HERITAGE.one_liner}</p>
      {HERITAGE.stories.length > 0 ? (
        <div className="mt-[10px] space-y-[8px]">
          {HERITAGE.stories.slice(0, 2).map((s) => (
            <div key={s.id} className="rounded-[16px] border-2 border-vf-ash bg-vf-ink/70 px-[18px] py-[8px]">
              <p className="font-display text-[28px] font-bold leading-[1.15]">
                {s.title} <span className="text-vf-smoke">· {s.where} · {s.when}</span>
              </p>
              <p className="mt-[2px] line-clamp-2 text-[28px] leading-[1.24] text-vf-bone/90">{s.what_happened}</p>
              {s.source_url ? <p className="font-mono text-[17px] text-vf-smoke/80">{host(s.source_url)}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      {HERITAGE.flow.length > 0 ? (
        <ol className="mt-[10px] space-y-[4px]">
          {HERITAGE.flow.map((f) => (
            <li key={f.stage} className="text-[30px] leading-[1.26] text-vf-bone/90">
              <span className="mr-[12px] font-display text-[30px] font-bold uppercase text-vf-flare">{f.stage}</span>
              {f.rule}
            </li>
          ))}
        </ol>
      ) : null}
    </Section>
  );
}

/* 9. Who pays (Twist 1) and second customers ------------------------------------------------------------------- */

function WhoPays() {
  return (
    <Section n="08" title="Who pays" kicker="Twist 1 · federal" className="flex-1">
      <div className="flex items-baseline gap-[18px] rounded-[18px] border-2 border-vf-flare/50 bg-vf-flare/10 px-[22px] py-[8px]">
        <p className="whitespace-nowrap font-display text-[40px] font-bold leading-[1.1]">NSF SBIR Phase I</p>
        <p className="font-mono text-[23px] text-vf-ember">NSF 26-510 · up to $305,000 · no equity</p>
      </div>
      <ul className="mt-[8px] space-y-[4px] text-[30px] leading-[1.26] text-vf-bone/90">
        <li>
          Customers buy with <b>FEMA UASI</b> and <b>EMPG</b> grants: public alert and warning systems are on FEMA&apos;s
          Authorized Equipment List.
        </li>
        <li>
          <b>DoD SBIR</b> and <b>DIU</b> for military installations.{" "}
          <span className="font-mono text-vf-ember">/evidence</span> measures the Phase I milestones live.
        </li>
      </ul>
      <p className="mt-[10px] font-mono text-[20px] uppercase tracking-[0.12em] text-vf-smoke">
        Second customers, on an ordinary Tuesday
      </p>
      <ul className="mt-[2px] space-y-[2px] text-[30px] leading-[1.26]">
        <li>
          <span className="font-semibold text-vf-flare">USC Department of Public Safety</span> · campus mode, monthly
          test calls
        </li>
        <li>
          <span className="font-semibold text-vf-flare">A military installation&apos;s command post</span> · base mode
        </li>
        <li>
          <span className="font-semibold text-vf-flare">{HERITAGE.name}</span> · museums, libraries, archives, galleries,
          collectors
        </li>
      </ul>
    </Section>
  );
}

/* 10. Results (measured in scripts/e2e.ts) --------------------------------------------------------------------- */

function Results() {
  const tiles = [
    { big: "20/20", small: "end-to-end checks pass" },
    { big: "9.8M→41K", small: "phones, after Edit polygon (8.4 sq mi)" },
    { big: "46 s", small: "quorum read (target <90 s)" },
    { big: "30 s", small: "canary clear" },
  ];
  const checks = [
    "Rings went out edge-first",
    "The needs-help caller surfaced at priority 1",
    "An older man who did not answer was accounted for through his linked contact",
  ];
  return (
    <Section n="09" title="Results" kicker="Measured · scripts/e2e.ts" className="flex-1">
      <div className="grid grid-cols-[0.8fr_1.3fr_0.9fr_0.8fr] gap-[8px]">
        {tiles.map((t) => (
          <div key={t.big} className="rounded-[16px] border-2 border-vf-ash bg-vf-ink/80 px-[14px] py-[10px]">
            <p className="whitespace-nowrap font-display text-[46px] font-bold leading-none text-vf-flare">{t.big}</p>
            <p className="mt-[4px] text-[24px] leading-[1.15] text-vf-bone/90">{t.small}</p>
          </div>
        ))}
      </div>
      <ul className="mt-[10px] space-y-[2px]">
        {checks.map((c) => (
          <li key={c} className="flex gap-[12px] text-[30px] leading-[1.26]">
            <span className="font-bold text-vf-flare">✓</span>
            {c}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* 11-12. Responsible use and footer ---------------------------------------------------------------------------- */

function Footer() {
  return (
    <footer className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[32px] rounded-[26px] border-2 border-vf-flare/45 bg-vf-coal/90 px-[28px] py-[16px]">
      <div className="min-w-0">
        <p className="font-mono text-[22px] uppercase tracking-[0.16em] text-vf-ember">Responsible use</p>
        <p className="mt-[4px] text-[30px] leading-[1.26]">
          The agent reads only the directive a named human approved for the zone and can change nothing else. The hold is
          capped and never blocks a send.
        </p>
        <p className="text-[30px] leading-[1.26]">
          Every refusal and decision is in a ledger. The registry is visible only to the response team and purged 72 hours
          after the incident closes.
        </p>
        <p className="mt-[8px] text-[23px] leading-[1.3] text-vf-smoke">
          Built with Claude (Haiku 5.5 in call, Sonnet 5.5 post-call), Retell AI, Next.js, Leaflet · Everything in the
          demo is simulated: residents are synthetic except six volunteer phones, and nothing reaches a real alert system.
        </p>
      </div>
      <div className="flex items-center gap-[20px]">
        <div className="text-right">
          <Image
            src="/brand/voiceflare-wordmark.png"
            alt="VoiceFlare"
            width={941}
            height={94}
            unoptimized
            loading="eager"
            className="ml-auto h-auto w-[300px]"
          />
          <p className="mt-[10px] font-mono text-[19px] leading-[1.3] text-vf-smoke">
            github.com/madhulikavikraman
            <br />
            /Dual_Use_Hackathon
          </p>
        </div>
        <QrCode value={REPO} className="h-[180px] w-[180px] shrink-0 overflow-hidden rounded-[10px]" />
      </div>
    </footer>
  );
}
