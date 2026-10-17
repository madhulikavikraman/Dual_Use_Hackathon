// The China worked example (PRD 17.2): the Chongqing mountain fires of August 2022, the 2026 regulation that followed,
// how it maps onto VoiceFlare, and the scenario that runs on the board. Facts from the CN profile and the PRD only.
import { Fragment } from "react";
import { JURISDICTIONS, localDirective } from "@/lib/jurisdictions";
import {
  CHINA_FIT,
  CHONGQING_2022,
  CHONGQING_REGULATION,
  CHONGQING_SCENARIO,
  PLACES,
  hostOf,
} from "./content";
import LoadChongqingButton from "./LoadChongqingButton";
import LocalText from "./LocalText";

const CN = JURISDICTIONS.CN;
const ZH = PLACES.CN.script;
/** The scenario's Xiema zone, named as lib/scenarios/chongqing.ts names it in the order it seeds. */
const XIEMA = "歇马街道虎头村一带";

/** The directive with the emergency number picked out in flare red. */
function Directive({ text }: { text: string }) {
  const parts = text.split(CN.call_now);
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <strong className="font-semibold text-vf-flare">{CN.call_now}</strong>}
          {p}
        </Fragment>
      ))}
    </>
  );
}

export default function ChinaExample() {
  const order = localDirective("CN", "order", XIEMA);
  return (
    <div className="space-y-12">
      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-vf-ash bg-vf-coal p-5 sm:p-6">
          <h3 className="font-display text-xl font-semibold text-vf-bone">The Beibei fire, August 2022</h3>
          <dl className="mt-4 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm leading-relaxed">
            {CHONGQING_2022.map((r) => (
              <Fragment key={r.term}>
                <dt className="font-display font-semibold text-vf-flare">{r.term}</dt>
                <dd className="text-vf-bone/90">{r.detail}</dd>
              </Fragment>
            ))}
          </dl>
        </article>
        <article className="rounded-2xl border border-vf-ash bg-vf-coal p-5 sm:p-6">
          <h3 className="font-display text-xl font-semibold text-vf-bone">Then the law changed</h3>
          <p className="mt-1 text-sm text-vf-smoke">Chongqing&apos;s Natural Disaster Evacuation Regulation, in force since Aug 1, 2026:</p>
          <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-vf-bone/90">
            {CHONGQING_REGULATION.map((r) => (
              <li key={r} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-vf-flare" />
                <span>
                  <LocalText text={r} lang={ZH} />
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <div>
        <h3 className="font-display text-2xl font-semibold text-vf-bone">VoiceFlare&apos;s shape, in China&apos;s own practice and law</h3>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-vf-smoke">
          A named decider, an acknowledged edge, and a linked contact for the person who cannot leave alone.
        </p>
        <ul className="mt-5 grid gap-4 md:grid-cols-3">
          {CHINA_FIT.map((f) => (
            <li key={f.voiceflare} className="flex flex-col rounded-2xl border border-vf-ash bg-vf-coal">
              <div className="p-5 pb-4">
                <p className="text-xs text-vf-smoke">In Chongqing</p>
                <p className="mt-1 text-sm leading-relaxed text-vf-bone">
                  <LocalText text={f.china} lang={ZH} />
                </p>
              </div>
              <div className="mt-auto border-t border-dashed border-vf-flare/40 p-5 pt-4">
                <p className="text-xs text-vf-smoke">In VoiceFlare</p>
                <p className="mt-1 font-display text-lg font-semibold text-vf-flare">{f.voiceflare}</p>
                <p className="mt-1 text-sm leading-relaxed text-vf-smoke">{f.how}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div>
          <h3 className="font-display text-2xl font-semibold text-vf-bone">The Chongqing scenario on the board</h3>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-vf-bone/90">
            {CHONGQING_SCENARIO.map((s) => (
              <li key={s} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-vf-bone/70" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <h4 className="mt-7 font-display text-base font-semibold text-vf-bone">Try it in 20 seconds</h4>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-vf-bone/90 marker:font-display marker:text-vf-flare">
            <li>Load the scenario with the button below.</li>
            <li>
              On the board, approve a Warning for Tiansheng (<span lang={ZH ?? undefined}>天生街道</span>).
            </li>
            <li>Calls go out with the Chinese directive and 119, and every decision lands in the ledger.</li>
          </ol>
          <div className="mt-6">
            <LoadChongqingButton />
          </div>
        </div>

        {order ? (
          <figure className="rounded-2xl border border-vf-ash bg-vf-ink p-5 sm:p-6">
            <figcaption className="text-xs text-vf-smoke">
              What Xiema hears first: the order as the call reads it, a demo paraphrase and not an official text
            </figcaption>
            <p className="mt-3 font-display text-lg font-semibold text-vf-bone">
              <LocalText text={CN.labels.order} lang={ZH} />
            </p>
            <blockquote lang={ZH ?? undefined} className="mt-2 text-lg leading-loose text-vf-bone">
              <p>
                <Directive text={order} />
              </p>
            </blockquote>
            <p className="mt-4 border-t border-vf-ash pt-4 text-sm leading-relaxed text-vf-smoke">
              English gloss: Beibei District government, emergency relocation notice. The mountain fire threatens the Hutou village
              area of Xiema. Everyone there, relocate now by the designated route and do not go back for belongings. For help, call
              119 or your village (community) officials.
            </p>
          </figure>
        ) : null}
      </div>

      {CN.sources.length ? (
        <p className="text-xs text-vf-smoke">
          Sources for the China profile:{" "}
          {CN.sources.map((s, i) => (
            <span key={s}>
              {i ? ", " : ""}
              <a
                href={s}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-vf-smoke/40 underline-offset-2 hover:text-vf-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember"
              >
                {hostOf(s)}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
