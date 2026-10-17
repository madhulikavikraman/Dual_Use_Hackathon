"use client";

import { useState } from "react";
import { WORDING } from "@/lib/client/labels";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useBoard } from "./BoardContext";
import { FeedPanel } from "./FeedPanel";
import { LedgerPanel } from "./LedgerPanel";
import { RegistryPanel } from "./RegistryPanel";
import { ZonesPanel } from "./ZonesPanel";

type TabId = "zones" | "registry" | "feed" | "ledger";

function Count({ n, tone }: { n: number; tone: "warn" | "bad" | "neutral" }) {
  if (!n) return null;
  const color = tone === "bad" ? "bg-red-600 text-white" : tone === "warn" ? "bg-amber-400 text-slate-950" : "bg-slate-200 text-slate-800";
  return <span className={`rounded-full px-1.5 py-px text-xs font-bold tabular-nums ${color}`}>{n}</span>;
}

/** The right column's panels. The map stays visible whichever tab is open. */
export function SidePanel() {
  const { snap } = useBoard();
  const [tab, setTab] = useState<TabId>("zones");
  // Feed items newer than this are unread; set when the Feed tab is opened or left.
  const [feedSeenAt, setFeedSeenAt] = useState<string | null>(() => snap.feed[0]?.created_at ?? null);

  const openProposals = snap.proposals.filter((p) => p.status === "open").length;
  const lifeSafety = snap.registry.some((r) => r.priority === 1 && r.status !== "closed" && r.status !== "reached");
  const unread = tab === "feed" ? 0 : snap.feed.filter((f) => !feedSeenAt || f.created_at > feedSeenAt).length;

  const tabs: TabDef<TabId>[] = [
    { id: "zones", label: "Zones", badge: <Count n={openProposals} tone="warn" /> },
    { id: "registry", label: WORDING[snap.meta.mode].registry, badge: <Count n={snap.metrics.needs_help_open} tone={lifeSafety ? "bad" : "warn"} /> },
    { id: "feed", label: "Feed", badge: <Count n={unread} tone="neutral" /> },
    { id: "ledger", label: "Ledger", badge: <Count n={snap.metrics.refusals} tone="neutral" /> },
  ];

  function select(next: TabId) {
    if (tab === "feed" || next === "feed") setFeedSeenAt(snap.feed[0]?.created_at ?? feedSeenAt);
    setTab(next);
  }

  return (
    <section data-tour="side-panel" className="flex min-h-[132px] flex-1 flex-col overflow-hidden rounded-lg border border-slate-300 bg-white">
      <Tabs label="Board panels" tabs={tabs} value={tab} onChange={select} />
      {/* Keyed by tab, so each tab opens scrolled to the top. */}
      <div key={tab} role="tabpanel" className="min-h-0 flex-1 overflow-y-auto">
        {tab === "zones" ? <ZonesPanel /> : tab === "registry" ? <RegistryPanel /> : tab === "feed" ? <FeedPanel /> : <LedgerPanel />}
      </div>
    </section>
  );
}
