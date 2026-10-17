"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastTone = "good" | "warn" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  text: string;
}

type Push = (text: string, tone?: ToastTone) => void;
const ToastContext = createContext<Push>(() => {});

const TONE: Record<ToastTone, string> = {
  good: "border-l-green-600",
  warn: "border-l-amber-500",
  info: "border-l-blue-600",
};

/** Short confirmations and errors, bottom-right, above the map. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const push = useCallback<Push>(
    (text, tone = "info") => {
      const id = nextId.current++;
      setItems((xs) => [...xs.slice(-3), { id, tone, text }]);
      setTimeout(() => dismiss(id), tone === "warn" ? 10_000 : 5_000);
    },
    [dismiss],
  );

  return (
    <ToastContext value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[1500] flex w-[400px] max-w-[calc(100vw-2rem)] flex-col gap-2 print:hidden">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "warn" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-l-4 border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-lg ${TONE[t.tone]}`}
          >
            <span className="min-w-0 flex-1">{t.text}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-slate-400 hover:text-slate-900">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export const useToast = () => useContext(ToastContext);
