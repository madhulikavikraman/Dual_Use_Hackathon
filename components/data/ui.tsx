"use client";

// Small shared UI for the data pages (/evidence, /twists, /demo). Client-only, no server imports.
import type { ReactNode } from "react";
import type { Cell, EvidenceStatus, EvidenceTable } from "@/lib/engine/evidence";

export const STATUS_TEXT: Record<EvidenceStatus, string> = {
  pass: "Pass",
  not_yet: "Not yet",
  no_data: "No data",
  info: "Measured",
};

const STATUS_CLASS: Record<EvidenceStatus, string> = {
  pass: "bg-emerald-100 text-emerald-900 ring-emerald-600/30 dark:bg-emerald-900/40 dark:text-emerald-200",
  not_yet: "bg-amber-100 text-amber-900 ring-amber-600/30 dark:bg-amber-900/40 dark:text-amber-200",
  no_data: "bg-neutral-100 text-neutral-700 ring-neutral-500/30 dark:bg-neutral-800 dark:text-neutral-300",
  info: "bg-sky-100 text-sky-900 ring-sky-600/30 dark:bg-sky-900/40 dark:text-sky-200",
};

export function StatusBadge({ status, className = "" }: { status: EvidenceStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset print:ring-neutral-400 ${STATUS_CLASS[status]} ${className}`}
    >
      {STATUS_TEXT[status]}
    </span>
  );
}

export function SimulatedBadge() {
  return (
    <span className="inline-flex items-center rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-black uppercase">
      Simulated
    </span>
  );
}

/** Local wall-clock time for an ISO timestamp, e.g. 03:41:07. */
export function clock(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function fmtCell(key: string, v: Cell | undefined): ReactNode {
  if (v === null || v === undefined || v === "") return <span className="text-neutral-400">—</span>;
  if (typeof v === "boolean") {
    return v ? (
      <span className="font-semibold text-emerald-700 dark:text-emerald-400">yes</span>
    ) : (
      <span className="font-semibold text-rose-700 dark:text-rose-400">no</span>
    );
  }
  if (typeof v === "string" && key.endsWith("_at")) return <span title={v}>{clock(v)}</span>;
  if (typeof v === "number" && !Number.isInteger(v)) return v.toFixed(key.includes("confidence") ? 2 : 1);
  if (typeof v === "number" && v >= 10_000) return v.toLocaleString();
  return String(v);
}

export function DataTable({ table, max }: { table: EvidenceTable; max?: number }) {
  const rows = max ? table.rows.slice(0, max) : table.rows;
  return (
    <div className="mt-3">
      <div className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        {table.title} <span className="font-normal normal-case">({table.rows.length} row{table.rows.length === 1 ? "" : "s"})</span>
      </div>
      {table.rows.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 dark:border-neutral-700">
          {table.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200 dark:border-neutral-800 print:overflow-visible">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400 print:bg-neutral-100">
              <tr>
                {table.columns.map((c) => (
                  <th key={c.key} className="px-2 py-1.5 font-semibold whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {rows.map((r, i) => (
                <tr key={i} className="align-top">
                  {table.columns.map((c) => (
                    <td key={c.key} className="px-2 py-1 tabular-nums">
                      {fmtCell(c.key, r[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {max && table.rows.length > max ? (
            <div className="border-t border-neutral-100 px-2 py-1 text-xs text-neutral-500 dark:border-neutral-800">
              Showing {max} of {table.rows.length}; the CSV has every row.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  tone = "default",
  title,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger" | "quiet";
  title?: string;
  className?: string;
}) {
  const tones = {
    default: "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800",
    primary: "border-sky-700 bg-sky-700 text-white hover:bg-sky-800",
    danger: "border-rose-700 bg-rose-700 text-white hover:bg-rose-800",
    quiet: "border-transparent bg-transparent text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800",
  } as const;
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 print:hidden ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

/** Render plain text with bare URLs turned into links. */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-sky-700 underline dark:text-sky-400">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
