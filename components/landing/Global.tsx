// Same product, any country (Twist 2). The six jurisdiction profiles in lib/jurisdictions.ts, each shown by the one
// thing that most visibly changes, the words for an evacuation order and the number the call gives, then the six
// rules that never change beside the six adapters that do (docs/DEVPOST.md, PRD 17.2).
import { JURISDICTIONS, type Jurisdiction } from "@/lib/jurisdictions";
import { Cta, Section } from "./ui";

const STAYS = [
  "A named human approves every directive.",
  "The edge is asked first.",
  "The dose shows before the send, and the hold sends on time.",
  "The agent reads only approved text, and says it is an AI voice.",
  "A canary checks delivery.",
  "Every decision goes in the ledger.",
];

const CHANGES = [
  "The ladder words",
  "Who decides",
  "The emergency number",
  "The public channel, and how the dose is counted",
  "The voice platform and the AI model",
  "Privacy rules and maps",
];

/** The order label's language, when it is not plain English (so the browser picks the right CJK or Greek glyphs). */
function langOf(j: Jurisdiction): string | undefined {
  return Array.from(j.labels.order).some((c) => c.charCodeAt(0) > 127) ? j.languages[0] : undefined;
}

export function Global() {
  const places = Object.values(JURISDICTIONS);
  return (
    <Section
      id="global"
      title="Same product, any country"
      className="bg-vf-coal/70"
      lede={`Twist 2 asked how firefighters in China would run it. The 6 safety rules stay the same in every country, and 6 adapters change. Here is an evacuation order in each of the ${places.length} profiles, with the number the call tells people to ring.`}
    >
      <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
        {places.map((j) => (
          <li key={j.code} className="flex min-h-[11rem] flex-col justify-between gap-6 bg-vf-ink p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <span className="font-display text-sm font-semibold tracking-[0.06em] text-vf-smoke">{j.code}</span>
              <span className="text-right">
                <span className="block font-display text-[2rem] font-semibold leading-none tabular-nums text-vf-flare">{j.call_now}</span>
                <span className="mt-1 block text-xs text-vf-smoke">the call says</span>
              </span>
            </div>
            <div>
              <p lang={langOf(j)} className="text-balance font-display text-[1.35rem] font-medium leading-snug text-vf-bone">
                {j.labels.order}
              </p>
              <p className="mt-1.5 text-sm text-vf-smoke">{j.name}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-16">
        <div>
          <h3 className="font-display text-xl font-semibold text-vf-bone">Stays the same everywhere</h3>
          <ul className="mt-5 space-y-3">
            {STAYS.map((line) => (
              <li key={line} className="flex gap-3 text-[16px] leading-relaxed text-vf-bone/90">
                <span aria-hidden="true" className="mt-[0.55em] size-2 shrink-0 rotate-45 bg-vf-flare" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-display text-xl font-semibold text-vf-bone">Changes with the country</h3>
          <ul className="mt-5 space-y-3">
            {CHANGES.map((line) => (
              <li key={line} className="flex gap-3 text-[16px] leading-relaxed text-vf-smoke">
                <span aria-hidden="true" className="mt-[0.55em] size-2 shrink-0 rotate-45 border border-vf-smoke" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-12">
        <Cta href="/global" variant="secondary">
          Compare the {places.length} profiles side by side
        </Cta>
      </div>
    </Section>
  );
}
