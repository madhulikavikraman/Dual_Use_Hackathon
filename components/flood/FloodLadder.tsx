// The flood ladder: five steps, gentlest first, each with what happens and what it would have been in Pune.
// The dots under each step's number show how much it asks of people (decoration; the step order says the same).
import { FLOOD_LADDER } from "@/lib/floods";
import { SourceLinks } from "./ui";

export default function FloodLadder() {
  const n = FLOOD_LADDER.length;
  return (
    <div>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {FLOOD_LADDER.map((r, i) => {
          const hold = r.key === "hold";
          return (
            <li
              key={r.key}
              className={`relative flex flex-col rounded-2xl border p-5 ${
                hold ? "border-vf-flare/50 bg-vf-coal shadow-[0_0_60px_-30px_rgb(255_42_18/0.6)]" : "border-vf-ash bg-vf-coal"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-vf-ash bg-vf-ink text-xl"
                >
                  {r.emoji}
                </span>
                <span aria-hidden="true" className="flex items-end gap-1">
                  {Array.from({ length: n }, (_, k) => (
                    <span
                      key={k}
                      className={`w-1.5 rounded-full ${k <= i ? (hold ? "bg-vf-flare" : "bg-[var(--vff-water)]") : "bg-vf-ash"}`}
                      style={{ height: `${6 + k * 3}px` }}
                    />
                  ))}
                </span>
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-vf-bone">
                <span className="mr-1.5 text-sm font-semibold text-vf-smoke">{i + 1}</span>
                {r.name}
              </h3>
              {hold ? (
                <p className="mt-1.5 inline-flex w-fit rounded-full border border-vf-flare/50 px-2 py-0.5 text-xs font-medium text-vf-ember">
                  90 seconds · delay, never stop
                </p>
              ) : null}
              <p className="mt-2 text-sm leading-relaxed text-vf-bone/90">{r.what}</p>
              <div className="mt-auto pt-4">
                <div className="border-t border-dashed border-vf-ash pt-3">
                  <p className="text-xs font-medium text-vf-smoke">In Pune</p>
                  <p className="mt-1 text-sm leading-relaxed text-vf-smoke">{r.pune.text}</p>
                  <SourceLinks src={r.pune.src} className="mt-1.5" />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-vf-smoke">
        VoiceFlare never delays, blocks or rewrites an official warning, whether it comes from IMD, SACHET, J-ALERT, WEA, 112
        or Emergency Alert. It holds only its own calls, and only for a named person to decide.
      </p>
    </div>
  );
}
