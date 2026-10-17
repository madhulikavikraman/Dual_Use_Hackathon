"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Evidence, EvidenceItem } from "@/lib/engine/evidence";
import { FUNDING } from "./funding";
import { Button, DataTable, SimulatedBadge, StatusBadge, clock, fmtCell } from "./ui";

const REFRESH_MS = 5000;

function MilestoneCard({ m }: { m: EvidenceItem }) {
  return (
    <a
      href={`#${m.id}`}
      className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 print:break-inside-avoid print:shadow-none"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-bold text-neutral-500">{m.id === "SAFETY" ? "Safety bar" : `Milestone ${m.id.slice(1)}`}</span>
        <StatusBadge status={m.status} />
      </div>
      <div className="text-sm font-semibold leading-snug">{m.title}</div>
      <div className="text-base leading-snug font-medium text-neutral-900 dark:text-neutral-50">{m.value}</div>
      <div className="mt-auto text-xs text-neutral-500">Target: {m.target}</div>
    </a>
  );
}

function ItemDetail({ m, compact = false }: { m: EvidenceItem; compact?: boolean }) {
  return (
    <section id={m.id} className="scroll-mt-4 border-t border-neutral-200 pt-5 dark:border-neutral-800 print:break-inside-avoid-page">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          <span className="mr-2 font-mono text-sm text-neutral-500">{m.id}</span>
          {m.title}
        </h2>
        <StatusBadge status={m.status} />
      </div>
      <p className="mt-1 text-sm text-neutral-600 italic dark:text-neutral-400">{m.question}</p>
      <div className="mt-2 grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
        <div className="text-neutral-500">Value</div>
        <div className="font-medium">{m.value}</div>
        <div className="text-neutral-500">Target</div>
        <div>{m.target}</div>
        {m.note ? (
          <>
            <div className="text-neutral-500">Note</div>
            <div>{m.note}</div>
          </>
        ) : null}
      </div>
      {m.figures.length ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {m.figures.map((f) => (
            <div key={f.label} className="rounded border border-neutral-200 px-3 py-2 dark:border-neutral-800">
              <dt className="flex items-center justify-between gap-1 text-[11px] text-neutral-500">
                <span>{f.label}</span>
                {f.status ? <StatusBadge status={f.status} className="scale-90" /> : null}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">{fmtCell("", f.value)}</dd>
              {f.target ? <dd className="text-[11px] text-neutral-500">target {f.target}</dd> : null}
            </div>
          ))}
        </dl>
      ) : null}
      {m.tables.map((t) => (
        <DataTable key={t.title} table={t} max={compact ? 12 : 40} />
      ))}
      <p className="mt-2 text-xs text-neutral-500">
        <span className="font-semibold">How it is computed.</span> {m.method}
      </p>
    </section>
  );
}

function MeasureRow({ m }: { m: EvidenceItem }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="align-top">
        <td className="px-2 py-1.5 font-mono text-xs text-neutral-500">{m.id}</td>
        <td className="px-2 py-1.5 font-medium">{m.title}</td>
        <td className="px-2 py-1.5">{m.value}</td>
        <td className="px-2 py-1.5 text-neutral-600 dark:text-neutral-400">{m.target}</td>
        <td className="px-2 py-1.5">
          <StatusBadge status={m.status} />
        </td>
        <td className="px-2 py-1.5 print:hidden">
          {m.tables.some((t) => t.rows.length) ? (
            <button type="button" className="text-xs text-sky-700 underline dark:text-sky-400" onClick={() => setOpen((o) => !o)}>
              {open ? "Hide rows" : "Rows"}
            </button>
          ) : null}
        </td>
      </tr>
      <tr className={open ? "" : "hidden print:table-row"}>
        <td colSpan={6} className="px-2 pb-3">
          {m.tables.map((t) => (
            <DataTable key={t.title} table={t} max={25} />
          ))}
          <p className="mt-1 text-xs text-neutral-500">{m.method}</p>
        </td>
      </tr>
    </>
  );
}

export default function EvidenceView() {
  const [data, setData] = useState<Evidence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [lastOk, setLastOk] = useState<string | null>(null);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch("/api/evidence", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setData(body as Evidence);
      setError(null);
      setLastOk(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    // The first load runs on mount; then refresh every 5 s unless paused.
    const first = setTimeout(load, 0);
    if (paused) return () => clearTimeout(first);
    const t = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load, paused]);

  const milestones = data?.milestones ?? [];
  const passed = data?.summary.passed ?? 0;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 print:max-w-none print:px-0 print:py-0 print:text-black">
      <style>{`@media print { body { background: #fff !important; color: #000 !important; } a { text-decoration: none; } }`}</style>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <SimulatedBadge />
            <span>Twist 1 · NSF SBIR Phase I</span>
            <span aria-hidden>·</span>
            <span>Second Key</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Phase I evidence — measured live from this run</h1>
          <p className="mt-1 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
            The three milestones an NSF SBIR Phase I grant would pay for, and the safety bar on all three, computed from the holds,
            canaries, intents, calls, registry and ledger of the run on the board. Every send is simulated; synthetic rows are
            labeled and real phones are counted separately.
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {data ? (
              <>
                Updated {clock(lastOk)} · {paused ? "auto-refresh paused" : "refreshes every 5 s"} · scenario {data.scenario} ·{" "}
                {data.backend} store · generated {data.generated_at}
              </>
            ) : error ? null : (
              "Loading…"
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button tone="quiet" onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume" : "Pause"}
          </Button>
          <a
            href="/api/evidence?format=csv"
            className="inline-flex items-center rounded-md border border-sky-700 bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800"
          >
            Download CSV
          </a>
          <a
            href="/api/evidence?download=1"
            className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            Download JSON
          </a>
          <Button onClick={() => window.print()}>Print</Button>
        </div>
      </header>

      {error ? (
        <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200 print:hidden">
          Could not refresh the evidence: {error}. {data ? "Showing the last good numbers." : ""}
        </div>
      ) : null}

      {data ? (
        <>
          <section className="mt-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">
                {passed} of {milestones.length} Phase I bars met in this run
              </h2>
              <span className="text-xs text-neutral-500">
                {data.run.holds} holds ({data.run.holds_sent} sent) · {data.run.calls} calls rang ({data.run.calls_real} real phones,{" "}
                {data.run.calls_synthetic} synthetic) · {data.run.intents} intents · {data.run.registry_rows} registry rows ·{" "}
                {data.run.ledger_lines} ledger lines
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {milestones.map((m) => (
                <MilestoneCard key={m.id} m={m} />
              ))}
            </div>
          </section>

          <div className="mt-6 flex flex-col gap-6">
            {milestones.map((m) => (
              <ItemDetail key={m.id} m={m} compact={m.id === "M2"} />
            ))}
          </div>

          <section className="mt-8 border-t border-neutral-200 pt-5 dark:border-neutral-800 print:break-inside-avoid-page">
            <h2 className="text-lg font-semibold">Also measured</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              The demo success metrics from PRD section 3 that support the milestones.
            </p>
            <div className="mt-2 overflow-x-auto rounded border border-neutral-200 dark:border-neutral-800">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
                  <tr>
                    <th className="px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">Measure</th>
                    <th className="px-2 py-1.5">Value</th>
                    <th className="px-2 py-1.5">Target</th>
                    <th className="px-2 py-1.5">Status</th>
                    <th className="px-2 py-1.5 print:hidden" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {data.measures.map((m) => (
                    <MeasureRow key={m.id} m={m} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <section className="mt-8 border-t border-neutral-200 pt-5 dark:border-neutral-800 print:break-inside-avoid-page">
        <h2 className="text-lg font-semibold">Funding pathway (Twist 1)</h2>
        <p className="mt-1 max-w-4xl text-sm">{FUNDING.one_line}</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {FUNDING.legs.map((l) => (
            <div key={l.leg} className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800 print:break-inside-avoid">
              <div className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{l.leg}</div>
              <div className="mt-1 font-semibold">{l.program}</div>
              <div className="mt-1 text-neutral-600 dark:text-neutral-400">{l.who}</div>
              <div className="mt-2">{l.size}</div>
              <div className="mt-2 text-neutral-600 dark:text-neutral-400">{l.fit}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 max-w-4xl text-sm text-neutral-700 dark:text-neutral-300">{FUNDING.milestones_note}</p>
        <h3 className="mt-4 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Sources (verified Oct 17, 2026)</h3>
        <ul className="mt-1 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {FUNDING.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="text-sky-700 underline dark:text-sky-400">
                {s.label}
              </a>
              <span className="hidden break-all text-xs text-neutral-500 print:inline"> {s.url}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-neutral-500">
          PRD section 17.1; decisions D-26 to D-28. The twist log is on <Link href="/twists" className="underline">/twists</Link>; the demo
          console is on <Link href="/demo" className="underline">/demo</Link>.
        </p>
      </section>
    </main>
  );
}
