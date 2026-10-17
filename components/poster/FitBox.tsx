"use client";

// Keeps the poster inside its 24 x 36 in box: if the content grows taller than the page (for example when the
// lead fills lib/stories.ts with more incidents), it zooms the content down just enough to fit. A no-op when
// everything already fits, which is the case the layout is designed for.
import { useLayoutEffect, useRef, type ReactNode } from "react";

export function FitBox({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.zoom = "1";
      const avail = el.parentElement?.clientHeight ?? 0;
      const need = el.scrollHeight;
      el.dataset.need = String(need);
      if (avail > 0 && need > avail + 1) el.style.zoom = String(Math.floor(((avail - 6) / need) * 1000) / 1000);
    };
    fit();
    document.fonts?.ready.then(fit).catch(() => {});
    const timers = [300, 1500].map((ms) => window.setTimeout(fit, ms));
    window.addEventListener("load", fit);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("load", fit);
    };
  }, []);

  return (
    <div ref={ref} className="relative mx-auto">
      {children}
    </div>
  );
}
