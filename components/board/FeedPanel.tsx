"use client";

import { useState } from "react";
import { fmtAgo, fmtTime } from "@/lib/client/format";
import { FEED_KIND_LABEL, SEVERITY_TONE, type Tone } from "@/lib/client/labels";
import type { AlertItem } from "@/lib/types";
import { Emoji } from "@/lib/ui/Emoji";
import { FEED_ICON, ICON } from "@/lib/ui/icons";
import { Chip } from "@/components/ui/Chip";
import { useBoard } from "./BoardContext";

const CARD: Record<Tone, string> = {
  neutral: "border-l-slate-300 bg-white",
  info: "border-l-blue-500 bg-white",
  good: "border-l-green-600 bg-white",
  warn: "border-l-amber-500 bg-amber-50",
  bad: "border-l-red-600 bg-red-50",
};

function FeedCard({ item, now, onDismiss, compact = false }: { item: AlertItem; now: string; onDismiss?: () => void; compact?: boolean }) {
  const tone = SEVERITY_TONE[item.severity];
  return (
    <article className={`rounded-md border border-l-4 border-slate-200 px-3 ${compact ? "py-1.5" : "py-2"} ${CARD[tone]}`}>
      <header className="flex items-center gap-2">
        <Chip tone={tone}>
          <Emoji e={FEED_ICON[item.kind] ?? ICON.feed} />
          {FEED_KIND_LABEL[item.kind] ?? item.kind}
        </Chip>
        {item.zone_id ? <span className="font-mono text-xs text-slate-500">{item.zone_id}</span> : null}
        <time className="ml-auto text-xs text-slate-500" dateTime={item.created_at} title={fmtTime(item.created_at)}>
          {fmtAgo(item.created_at, now)}
        </time>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-base leading-none text-slate-400 hover:text-slate-900">
            ×
          </button>
        ) : null}
      </header>
      <h3 className={`mt-1 font-semibold leading-snug text-slate-900 ${compact ? "line-clamp-2 text-sm" : "text-[15px]"}`}>{item.title}</h3>
      {item.detail ? (
        <p className={`mt-0.5 leading-snug text-slate-700 ${compact ? "line-clamp-2 text-[13px]" : "text-sm"}`} title={compact ? item.detail : undefined}>
          {item.detail}
        </p>
      ) : null}
    </article>
  );
}

/** Everything the system noticed, newest first: proposals, clusters, silence, canary results, hand-offs. */
export function FeedPanel() {
  const { snap } = useBoard();
  if (!snap.feed.length) return <p className="p-4 text-sm text-slate-500">Nothing in the feed yet.</p>;
  return (
    <div className="space-y-2 p-3">
      {snap.feed.map((item) => (
        <FeedCard key={item.id} item={item} now={snap.now} />
      ))}
    </div>
  );
}

const TICKER_WINDOW_MS = 120_000;

/** The newest warning floats over the map for two minutes, so the room sees it land. */
export function FeedTicker() {
  const { snap } = useBoard();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const now = Date.parse(snap.now);
  const items = snap.feed.filter(
    (f) => f.severity !== "info" && now - Date.parse(f.created_at) < TICKER_WINDOW_MS && !dismissed.includes(f.id),
  );
  if (!items.length) return null;
  const [newest, ...rest] = items;
  return (
    <div data-tour="feed-ticker" className="pointer-events-auto absolute left-3 top-3 z-[1000] w-[min(380px,calc(100%-5rem))] shadow-lg">
      <FeedCard item={newest} now={snap.now} compact onDismiss={() => setDismissed((d) => [...d, newest.id])} />
      {rest.length ? (
        <p className="mt-1 w-fit rounded bg-white/95 px-2 py-0.5 text-xs font-semibold text-slate-700 shadow">
          +{rest.length} more in the <Emoji e={ICON.feed} /> Feed
        </p>
      ) : null}
    </div>
  );
}
