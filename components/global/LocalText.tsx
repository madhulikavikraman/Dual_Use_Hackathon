import { Fragment } from "react";

// Han, kana, CJK punctuation and full-width forms, Greek, Devanagari.
const LOCAL = /[Ͱ-Ͽἀ-῿ऀ-ॿ⺀-⿟　-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;
const LATIN = /[A-Za-zÀ-ɏ]/;

/** Split text into runs of local script and Latin; spaces, digits and ASCII punctuation join the run they follow. */
export function scriptRuns(text: string): { text: string; local: boolean }[] {
  const runs: { text: string; local: boolean }[] = [];
  let cur = "";
  let kind: boolean | null = null;
  for (const ch of text) {
    const k = LOCAL.test(ch) ? true : LATIN.test(ch) ? false : null;
    if (k === null || kind === null || k === kind) {
      cur += ch;
      if (kind === null && k !== null) kind = k;
      continue;
    }
    runs.push({ text: cur, local: kind });
    cur = ch;
    kind = k;
  }
  if (cur) runs.push({ text: cur, local: kind === true });
  return runs;
}

/**
 * Text that mixes a local script with English. Local runs get a lang tag, so the browser picks a Chinese, Japanese,
 * Greek or Devanagari font (the same Han character is drawn differently in Chinese and Japanese fonts) and screen
 * readers switch voice. "{zone}" in a directive template shows as a marked slot.
 */
export default function LocalText({ text, lang, slot = "zone" }: { text: string; lang: string | null; slot?: string }) {
  if (!text) return null;
  const parts = text.split("{zone}");
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="vfg-slot">{slot}</span>}
          {lang
            ? scriptRuns(part).map((r, k) =>
                r.local ? (
                  <span key={k} lang={lang}>
                    {r.text}
                  </span>
                ) : (
                  <Fragment key={k}>{r.text}</Fragment>
                ),
              )
            : part}
        </Fragment>
      ))}
    </>
  );
}
