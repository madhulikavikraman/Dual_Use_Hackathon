// The ladder in every profiled place: VoiceFlare's six stored states down the side, each place's own label across.
// Labels come from lib/jurisdictions.ts; state colors and the hackathon's ladder rungs from lib/directives.ts.
import { JURISDICTIONS } from "@/lib/jurisdictions";
import { STATE_COLOR, STATE_RUNG, STATE_SHORT } from "@/lib/directives";
import { ZONE_STATES } from "@/lib/types";
import { CODES, PLACES } from "./content";
import LocalText from "./LocalText";

export default function LadderMatrix() {
  return (
    <div
      role="region"
      aria-labelledby="ladder-caption"
      tabIndex={0}
      className="vfg-scroll rounded-2xl border border-vf-ash focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vf-ember"
    >
      <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
        <caption id="ladder-caption" className="px-4 pb-1 pt-4 text-left text-sm text-vf-smoke sm:px-6">
          Each state&apos;s local label, by place. Under each state: the hackathon&apos;s ladder words for what the desk does there.
        </caption>
        <thead>
          <tr className="border-b border-vf-ash">
            <th scope="col" className="vfg-sticky-col w-[10.5rem] px-4 py-3 align-bottom text-xs font-medium text-vf-smoke sm:px-6">
              State
            </th>
            {CODES.map((c) => (
              <th key={c} scope="col" className="px-3 py-3 align-bottom font-display text-sm font-semibold text-vf-bone last:pr-6">
                {PLACES[c].place}
                <span className="block text-xs font-normal text-vf-smoke">{PLACES[c].country}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ZONE_STATES.map((s) => (
            <tr key={s} className="border-b border-vf-ash/70 align-top last:border-b-0">
              <th scope="row" className="vfg-sticky-col px-4 py-3.5 sm:px-6">
                <span className="flex items-center gap-2 font-display text-[0.95rem] font-semibold text-vf-bone">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATE_COLOR[s] }} />
                  {STATE_SHORT[s]}
                </span>
                <span className="mt-0.5 block pl-[1.125rem] text-xs font-normal text-vf-smoke">{STATE_RUNG[s]}</span>
              </th>
              {CODES.map((c) => (
                <td key={c} className="px-3 py-3.5 leading-relaxed text-vf-bone/90 last:pr-6">
                  {JURISDICTIONS[c].labels[s] ? (
                    <LocalText text={JURISDICTIONS[c].labels[s]} lang={PLACES[c].script} />
                  ) : (
                    <span className="text-vf-smoke">Not in the profile yet</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
