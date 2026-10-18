"use client";

import { useId, useState, type ReactNode } from "react";
import { STATE_COLOR } from "@/lib/directives";
import { HOLLOW_STATUS, PRIORITY_COLOR, stateShort, STATUS_COLOR, statusLabel } from "@/lib/client/labels";
import { BLOCK_STATUSES, ZONE_STATES, type Mode, type Status } from "@/lib/types";
import { BLOCK_COLOR, BLOCK_EMOJI, BLOCK_FILL, BLOCK_HINT, BLOCK_LABEL } from "./blockLabels";

/** A few call states stand for all of them: the dot's color is the call's result. */
const PEOPLE: Status[] = ["ringing", "leaving", "safe", "needs_help", "no_answer"];

function Swatch({ children }: { children: ReactNode }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      {children}
    </svg>
  );
}

function Item({ mark, title, children }: { mark: ReactNode; title?: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1" title={title}>
      {mark}
      <span>{children}</span>
    </li>
  );
}

/** One line of the legend: a short name, then its marks. */
function Row({ icon, name, children }: { icon: string; name: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-start gap-2 py-1">
      <span className="pt-px text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <span aria-hidden="true">{icon} </span>
        {name}
      </span>
      <ul aria-label={name} className="flex flex-wrap gap-x-2.5 gap-y-1">
        {children}
      </ul>
    </li>
  );
}

const dot = (color: string, hollow = false) => (
  <Swatch>
    <circle cx="8" cy="8" r="5" fill={hollow ? "none" : color} stroke={hollow ? color : "#fff"} strokeWidth={hollow ? 2.5 : 1.5} />
  </Swatch>
);

const road = (color: string) => (
  <Swatch>
    <path d="M1 12 L15 4" stroke="#fff" strokeWidth="5" />
    <path d="M1 12 L15 4" stroke={color} strokeWidth="3" />
  </Swatch>
);

/** What the colors and shapes on the map mean, in a few short lines. Folded by default so it never hides the sweep. */
export function MapLegend({ mode }: { mode: Mode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const blocks = mode !== "heat"; // the heat line has no evacuation waves, roads or evacuation points
  return (
    <div
      data-tour="legend"
      className="pointer-events-auto absolute bottom-3 left-3 z-[1000] max-w-[min(400px,calc(100%-1.5rem))] rounded-lg border border-slate-300 bg-white/95 text-xs text-slate-800 shadow-md"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 font-bold uppercase tracking-wider text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <span>
          <span aria-hidden="true">🗺️ </span>Legend
        </span>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <ul id={id} className="divide-y divide-slate-100 border-t border-slate-200 px-3 py-1">
          <Row icon="🟧" name="Zones">
            {ZONE_STATES.map((s) => (
              <Item
                key={s}
                mark={
                  <Swatch>
                    <rect x="1" y="3" width="14" height="10" rx="2" fill={STATE_COLOR[s]} fillOpacity="0.45" stroke={STATE_COLOR[s]} strokeWidth="1.5" />
                  </Swatch>
                }
              >
                {stateShort(s, mode)}
              </Item>
            ))}
            <Item
              title="Proposed by a model: needs a named human"
              mark={
                <Swatch>
                  <rect x="1.5" y="3.5" width="13" height="9" fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="3 2" />
                </Swatch>
              }
            >
              Proposed
            </Item>
            <Item
              title="The alert polygon while the hold runs"
              mark={
                <Swatch>
                  <rect x="1.5" y="3.5" width="13" height="9" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeDasharray="4 2" />
                </Swatch>
              }
            >
              Hold
            </Item>
          </Row>

          {blocks ? (
            <Row icon="🚦" name="Waves">
              {BLOCK_STATUSES.map((s) => (
                <Item
                  key={s}
                  title={BLOCK_HINT[s]}
                  mark={
                    <Swatch>
                      <rect x="1" y="3" width="14" height="10" rx="1.5" fill={BLOCK_COLOR[s]} fillOpacity={Math.min(0.85, BLOCK_FILL[s] + 0.25)} stroke="#fff" strokeWidth="1" />
                    </Swatch>
                  }
                >
                  <span aria-hidden="true">{BLOCK_EMOJI[s]} </span>
                  {BLOCK_LABEL[s]}
                </Item>
              ))}
            </Row>
          ) : null}

          {blocks ? (
            <Row icon="🛣️" name="Roads">
              <Item title="Exit road: the label shows how full it is in the wave shown" mark={road("#0f766e")}>
                Exit road
              </Item>
              <Item mark={road("#ca8a04")}>over 80%</Item>
              <Item mark={road("#b91c1c")}>over 100%</Item>
              <Item
                mark={
                  <Swatch>
                    <rect x="1" y="4" width="14" height="8" rx="1.5" fill="#15803d" />
                  </Swatch>
                }
              >
                Evac point
              </Item>
            </Row>
          ) : null}

          <Row icon="🏠" name="People">
            {PEOPLE.map((s) => (
              <Item key={s} mark={dot(STATUS_COLOR[s], HOLLOW_STATUS.includes(s))}>
                {statusLabel(s, mode)}
              </Item>
            ))}
          </Row>

          <Row icon="🆘" name="Help">
            <Item
              title="Help request, priority 1 (red) to 4 (violet)"
              mark={
                <svg width="30" height="14" viewBox="0 0 34 16" aria-hidden="true" className="shrink-0">
                  {([1, 2, 3, 4] as const).map((p, i) => (
                    <circle key={p} cx={4.5 + i * 8.3} cy="8" r="4" fill={PRIORITY_COLOR[p]} stroke="#fff" strokeWidth="1" />
                  ))}
                </svg>
              }
            >
              Priority 1–4
            </Item>
            <Item
              title="Live GPS the person chose to share; the circle is its accuracy (team only)"
              mark={
                <Swatch>
                  <circle cx="8" cy="8" r="7.2" fill="#3b82f6" fillOpacity="0.15" stroke="#2563eb" strokeWidth="1.2" />
                  <circle cx="8" cy="8" r="4" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
                </Swatch>
              }
            >
              Live GPS
            </Item>
            <Item
              title="Last seen more than 15 minutes ago"
              mark={
                <Swatch>
                  <circle cx="8" cy="8" r="5.5" fill="#94a3b8" />
                  <circle cx="8" cy="8" r="7.2" fill="none" stroke="#475569" strokeWidth="1.3" strokeDasharray="2 1.6" />
                </Swatch>
              }
            >
              Seen 15+ min ago
            </Item>
          </Row>

          <Row icon="📡" name="Checks">
            <Item
              title="Sentinel: a person at the zone's edge asked what they see"
              mark={
                <Swatch>
                  <rect x="4" y="4" width="8" height="8" transform="rotate(45 8 8)" fill="#4f46e5" stroke="#fff" strokeWidth="1.5" />
                </Swatch>
              }
            >
              Sentinel
            </Item>
            <Item
              title="Canary: a phone outside the polygon asked if the alert arrived"
              mark={
                <Swatch>
                  <path d="M8 2 L14.5 14 H1.5 Z" fill="#0d9488" stroke="#fff" strokeWidth="1.5" />
                </Swatch>
              }
            >
              Canary
            </Item>
            <Item
              title="A cluster of calls in one small area (hazard, help, silence or volume), with its count"
              mark={
                <Swatch>
                  <path d="M8 1.5 L13.6 4.75 V11.25 L8 14.5 L2.4 11.25 V4.75 Z" fill="#6d28d9" fillOpacity="0.3" stroke="#6d28d9" strokeWidth="1.5" />
                </Swatch>
              }
            >
              Cluster
            </Item>
          </Row>
        </ul>
      ) : null}
    </div>
  );
}
