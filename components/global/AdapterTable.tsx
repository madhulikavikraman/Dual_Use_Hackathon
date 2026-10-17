// Los Angeles and Chongqing, adapter by adapter, rendered from the US-CA and CN profiles in lib/jurisdictions.ts.
// Rows the profiles have no field for (Los Angeles sentinels, dose, last mile) use PRD 17.2 wording from ./content.
import type { ReactNode } from "react";
import { JURISDICTIONS } from "@/lib/jurisdictions";
import { LA_EXTRA, PLACES, adaptation, languageName } from "./content";
import LocalText from "./LocalText";

const LA = JURISDICTIONS["US-CA"];
const CN = JURISDICTIONS.CN;
const ZH = PLACES.CN.script;

function Missing() {
  return <span className="text-vf-smoke">Not in the profile yet</span>;
}

/** Paragraphs from profile strings; empty strings are skipped, and an all-empty cell says so. */
function Cell({ parts, lang = null }: { parts: (string | ReactNode)[]; lang?: string | null }) {
  const shown = parts.filter((p) => p !== "" && p !== null && p !== undefined);
  if (!shown.length) return <Missing />;
  return (
    <>
      {shown.map((p, i) => (
        <p key={i} className={i ? "mt-2" : undefined}>
          {typeof p === "string" ? <LocalText text={p} lang={lang} /> : p}
        </p>
      ))}
    </>
  );
}

function CallNumber({ n, note }: { n: string; note: string }) {
  return (
    <>
      <span className="font-display text-2xl font-bold leading-none text-vf-flare">{n}</span>
      {note ? <span className="ml-2 text-vf-bone/80">{note}</span> : null}
    </>
  );
}

const ROWS: { name: string; la: ReactNode; cn: ReactNode }[] = [
  {
    name: "Ladder words",
    la: <Cell parts={[`${LA_EXTRA.ladder}: ${[LA.labels.warning, LA.labels.order, LA.labels.shelter_in_place, LA.labels.lifted].join(", ")}.`]} />,
    cn: <Cell lang={ZH} parts={[adaptation(CN, /colou?r|red warning/i) || `${CN.labels.warning}; ${CN.labels.order}`]} />,
  },
  {
    name: "Decider",
    la: <Cell parts={[LA.decider]} />,
    cn: <Cell lang={ZH} parts={[CN.decider]} />,
  },
  {
    name: "Emergency number in every call",
    la: <Cell parts={[<CallNumber key="n" n={LA.call_now} note={LA.emergency.note} />]} />,
    cn: <Cell lang={ZH} parts={[<CallNumber key="n" n={CN.call_now} note={CN.emergency.note} />]} />,
  },
  {
    name: "Public channel and dose",
    la: <Cell parts={[LA.warning_system, LA_EXTRA.dose]} />,
    cn: <Cell lang={ZH} parts={[CN.warning_system, adaptation(CN, /12379|dose/i)]} />,
  },
  {
    name: "Sentinels",
    la: <Cell parts={[LA_EXTRA.sentinels]} />,
    cn: <Cell lang={ZH} parts={[adaptation(CN, /叫应|sentinel/i)]} />,
  },
  {
    name: "Voice and AI model",
    la: <Cell parts={[LA.telephony, LA.ai_model]} />,
    cn: <Cell lang={ZH} parts={[CN.telephony, CN.ai_model]} />,
  },
  {
    name: "Privacy",
    la: <Cell parts={[LA.privacy]} />,
    cn: <Cell lang={ZH} parts={[CN.privacy]} />,
  },
  {
    name: "Maps",
    la: <Cell parts={[LA.maps]} />,
    cn: <Cell lang={ZH} parts={[CN.maps]} />,
  },
  {
    name: "Languages",
    la: <Cell parts={[LA.languages.map(languageName).join(", ")]} />,
    cn: <Cell parts={[CN.languages.map(languageName).join(", ")]} />,
  },
  {
    name: "Last mile",
    la: <Cell parts={[LA_EXTRA.lastMile]} />,
    cn: <Cell lang={ZH} parts={[adaptation(CN, /last mile/i)]} />,
  },
];

export default function AdapterTable() {
  return (
    <div
      role="region"
      aria-labelledby="adapters-caption"
      tabIndex={0}
      className="vfg-scroll rounded-2xl border border-vf-ash focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vf-ember"
    >
      <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
        <caption id="adapters-caption" className="px-4 pb-1 pt-4 text-left text-sm text-vf-smoke sm:px-6">
          What each adapter holds in Los Angeles and in Chongqing. Both are built; the Chongqing column is the Twist 2 change.
        </caption>
        <thead>
          <tr className="border-b border-vf-ash">
            <th scope="col" className="w-[11rem] px-4 py-3 align-bottom text-xs font-medium text-vf-smoke sm:px-6">
              Adapter
            </th>
            <th scope="col" className="px-4 py-3 align-bottom font-display text-base font-semibold text-vf-bone">
              Los Angeles <span className="block text-xs font-normal text-vf-smoke">United States, built first</span>
            </th>
            <th scope="col" className="px-4 py-3 align-bottom font-display text-base font-semibold text-vf-bone sm:pr-6">
              Chongqing <span className="block text-xs font-normal text-vf-smoke">China, built for Twist 2</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.name} className="border-b border-vf-ash/70 align-top last:border-b-0">
              <th scope="row" className="px-4 py-4 font-display text-[0.95rem] font-semibold leading-snug text-vf-flare sm:px-6">
                {r.name}
              </th>
              <td className="px-4 py-4 leading-relaxed text-vf-bone/80">{r.la}</td>
              <td className="px-4 py-4 leading-relaxed text-vf-bone sm:pr-6">{r.cn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
