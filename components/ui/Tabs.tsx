"use client";

import type { ReactNode } from "react";

export interface TabDef<T extends string> {
  id: T;
  label: ReactNode;
  badge?: ReactNode;
}

/** A row of tabs; the caller renders the selected panel. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex shrink-0 gap-1 border-b border-slate-200 px-2 pt-2">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`-mb-px flex items-center gap-1.5 rounded-t-md border px-3 py-2 text-sm font-semibold transition-colors ${
              active
                ? "border-slate-200 border-b-white bg-white text-slate-900"
                : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {t.label}
            {t.badge}
          </button>
        );
      })}
    </div>
  );
}
