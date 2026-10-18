"use client";

// The board's left sidebar: the logo and scenario, one nav item per view, and the live numbers (calls, reach,
// understanding, help, human decisions, cost, phones). Full width from 1280 px, an icon rail between 1024 and
// 1280 px (or when folded), and a drawer below 1024 px, with a row of view buttons under the top bar instead.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { fmtInt, fmtPct, fmtUsd } from "@/lib/client/format";
import { modeLabel, modeWords } from "@/lib/ui/display";
import { Emoji } from "@/lib/ui/Emoji";
import { hazardIcon, ICON } from "@/lib/ui/icons";
import { BOARD_VIEWS, setBoardView, setDrawer, setRail, useBoardView, type BoardView } from "@/lib/ui/boardView";
import { useMedia } from "@/lib/ui/useMedia";
import { useBoard } from "../BoardContext";
import { ScenarioSwitcher, SupervisorInput } from "../HeaderControls";

export type BadgeTone = "bad" | "warn" | "info" | "neutral";
export type NavBadges = Partial<Record<BoardView, { n: number; tone: BadgeTone; label: string }>>;

const BADGE: Record<BadgeTone, string> = {
  bad: "bg-red-600 text-white",
  warn: "bg-amber-400 text-slate-950",
  info: "bg-blue-500 text-white",
  neutral: "bg-slate-600 text-slate-100",
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember";

/** A phone counts as online while its page has sent a heartbeat in the last 10 s (as on /phones). */
const ONLINE_MS = 10_000;

/** What the view is called in this scenario's words (base mode keeps personnel accountability). */
export function viewLabel(view: BoardView, mode: string): string {
  if (view === "help") return mode === "base" ? "Accountability" : "Help";
  return BOARD_VIEWS.find((v) => v.id === view)?.label ?? view;
}

function Count({ badge, rail }: { badge: NavBadges[BoardView]; rail: boolean }) {
  if (!badge || !badge.n) return null;
  return (
    <span
      className={`rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums ${BADGE[badge.tone]} ${
        rail ? "absolute -right-1 -top-1 min-w-[18px] text-center" : "ml-auto"
      }`}
    >
      {badge.n}
      <span className="sr-only"> {badge.label}</span>
    </span>
  );
}

// ---------- Brand and scenario ----------

function Brand({ rail }: { rail: boolean }) {
  const { snap } = useBoard();
  const mode = snap.meta.mode;
  return (
    <div data-tour="scenario" className={`shrink-0 ${rail ? "flex flex-col items-center gap-2 px-2 pb-2 pt-3" : "px-3 pb-3 pt-3"}`}>
      <div className="flex items-center gap-2">
        <Image src="/brand/voiceflare-mark.png" alt="" width={28} height={28} className="size-7" loading="eager" />
        {rail ? <span className="sr-only">VoiceFlare</span> : <span className="text-xl font-black tracking-tight">VoiceFlare</span>}
      </div>
      <span
        className={`inline-block rounded bg-amber-400 font-black tracking-widest text-slate-950 ${rail ? "px-1 py-0.5 text-[9px]" : "mt-2 px-2 py-0.5 text-xs"}`}
        title="Hackathon demo. Residents are synthetic except the volunteer phones. Nothing reaches a real alert system."
      >
        DEMO
      </span>
      {rail ? (
        <button
          type="button"
          onClick={() => setRail(false)}
          title={`Scenario: ${modeLabel(mode)}. Unfold the sidebar to switch.`}
          className={`grid size-9 place-items-center rounded-md text-lg hover:bg-white/10 ${FOCUS}`}
        >
          <Emoji e={ICON.scenario} />
          <span className="sr-only">Unfold the sidebar to switch the scenario</span>
        </button>
      ) : (
        <div className="mt-3 space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <Emoji e={ICON.scenario} /> Scenario
          </div>
          <ScenarioSwitcher current={snap.meta.scenario} />
          <p className="truncate text-xs text-slate-400" title={modeLabel(mode)}>
            <Emoji e={hazardIcon(mode)} /> {modeLabel(mode)}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- Nav ----------

function Nav({ rail, badges }: { rail: boolean; badges: NavBadges }) {
  const { snap } = useBoard();
  const { view } = useBoardView();
  return (
    <nav data-tour="nav" aria-label="Board views" className="shrink-0 border-t border-white/10 px-2 py-2">
      <ul className={`flex flex-col gap-0.5 ${rail ? "items-center" : ""}`}>
        {BOARD_VIEWS.map((v) => {
          const on = view === v.id;
          const label = viewLabel(v.id, snap.meta.mode);
          return (
            <li key={v.id} className={rail ? "" : "w-full"}>
              <button
                type="button"
                data-tour={`nav-${v.id}`}
                aria-current={on ? "page" : undefined}
                onClick={() => setBoardView(v.id)}
                title={rail ? `${label}: ${v.hint}` : v.hint}
                className={`relative flex items-center rounded-md text-sm font-semibold transition-colors motion-reduce:transition-none ${FOCUS} ${
                  rail ? "size-10 justify-center" : "w-full gap-2.5 px-2.5 py-2"
                } ${on ? "bg-white text-slate-900 shadow-sm" : "text-slate-200 hover:bg-white/10"}`}
              >
                <Emoji e={v.icon} className="text-[17px] leading-none" />
                <span className={rail ? "sr-only" : ""}>{label}</span>
                <Count badge={badges[v.id]} rail={rail} />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---------- Live numbers ----------

function Stat({
  icon,
  label,
  value,
  note,
  alert = false,
  rail,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  alert?: boolean;
  rail: boolean;
}) {
  if (rail) {
    return (
      <li className="flex flex-col items-center gap-0.5 py-1" title={`${label}${typeof note === "string" ? `: ${note}` : ""}`}>
        <Emoji e={icon} className="text-base leading-none" />
        <span className={`text-[13px] font-black tabular-nums leading-none ${alert ? "text-red-400" : "text-white"}`}>{value}</span>
        <span className="sr-only">
          {label}
          {typeof note === "string" ? `, ${note}` : ""}
        </span>
      </li>
    );
  }
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-x-1.5 py-1">
      <Emoji e={icon} className="text-[15px] leading-none" />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-slate-200">{label}</span>
        {note ? <span className="block truncate text-[11px] text-slate-400">{note}</span> : null}
      </span>
      <span className={`text-right text-[17px] font-black tabular-nums leading-none ${alert ? "text-red-400" : "text-white"}`}>{value}</span>
    </li>
  );
}

function Stats({ rail }: { rail: boolean }) {
  const { snap } = useBoard();
  const m = snap.metrics;
  const words = modeWords(snap.meta.mode);
  const now = Date.parse(snap.now);
  const devices = snap.households.filter((h) => h.has_device && h.device_label !== "Public line");
  const online = devices.filter((h) => h.presence_at && now - Date.parse(h.presence_at) < ONLINE_MS).length;
  // Volunteer resident phones, as the engine counts real_accounted (public-line callers are not on the roster).
  const realResidents = devices.filter((h) => h.role === "resident").length;
  return (
    <section data-tour="metrics" aria-label="Live numbers" className={`border-t border-white/10 ${rail ? "px-1 py-2" : "px-3 py-2"}`}>
      {rail ? null : (
        <h2 className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Live numbers</h2>
      )}
      <ul className={rail ? "flex flex-col items-center gap-1" : "divide-y divide-white/5"}>
        <Stat rail={rail} icon={ICON.calls} label="Calls live / queued" value={`${m.calls_active}/${fmtInt(m.calls_queued)}`} note={`${m.calls_active} live · ${fmtInt(m.calls_queued)} queued`} />
        <Stat rail={rail} icon={ICON.reached} label={words.reached} value={fmtInt(m.reached)} note={`of ${fmtInt(m.in_campaigns)} called`} />
        <Stat rail={rail} icon={ICON.understood} label="Understood" value={fmtPct(m.understood_pct)} note="repeated the plan back" />
        <Stat
          rail={rail}
          icon={ICON.help}
          label={words.needsHelp}
          value={fmtInt(m.needs_help_open)}
          note={words.registry.toLowerCase()}
          alert={m.needs_help_open > 0}
        />
        <Stat rail={rail} icon={ICON.human} label="Human decisions" value={fmtInt(m.human_decisions)} note="named, in the ledger" />
        <Stat rail={rail} icon={ICON.refusal} label="Refusals" value={fmtInt(m.refusals)} note="the agent said no" />
        <Stat
          rail={rail}
          icon={ICON.cost}
          label="Cost (estimate)"
          value={rail && m.cost_usd >= 10 ? fmtUsd(m.cost_usd).replace(/\.\d\d$/, "") : fmtUsd(m.cost_usd)}
          note={`${m.cost_minutes.toFixed(1)} call minutes · estimate`}
        />
        <Stat
          rail={rail}
          icon={ICON.phone}
          label="Real phones online"
          value={`${online}/${devices.length}`}
          note={`${m.real_accounted} of ${realResidents} accounted`}
        />
      </ul>
    </section>
  );
}

// ---------- Links and fold ----------

function Links({ rail }: { rail: boolean }) {
  const items = [
    { href: "/qrt", icon: ICON.qrt, label: "QRT" },
    { href: "/phones", icon: ICON.phone, label: "Phones" },
  ];
  return (
    <nav data-tour="links" aria-label="Other screens" className={`flex gap-1 ${rail ? "flex-col items-center" : "flex-wrap"}`}>
      {items.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          target="_blank"
          title={`Open ${l.label} in a new tab`}
          className={`inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white ${FOCUS} ${
            rail ? "size-10 justify-center" : "px-2 py-1.5"
          }`}
        >
          <Emoji e={l.icon} />
          <span className={rail ? "sr-only" : ""}>{l.label}</span>
          <span aria-hidden="true" className={rail ? "hidden" : "text-slate-500"}>
            ↗
          </span>
          <span className="sr-only"> (opens in a new tab)</span>
        </Link>
      ))}
    </nav>
  );
}

function Fold({ rail, canUnfold }: { rail: boolean; canUnfold: boolean }) {
  if (!canUnfold) return null;
  return (
    <button
      type="button"
      onClick={() => setRail(!rail)}
      aria-pressed={rail}
      title={rail ? "Unfold the sidebar" : "Fold the sidebar to icons"}
      className={`inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-slate-400 hover:bg-white/10 hover:text-white ${FOCUS} ${
        rail ? "size-10 justify-center" : "ml-auto px-2 py-1.5"
      }`}
    >
      <span aria-hidden="true">{rail ? "»" : "«"}</span>
      <span className={rail ? "sr-only" : ""}>{rail ? "Unfold" : "Fold"}</span>
    </button>
  );
}

function SidebarBody({ rail, badges, canUnfold }: { rail: boolean; badges: NavBadges; canUnfold: boolean }) {
  return (
    <>
      <Brand rail={rail} />
      <Nav rail={rail} badges={badges} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Stats rail={rail} />
      </div>
      <div className={`flex shrink-0 border-t border-white/10 ${rail ? "flex-col items-center gap-1 px-1 py-2" : "items-center gap-1 px-2 py-2"}`}>
        <Links rail={rail} />
        <Fold rail={rail} canUnfold={canUnfold} />
      </div>
    </>
  );
}

/** Desktop: full sidebar from 1280 px unless folded; an icon rail from 1024 px. Hidden below 1024 px (the drawer). */
export function BoardSidebar({ badges }: { badges: NavBadges }) {
  const { rail: folded } = useBoardView();
  const wide = useMedia("(min-width: 1280px)", true);
  const rail = folded || !wide;
  return (
    <aside
      aria-label="Board sidebar"
      className={`hidden shrink-0 flex-col overflow-hidden bg-slate-900 text-white lg:flex ${rail ? "w-[68px]" : "w-60"}`}
    >
      <SidebarBody rail={rail} badges={badges} canUnfold={wide} />
    </aside>
  );
}

/** Below 1024 px: the sidebar slides in from the left. Not modal, so the guided tour can point into it. */
export function BoardDrawer({ badges }: { badges: NavBadges }) {
  const { drawer } = useBoardView();
  const desktop = useMedia("(min-width: 1024px)", true);
  const closeRef = useRef<HTMLButtonElement>(null);
  const userOpened = useRef(false);

  useEffect(() => {
    if (desktop && drawer) setDrawer(false);
  }, [desktop, drawer]);

  useEffect(() => {
    if (!drawer) return;
    // Focus moves in only when a person opened it (the tour keeps its own focus on its card).
    const menu = document.querySelector<HTMLButtonElement>("[data-board-menu]");
    userOpened.current = document.activeElement === menu;
    if (userOpened.current) closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && userOpened.current) setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (userOpened.current) menu?.focus();
    };
  }, [drawer]);

  if (!drawer || desktop) return null;
  return (
    <div className="fixed inset-0 z-[1050] lg:hidden">
      <button
        type="button"
        aria-label="Close the menu"
        tabIndex={-1}
        onClick={() => setDrawer(false)}
        className="absolute inset-0 bg-slate-950/50 motion-safe:animate-[vf-fade_0.15s_ease-out]"
      />
      <aside
        id="board-drawer"
        aria-label="Board sidebar"
        className="absolute inset-y-0 left-0 flex w-[min(300px,86vw)] flex-col overflow-hidden bg-slate-900 text-white shadow-2xl motion-safe:animate-[vf-drawer_0.18s_ease-out]"
      >
        <div className="flex shrink-0 items-center justify-end px-2 pt-2">
          <button
            ref={closeRef}
            type="button"
            onClick={() => setDrawer(false)}
            className={`rounded-md px-2.5 py-1 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white ${FOCUS}`}
          >
            Close <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <SidebarBody rail={false} badges={badges} canUnfold={false} />
          <div className="border-t border-white/10 px-3 py-3">
            <SupervisorInput />
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Below 1024 px: the views as a row of buttons under the top bar. */
export function MobileNav({ badges }: { badges: NavBadges }) {
  const { snap } = useBoard();
  const { view } = useBoardView();
  return (
    <nav data-tour="nav-mobile" aria-label="Board views" className="shrink-0 overflow-x-auto border-b border-slate-300 bg-white lg:hidden">
      <ul className="flex min-w-max gap-1 px-2 py-1.5">
        {BOARD_VIEWS.map((v) => {
          const on = view === v.id;
          const label = viewLabel(v.id, snap.meta.mode);
          return (
            <li key={v.id}>
              <button
                type="button"
                data-tour={`navm-${v.id}`}
                aria-current={on ? "page" : undefined}
                onClick={() => setBoardView(v.id)}
                className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  on ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Emoji e={v.icon} />
                {label}
                <Count badge={badges[v.id]} rail={false} />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
