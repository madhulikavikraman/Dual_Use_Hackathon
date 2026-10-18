// One country's flood profile, rendered from lib/floods.ts: the official warning levels and order words (local
// script tagged with its language), who decides, the public channel, the number, the sentinels, one recent flood
// lesson, and VoiceFlare's ladder there. Every block ends with its sources. Used inside the client country switch.
import type { CSSProperties, ReactNode } from "react";
import { JURISDICTIONS } from "@/lib/jurisdictions";
import { FLOOD_LADDER, ORDER_STEPS, type FloodProfile, type Sourced, type Term, type WarningProduct } from "@/lib/floods";
import LocalText from "@/components/global/LocalText";
import { SWATCH, SourceLinks } from "./ui";

function Block({ emoji, title, children }: { emoji: string; title: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h4 className="flex items-center gap-2 font-display text-lg font-semibold text-vf-bone">
        <span aria-hidden="true" className="text-base">
          {emoji}
        </span>
        {title}
      </h4>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A level mark that fills like a gauge: higher levels stand taller. Colour-coded levels show their colour. */
function LevelMark({ i, n, swatch }: { i: number; n: number; swatch?: Term["swatch"] }) {
  const height = `${Math.round(((i + 1) / n) * 100)}%`;
  return (
    <span aria-hidden="true" className="mt-0.5 flex h-6 w-2.5 shrink-0 items-end overflow-hidden rounded-sm bg-vf-ash">
      <span
        className="vff-level block w-full rounded-sm"
        style={{ height, background: swatch ? SWATCH[swatch] : "var(--vff-water)", "--vff-i": i } as CSSProperties}
      />
    </span>
  );
}

function TermText({ t, lang }: { t: Term; lang: string | null }) {
  const tag = t.lang ?? lang ?? undefined;
  return (
    <span className="min-w-0">
      {t.local ? (
        <span lang={tag} className="block font-display text-[0.95rem] font-semibold leading-snug text-vf-bone">
          {t.local}
        </span>
      ) : null}
      <span className={t.local ? "block text-sm text-vf-smoke" : "block font-display text-[0.95rem] font-semibold leading-snug text-vf-bone"}>
        {t.en}
      </span>
      {t.note ? (
        <span className="block text-sm leading-relaxed text-vf-smoke">
          <LocalText text={t.note} lang={lang} />
        </span>
      ) : null}
    </span>
  );
}

function Product({ w, lang }: { w: WarningProduct; lang: string | null }) {
  const n = w.levels.length;
  return (
    <div className="rounded-xl border border-vf-ash bg-vf-ink/60 p-4">
      <h5 className="font-display text-[0.95rem] font-semibold text-vf-bone">
        <LocalText text={w.name} lang={lang} />
      </h5>
      <p className="mt-0.5 text-xs leading-relaxed text-vf-smoke">
        <LocalText text={w.issuer} lang={lang} />
      </p>
      {n ? (
        <>
          {n > 1 ? <p className="mt-3 text-[0.7rem] font-medium uppercase tracking-[0.08em] text-vf-smoke">Lowest to highest</p> : null}
          <ol className={`${n > 1 ? "mt-1.5" : "mt-3"} space-y-2`}>
            {w.levels.map((t, i) => (
              <li key={`${t.local ?? ""}${t.en}`} className="flex gap-3">
                <LevelMark i={i} n={n} swatch={t.swatch} />
                <TermText t={t} lang={lang} />
              </li>
            ))}
          </ol>
        </>
      ) : null}
      {w.note ? (
        <p className="mt-3 text-sm leading-relaxed text-vf-bone/85">
          <LocalText text={w.note} lang={lang} />
        </p>
      ) : null}
      <SourceLinks src={w.src} className="mt-2" />
    </div>
  );
}

function SourcedText({ s, lang, className = "" }: { s: Sourced; lang: string | null; className?: string }) {
  return (
    <div className={className}>
      <p className="text-sm leading-relaxed text-vf-bone/90">
        <LocalText text={s.text} lang={lang} />
      </p>
      <SourceLinks src={s.src} className="mt-1" />
    </div>
  );
}

function Emergency({ p }: { p: FloodProfile }) {
  const e = p.emergency;
  const others = e.others || (e.fromProfile ? JURISDICTIONS[p.code].emergency.note : "");
  return (
    <div className="rounded-xl border border-vf-ash bg-vf-ink/60 p-4 sm:min-w-[15rem] sm:max-w-sm">
      <p className="text-xs text-vf-smoke">The call says</p>
      <p className="font-display text-4xl font-bold leading-none text-vf-flare">{e.call}</p>
      {others ? <p className="mt-2 text-sm leading-relaxed text-vf-bone/85">{others}</p> : null}
      {e.note ? (
        <p className="mt-1.5 text-sm leading-relaxed text-vf-smoke">
          <LocalText text={e.note.text} lang={p.lang} />
        </p>
      ) : null}
      <SourceLinks src={[...e.src, ...(e.note?.src ?? [])]} className="mt-2" />
      {e.fromProfile ? <p className="mt-1 text-xs text-vf-smoke">Numbers from VoiceFlare&apos;s {p.country} profile on /global.</p> : null}
    </div>
  );
}

export default function CountryPanel({ p, headingId }: { p: FloodProfile; headingId: string }) {
  const lang = p.lang;
  const { lesson } = p;
  return (
    <article aria-labelledby={headingId}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <h3 id={headingId} className="font-display text-2xl font-bold leading-tight text-vf-bone sm:text-3xl">
            {p.country}
          </h3>
          {p.scope ? <p className="mt-1.5 text-sm leading-relaxed text-vf-smoke">{p.scope}</p> : null}
        </div>
        <Emergency p={p} />
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-8">
        <div className="min-w-0 space-y-10">
          <Block emoji="🌊" title="Official flood warnings">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {p.warnings.map((w) => (
                <Product key={w.name} w={w} lang={lang} />
              ))}
            </div>
          </Block>

          <Block emoji="📣" title="Order words">
            <dl className="divide-y divide-vf-ash rounded-xl border border-vf-ash bg-vf-ink/60 px-4">
              {ORDER_STEPS.map((s) => {
                const o = p.orders.find((x) => x.step === s.key);
                return (
                  <div key={s.key} className="grid gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                    <dt className="flex items-center gap-2 text-xs font-medium text-vf-smoke sm:pt-0.5">
                      <span aria-hidden="true">{s.emoji}</span>
                      {s.label}
                    </dt>
                    <dd className="min-w-0">
                      {o && o.terms.length ? (
                        <ul className="space-y-2">
                          {o.terms.map((t) => (
                            <li key={`${t.local ?? ""}${t.en}`}>
                              <TermText t={t} lang={lang} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-vf-smoke">No standard national term was found.</p>
                      )}
                      {o ? <SourceLinks src={o.src} className="mt-1.5" /> : null}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {p.orderNotes.length ? (
              <div className="mt-4 space-y-3">
                {p.orderNotes.map((n) => (
                  <SourcedText key={n.text} s={n} lang={lang} />
                ))}
              </div>
            ) : null}
          </Block>
        </div>

        <div className="min-w-0 space-y-10">
          <Block emoji="👤" title="Who decides">
            <SourcedText s={p.decider} lang={lang} />
          </Block>
          <Block emoji="📲" title="Public channel">
            <SourcedText s={p.channel} lang={lang} />
            <p className="mt-3 rounded-lg border border-dashed border-vf-flare/40 px-3 py-2 text-sm leading-relaxed text-vf-bone/90">
              <span className="font-medium text-vf-ember">Dose from: </span>
              <LocalText text={p.dose} lang={lang} />
            </p>
          </Block>
          <Block emoji="👥" title="Sentinels">
            <ul className="space-y-3">
              {p.sentinels.map((s) => (
                <li key={s.text} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--vff-water)]" />
                  <SourcedText s={s} lang={lang} className="min-w-0" />
                </li>
              ))}
            </ul>
          </Block>
        </div>
      </div>

      <section className="mt-10 rounded-2xl border border-vf-flare/30 bg-vf-ink p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-vf-ember">Recent flood lesson</p>
        <h4 className="mt-1 font-display text-xl font-semibold text-vf-bone">
          <LocalText text={lesson.title} lang={lang} />
        </h4>
        <p className="mt-0.5 text-sm text-vf-smoke">
          {lesson.where}, {lesson.when}
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {lesson.facts.map((f) => (
            <li key={f.text} className="flex gap-2.5">
              <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-vf-flare" />
              <SourcedText s={f} lang={lang} className="min-w-0" />
            </li>
          ))}
        </ul>
        <div className="mt-5 border-l-2 border-vf-flare pl-4">
          <p className="text-base leading-relaxed text-vf-bone">
            <LocalText text={lesson.lesson.text} lang={lang} />
          </p>
          <SourceLinks src={lesson.lesson.src} className="mt-1" />
        </div>
        {lesson.also ? (
          <div className="mt-6 border-t border-vf-ash pt-5">
            <h5 className="font-display text-base font-semibold text-vf-bone">{lesson.also.title}</h5>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {lesson.also.facts.map((f) => (
                <li key={f.text} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-vf-smoke" />
                  <SourcedText s={f} lang={lang} className="min-w-0" />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-10">
        <h4 className="font-display text-lg font-semibold text-vf-bone">The flood ladder in {p.country}</h4>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FLOOD_LADDER.map((r, i) => (
            <li key={r.key} className="rounded-xl border border-vf-ash bg-vf-ink/60 p-4">
              <p className="flex items-center gap-2 font-display text-sm font-semibold text-vf-bone">
                <span aria-hidden="true">{r.emoji}</span>
                <span>
                  <span className="sr-only">Step {i + 1}: </span>
                  {r.name}
                </span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-vf-bone/85">
                <LocalText text={p.ladder[r.key]} lang={lang} />
              </p>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
