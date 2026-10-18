"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useNow } from "@/lib/client/clock";
import { fmtCountdown } from "@/lib/client/format";
import { modeWords } from "@/lib/ui/display";
import { Emoji } from "@/lib/ui/Emoji";
import { ICON } from "@/lib/ui/icons";
import { BOARD_VIEWS, setBoardView, setDrawer, useBoardView } from "@/lib/ui/boardView";
import { BOARD_TOUR } from "@/components/tour/boardSteps";
import { TourButton } from "@/components/tour/TourButton";
import { PlayFireButton } from "@/components/autoplay/PlayFireButton";
import type { Hold } from "@/lib/types";
import { useBoard } from "./BoardContext";
import { LiveClock, SupervisorInput } from "./HeaderControls";
import { viewLabel } from "./sidebar/BoardSidebar";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember";

function HeaderChip({ on, className = "", title, children }: { on: boolean; className?: string; title?: string; children: ReactNode }) {
  return (
    <span
      title={title}
      className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        on ? "bg-slate-800 text-slate-100 ring-slate-600" : "bg-transparent text-slate-400 ring-slate-700"
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** Outside the Map view, an open hold stays one click away: its countdown and zone, and a button back to it. */
function HoldChip({ hold }: { hold: Hold }) {
  const { zoneById, clockOffset } = useBoard();
  const now = useNow();
  const remaining = now === null ? Date.parse(hold.deadline) - Date.parse(hold.started_at) : Date.parse(hold.deadline) - (now + clockOffset);
  const zone = zoneById.get(hold.zone_id)?.name ?? hold.zone_id;
  return (
    <button
      type="button"
      onClick={() => setBoardView("map")}
      title="Open the hold on the Map view"
      className={`inline-flex min-w-0 shrink items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white shadow-[0_0_18px_-4px_rgb(220_38_38/0.9)] hover:bg-red-500 ${FOCUS}`}
    >
      <Emoji e={ICON.hold} className="motion-safe:animate-pulse" />
      <span className="font-mono tabular-nums">{fmtCountdown(remaining)}</span>
      <span className="min-w-0 truncate">
        Hold<span className="hidden sm:inline"> · {zone}</span>
      </span>
      <span className="sr-only">. Open the hold.</span>
    </button>
  );
}

/** The top bar: the view on screen, an open hold, Retell and storage, the clock, your name, autoplay and the tour. */
export function BoardHeader() {
  const { snap, hold } = useBoard();
  const { view, drawer } = useBoardView();
  const def = BOARD_VIEWS.find((v) => v.id === view) ?? BOARD_VIEWS[0];
  const title = view === "help" ? modeWords(snap.meta.mode).registry : viewLabel(view, snap.meta.mode);
  return (
    <header data-tour="header" className="flex h-14 shrink-0 items-center gap-2 bg-slate-900 px-3 text-white sm:gap-3 sm:px-4">
      <button
        type="button"
        data-board-menu
        onClick={() => setDrawer(!drawer)}
        aria-expanded={drawer}
        aria-controls="board-drawer"
        className={`grid size-9 shrink-0 place-items-center rounded-md text-lg hover:bg-white/10 lg:hidden ${FOCUS}`}
      >
        <span aria-hidden="true">{ICON.menu}</span>
        <span className="sr-only">Menu: scenario, live numbers and other screens</span>
      </button>
      <Image src="/brand/voiceflare-mark.png" alt="VoiceFlare" width={24} height={24} className="size-6 shrink-0 lg:hidden" loading="eager" />
      <h1 className="flex min-w-0 shrink items-center gap-2 truncate text-[17px] font-bold">
        <Emoji e={def.icon} />
        <span className="truncate">{title}</span>
      </h1>
      {hold && view !== "map" ? <HoldChip hold={hold} /> : null}
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <HeaderChip on className="hidden 2xl:inline" title="Where the board's state is stored">
          Storage: {snap.backend}
        </HeaderChip>
        <HeaderChip on={snap.retell} className="hidden md:inline" title="Whether real phone calls go out through Retell AI">
          <Emoji e={ICON.calls} /> Retell {snap.retell ? "on" : "off"}
        </HeaderChip>
        <span className="hidden xl:block">
          <LiveClock />
        </span>
        <span className="hidden sm:block">
          <SupervisorInput />
        </span>
        <PlayFireButton />
        <TourButton tour={BOARD_TOUR} />
      </div>
    </header>
  );
}
