"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A modal on the native <dialog> element: it sits in the browser's top layer (above the map),
 * traps focus and closes on Escape. Mount it to open it; unmount it to close it.
 */
export function Dialog({
  title,
  subtitle,
  onClose,
  size = "md",
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const width = size === "lg" ? "w-[min(760px,calc(100vw-2rem))]" : size === "sm" ? "w-[min(440px,calc(100vw-2rem))]" : "w-[min(580px,calc(100vw-2rem))]";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className={`m-auto max-h-[calc(100dvh-2rem)] ${width} overflow-hidden rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/55`}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold leading-snug">
              {title}
            </h2>
            {subtitle ? <div className="mt-0.5 text-sm text-slate-600">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-md px-2 py-0.5 text-2xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </dialog>
  );
}
