"use client";

import { getBoard } from "@/lib/client/api";
import { fmtClock } from "@/lib/client/format";
import { usePoll } from "@/lib/client/usePoll";
import { ToastProvider } from "@/components/ui/Toast";
import { AskBoard } from "./AskBoard";
import { BoardProvider, useBoard } from "./BoardContext";
import { BoardHeader, MetricsStrip } from "./BoardHeader";
import { BoardMap } from "./BoardMap";
import { CallsStrip } from "./CallsStrip";
import { FeedTicker } from "./FeedPanel";
import { HoldStrip } from "./HoldStrip";
import { MapLegend } from "./MapLegend";
import { SidePanel } from "./SidePanel";

const POLL_MS = 1000;

/** Shown until the first snapshot arrives (or while /api/board cannot be reached). */
export function BoardWaiting({ error }: { error: string | null }) {
  return (
    <div className="grid h-dvh place-items-center bg-slate-100 p-6 text-slate-900">
      <div className="max-w-md text-center">
        <div className="text-2xl font-black tracking-tight">Second Key</div>
        <span className="mt-2 inline-block rounded bg-amber-400 px-2 py-0.5 text-xs font-black tracking-widest text-slate-950">SIMULATED</span>
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

function Layout() {
  const { snap } = useBoard();
  const holdOpen = snap.holds.some((h) => h.status === "open");
  return (
    <main className="flex min-h-0 flex-1 gap-3 p-3">
      <section className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-300 bg-slate-200">
          <BoardMap variant="board" />
          <FeedTicker />
          <MapLegend mode={snap.meta.mode} />
        </div>
        <CallsStrip />
      </section>
      <aside className="flex min-h-0 w-[clamp(470px,37vw,640px)] shrink-0 flex-col gap-3">
        <HoldStrip />
        {/* During a hold the column belongs to the hold; Ask stays mounted so a pending answer survives. */}
        <div hidden={holdOpen}>
          <AskBoard />
        </div>
        <SidePanel />
      </aside>
    </main>
  );
}

/** /board: the overnight supervisor's one screen. Polls /api/board every second (each poll also advances the server's timers). */
export function BoardScreen() {
  const { data, error, receivedAt, refresh } = usePoll(getBoard, POLL_MS);
  if (!data) return <BoardWaiting error={error} />;
  const clockOffset = receivedAt ? Date.parse(data.now) - receivedAt : 0;
  return (
    <ToastProvider>
      <BoardProvider snap={data} refresh={refresh} clockOffset={clockOffset}>
        <div className="flex h-dvh flex-col overflow-hidden bg-slate-100 text-slate-900">
          <BoardHeader />
          <MetricsStrip />
          {error ? <OfflineBanner error={error} receivedAt={receivedAt} /> : null}
          <Layout />
        </div>
      </BoardProvider>
    </ToastProvider>
  );
}
