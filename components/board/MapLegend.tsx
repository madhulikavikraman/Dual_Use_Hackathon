"use client";

import { useState, type ReactNode } from "react";
import { STATE_COLOR } from "@/lib/directives";
import { HOLLOW_STATUS, PRIORITY_COLOR, stateShort, STATUS_COLOR, statusLabel } from "@/lib/client/labels";
import { ZONE_STATES, type Mode, type Status } from "@/lib/types";

const PEOPLE: Status[] = ["pending", "queued", "ringing", "leaving", "safe", "needs_help", "wont_leave", "no_answer", "unreachable"];

function Swatch({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      {children}
    </svg>
  );
}

function Item({ mark, children }: { mark: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      {mark}
      <span>{children}</span>
    </li>
  );
}

const dot = (color: string, hollow = false) => (
  <Swatch>
    <circle cx="8" cy="8" r="5" fill={hollow ? "none" : color} stroke={hollow ? color : "#fff"} strokeWidth={hollow ? 2.5 : 1.5} />
  </Swatch>
);

/** What the colors and shapes on the map mean. Folded by default so it never hides the sweep. */
export function MapLegend({ mode }: { mode: Mode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-[1000] max-w-[440px] rounded-lg border border-slate-300 bg-white/95 text-xs text-slate-800 shadow-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-1.5 font-bold uppercase tracking-wider text-slate-600"
      >
        Legend <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <div className="grid grid-cols-3 gap-x-4 gap-y-1 border-t border-slate-200 px-3 py-2">
          <ul className="space-y-1">
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
              mark={
                <Swatch>
                  <rect x="1.5" y="3.5" width="13" height="9" fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="3 2" />
                </Swatch>
              }
            >
              Proposed by model
            </Item>
            <Item
              mark={
                <Swatch>
                  <rect x="1.5" y="3.5" width="13" height="9" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeDasharray="4 2" />
                </Swatch>
              }
            >
              Hold polygon
            </Item>
          </ul>
          <ul className="space-y-1">
            {PEOPLE.map((s) => (
              <Item key={s} mark={dot(STATUS_COLOR[s], HOLLOW_STATUS.includes(s))}>
                {statusLabel(s, mode)}
              </Item>
            ))}
          </ul>
          <ul className="space-y-1">
            <Item
              mark={
                <Swatch>
                  <rect x="4" y="4" width="8" height="8" transform="rotate(45 8 8)" fill="#4f46e5" stroke="#fff" strokeWidth="1.5" />
                </Swatch>
              }
            >
              Sentinel
            </Item>
            <Item
              mark={
                <Swatch>
                  <path d="M8 2 L14.5 14 H1.5 Z" fill="#0d9488" stroke="#fff" strokeWidth="1.5" />
                </Swatch>
              }
            >
              Canary
            </Item>
            {([1, 2, 3, 4] as const).map((p) => (
              <Item
                key={p}
                mark={
                  <Swatch>
                    <circle cx="8" cy="8" r="6.5" fill={PRIORITY_COLOR[p]} />
                    <text x="8" y="11.5" textAnchor="middle" fontSize="9" fontWeight="800" fill={p === 3 ? "#111827" : "#fff"}>
                      {p}
                    </text>
                  </Swatch>
                }
              >
                Help, priority {p}
              </Item>
            ))}
            <Item
              mark={
                <Swatch>
                  <circle cx="8" cy="8" r="5.5" fill="#94a3b8" />
                  <circle cx="8" cy="8" r="7.2" fill="none" stroke="#475569" strokeWidth="1.3" strokeDasharray="2 1.6" />
                </Swatch>
              }
            >
              Last seen &gt; 15 min
            </Item>
            <Item
              mark={
                <Swatch>
                  <rect x="1" y="4" width="14" height="8" rx="1.5" fill="#15803d" />
                </Swatch>
              }
            >
              Evacuation point
            </Item>
            <Item
              mark={
                <Swatch>
                  <path d="M8 1.5 L13.6 4.75 V11.25 L8 14.5 L2.4 11.25 V4.75 Z" fill="#6d28d9" fillOpacity="0.3" stroke="#6d28d9" strokeWidth="1.5" />
                </Swatch>
              }
            >
              Cluster (count)
            </Item>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
