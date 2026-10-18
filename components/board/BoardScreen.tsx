"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getBoard } from "@/lib/client/api";
import { fmtClock } from "@/lib/client/format";
import { modeWords } from "@/lib/ui/display";
import { usePoll } from "@/lib/client/usePoll";
import { Emoji } from "@/lib/ui/Emoji";
import { ICON } from "@/lib/ui/icons";
import { useBoardView, type BoardView } from "@/lib/ui/boardView";
import { BoardTour } from "@/components/tour/BoardTour";
import { AutoplayOverlay } from "@/components/autoplay/AutoplayOverlay";
import { LiveRegistryPanel } from "@/components/locate/LiveRegistry";
import { LiveRegistryProvider } from "@/components/locate/LiveRegistryContext";
import { ToastProvider } from "@/components/ui/Toast";
import { AskBoard } from "./AskBoard";
import { BoardProvider, useBoard } from "./BoardContext";
import { BoardHeader } from "./BoardHeader";
import { BoardMap } from "./BoardMap";
import { CallsPanel } from "./CallsStrip";
import { FeedPanel, FeedTicker } from "./FeedPanel";
import { HoldStrip } from "./HoldStrip";
import { LedgerPanel } from "./LedgerPanel";
import { MapLegend } from "./MapLegend";
import { BoardDrawer, BoardSidebar, MobileNav, type NavBadges } from "./sidebar/BoardSidebar";
import { ZonesPanel } from "./ZonesPanel";

const POLL_MS = 1000;

/** Shown until the first snapshot arrives (or while /api/board cannot be reached). */
export function BoardWaiting({ error }: { error: string | null }) {
  return (
    <div className="grid h-dvh place-items-center bg-slate-100 p-6 text-slate-900">
      <div className="max-w-md text-center">
        <div className="flex items-center justify-center gap-2 text-2xl font-black tracking-tight">
          <Image src="/brand/voiceflare-mark.png" alt="" width={32} height={32} className="size-8" loading="eager" />
          VoiceFlare
        </div>
        {error ? (
          <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Cannot reach the board: {error}. Retrying every second.
          </p>
        ) : (
          <p className="mt-4 text-sm text-slate-600">Loading the board…</p>
        )}
      </div>
    </div>
  );
}

/** When polling fails after the board has loaded: say how old the picture is. */
export function OfflineBanner({ error, receivedAt }: { error: string; receivedAt: number | null }) {
  return (
    <div role="alert" className="shrink-0 border-b border-amber-300 bg-amber-100 px-4 py-1.5 text-sm font-semibold text-amber-950">
      Connection lost ({error}). Showing the board as of {receivedAt ? fmtClock(receivedAt) : "the last update"}. Retrying every second.
    </div>
  );
}

/** The counts on the nav items: open proposals, live calls, open help, refusals, unread feed items. */
function useNavBadges(view: BoardView): NavBadges {
  const { snap } = useBoard();
  // Feed items newer than this are unread; it moves up when the Feed view is opened or left.
  const [feedSeenAt, setFeedSeenAt] = useState<string | null>(() => snap.feed[0]?.created_at ?? null);
  const newest = snap.feed[0]?.created_at ?? null;
  const last = useRef(view);
  useEffect(() => {
    if (last.current !== view && (last.current === "feed" || view === "feed")) setFeedSeenAt(newest);
    last.current = view;
  }, [view, newest]);

  const openProposals = snap.proposals.filter((p) => p.status === "open").length;
  const lifeSafety = snap.registry.some((r) => r.priority === 1 && r.status !== "closed" && r.status !== "reached");
  const unread = view === "feed" ? 0 : snap.feed.filter((f) => !feedSeenAt || f.created_at > feedSeenAt).length;
  return {
    map: { n: openProposals, tone: "warn", label: openProposals === 1 ? "model proposal waiting" : "model proposals waiting" },
    calls: { n: snap.metrics.calls_active, tone: "info", label: "live" },
    help: { n: snap.metrics.needs_help_open, tone: lifeSafety ? "bad" : "warn", label: "open" },
    ledger: { n: snap.metrics.refusals, tone: "neutral", label: snap.metrics.refusals === 1 ? "refusal" : "refusals" },
    feed: { n: unread, tone: "neutral", label: "unread" },
  };
}

/** A view's panel in the right column: a titled card that scrolls on its own. */
function Panel({ icon, title, aside, tour = "side-panel", children }: { icon: string; title: string; aside?: ReactNode; tour?: string; children: ReactNode }) {
  return (
    <section
      data-tour={tour}
      aria-label={title}
      className="flex min-h-[160px] flex-col overflow-hidden rounded-lg border border-slate-300 bg-white lg:min-h-[140px] lg:flex-1"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <Emoji e={icon} /> {title}
        </h2>
        {aside ? <span className="ml-auto min-w-0 truncate text-xs text-slate-500">{aside}</span> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

function ViewColumn({ view }: { view: BoardView }) {
  const { snap } = useBoard();
  const m = snap.metrics;
  const words = modeWords(snap.meta.mode);
  return (
    <>
      {view === "map" ? (
        <>
          <HoldStrip />
          <Panel
            icon={ICON.map}
            title="Zones"
            aside={`${snap.zones.length} zones · ${snap.proposals.filter((p) => p.status === "open").length} proposals open`}
          >
            <ZonesPanel />
          </Panel>
        </>
      ) : view === "calls" ? (
        <Panel icon={ICON.calls} title="Calls">
          <CallsPanel />
        </Panel>
      ) : view === "help" ? (
        <Panel icon={ICON.help} title={words.registry} aside="live location, helpers sent">
          {/* The registry rows with live location: source badge, the person's link, the helper sent, Send helper. */}
          <LiveRegistryProvider>
            <LiveRegistryPanel />
          </LiveRegistryProvider>
        </Panel>
      ) : view === "ledger" ? (
        <Panel icon={ICON.ledger} title="Ledger" aside={`${m.human_decisions} human decisions · ${m.refusals} refusals`}>
          <LedgerPanel />
        </Panel>
      ) : view === "feed" ? (
        <Panel icon={ICON.feed} title="Feed" aside={`${snap.feed.length} items, newest first`}>
          <FeedPanel />
        </Panel>
      ) : null}
      {/* Ask stays mounted in every view, so a pending answer survives a view switch. */}
      <div hidden={view !== "ask"} className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col [&[hidden]]:hidden">
        <Panel icon={ICON.ask} title="Ask the board" aside="read-only" tour={view === "ask" ? "side-panel" : "ask-panel"}>
          <div className="p-3">
            <AskBoard />
          </div>
        </Panel>
      </div>
    </>
  );
}

function Layout({ error, receivedAt }: { error: string | null; receivedAt: number | null }) {
  const { snap } = useBoard();
  const { view } = useBoardView();
  const badges = useNavBadges(view);
  return (
    <div className="flex h-dvh overflow-hidden bg-slate-100 text-slate-900">
      {/* The drawer comes first, so at phone width the tour finds its copy of a sidebar anchor before the hidden one. */}
      <BoardDrawer badges={badges} />
      <BoardSidebar badges={badges} />
      <div className="flex min-w-0 flex-1 flex-col">
        <BoardHeader />
        <MobileNav badges={badges} />
        {error ? <OfflineBanner error={error} receivedAt={receivedAt} /> : null}
        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:flex-row lg:overflow-hidden">
          <div
            data-tour="map"
            className="relative h-[46dvh] min-h-[300px] shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-slate-200 lg:h-auto lg:min-h-0 lg:flex-1"
          >
            <BoardMap variant="board" />
            <FeedTicker />
            <MapLegend mode={snap.meta.mode} />
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 lg:min-h-0 lg:w-[clamp(380px,33vw,560px)]">
            <ViewColumn view={view} />
          </div>
        </main>
      </div>
    </div>
  );
}

/** /board: the overnight supervisor's screen. Polls /api/board every second (each poll also advances the server's timers). */
export function BoardScreen() {
  const { data, error, receivedAt, refresh } = usePoll(getBoard, POLL_MS);
  if (!data) return <BoardWaiting error={error} />;
  const clockOffset = receivedAt ? Date.parse(data.now) - receivedAt : 0;
  return (
    <ToastProvider>
      <BoardProvider snap={data} refresh={refresh} clockOffset={clockOffset}>
        <Layout error={error} receivedAt={receivedAt} />
        <BoardTour />
        {/* "Play the full fire": ?autoplay=1 or the header button. */}
        <AutoplayOverlay />
      </BoardProvider>
    </ToastProvider>
  );
}
