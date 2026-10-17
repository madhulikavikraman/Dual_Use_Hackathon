import type { ReactNode } from "react";
import type { Tone } from "@/lib/client/labels";

const TONE: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-300",
  info: "bg-blue-50 text-blue-800 ring-blue-200",
  good: "bg-green-50 text-green-800 ring-green-300",
  warn: "bg-amber-50 text-amber-900 ring-amber-300",
  bad: "bg-red-50 text-red-800 ring-red-300",
};

/** A small status pill. */
export function Chip({
  tone = "neutral",
  className = "",
  title,
  children,
}: {
  tone?: Tone;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** A pill filled with an exact color (zone states, priorities). */
export function ColorChip({
  color,
  text = "#ffffff",
  className = "",
  title,
  children,
}: {
  color: string;
  text?: string;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      style={{ backgroundColor: color, color: text }}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${className}`}
    >
      {children}
    </span>
  );
}
