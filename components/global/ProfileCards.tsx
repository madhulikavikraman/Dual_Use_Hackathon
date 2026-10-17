// Japan, Greece, India and Australia, rendered from their profiles in lib/jurisdictions.ts. Empty fields are left
// out rather than filled in. The order text is each profile's demo paraphrase, never an official text.
import type { ReactNode } from "react";
import { JURISDICTIONS } from "@/lib/jurisdictions";
import { PLACES, PROFILE_CODES, hostOf } from "./content";
import LocalText from "./LocalText";

function Field({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-vf-smoke">{term}</dt>
      <dd className="mt-0.5 text-vf-bone/90">{children}</dd>
    </div>
  );
}

export default function ProfileCards() {
  return (
    <ul className="grid gap-5 md:grid-cols-2">
      {PROFILE_CODES.map((code) => {
        const j = JURISDICTIONS[code];
        const place = PLACES[code];
        const lang = place.script;
        const order = j.directives.order ?? "";
        return (
          <li key={code} className="flex flex-col rounded-2xl border border-vf-ash bg-vf-coal p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-display text-xl font-semibold leading-tight text-vf-bone">{place.place}</h3>
                <p className="mt-0.5 text-sm text-vf-smoke">{j.name}</p>
              </div>
              {j.call_now ? (
                <p className="shrink-0 text-right">
                  <span className="block text-xs text-vf-smoke">The call says</span>
                  <span className="font-display text-4xl font-bold leading-none text-vf-flare">{j.call_now}</span>
                </p>
              ) : null}
            </div>

            <dl className="mt-5 space-y-3.5 text-sm leading-relaxed">
              {j.example ? (
                <Field term="Worked example">
                  <LocalText text={j.example} lang={lang} />
                </Field>
              ) : null}
              {j.decider ? (
                <Field term="Who approves">
                  <LocalText text={j.decider} lang={lang} />
                </Field>
              ) : null}
              {j.warning_system ? (
                <Field term="Warning system">
                  <LocalText text={j.warning_system} lang={lang} />
                </Field>
              ) : null}
              {j.emergency.note ? <Field term="Numbers">{j.emergency.note}</Field> : null}
              {j.adaptations.length ? (
                <Field term="What changes in VoiceFlare">
                  <ul className="mt-1 space-y-1.5">
                    {j.adaptations.map((a) => (
                      <li key={a} className="flex gap-2">
                        <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-vf-flare" />
                        <span>
                          <LocalText text={a} lang={lang} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </Field>
              ) : null}
            </dl>

            {order ? (
              <figure className="mt-5 rounded-xl border border-vf-ash bg-vf-ink p-4">
                <figcaption className="text-xs text-vf-smoke">
                  The order call, in {place.scriptName}: a demo paraphrase, not an official text
                </figcaption>
                <blockquote className="mt-2 text-[0.95rem] leading-relaxed text-vf-bone">
                  <p>
                    <LocalText text={order} lang={lang} />
                  </p>
                </blockquote>
              </figure>
            ) : null}

            {j.sources.length ? (
              <p className="mt-auto pt-5 text-xs text-vf-smoke">
                Sources:{" "}
                {j.sources.map((s, i) => (
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
          </li>
        );
      })}
    </ul>
  );
}
