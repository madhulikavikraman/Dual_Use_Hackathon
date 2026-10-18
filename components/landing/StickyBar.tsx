"use client";

// A slim bar that slides in once the hero's buttons have scrolled out of view, so "Start the guided tour" is always
// one click away on a long page. It is position: fixed (no layout shift). While hidden it is inert and aria-hidden,
// so its links never sit in the tab order or the accessibility tree off screen.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { m } from "motion/react";
import { MotionRoot } from "./MotionRoot";
import { motionTokens as T } from "./motion";

export function StickyBar({ watchId }: { watchId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = document.getElementById(watchId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    io.observe(target);
    return () => io.disconnect();
  }, [watchId]);

  return (
    <MotionRoot>
      <m.div
        className={`fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-vf-ink/95 ${show ? "" : "pointer-events-none"}`}
        initial={false}
        animate={show ? { y: 0, opacity: 1 } : { y: "-100%", opacity: 0 }}
        transition={{ duration: T.duration.normal, ease: T.easing.smooth }}
        inert={!show}
        aria-hidden={!show}
      >
        <nav aria-label="Quick links" className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <a
            href="#top"
            className="flex min-w-0 items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vf-ember"
          >
            <Image src="/brand/voiceflare-mark.png" alt="" width={822} height={822} sizes="28px" className="size-7 shrink-0" />
            <Image
              src="/brand/voiceflare-wordmark.png"
              alt="VoiceFlare, back to top"
              width={941}
              height={94}
              sizes="132px"
              className="hidden h-auto w-[132px] min-[400px]:block"
            />
            <span className="sr-only min-[400px]:hidden">VoiceFlare, back to top</span>
          </a>
          <div className="flex items-center gap-2">
            <Link
              href="/board"
              className="hidden min-h-9 items-center rounded-md px-3 text-sm font-semibold text-vf-bone transition-colors hover:text-vf-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember sm:inline-flex"
            >
              Open the board
            </Link>
            <Link
              href="/board?tour=1"
              className="vf-cta vf-cta-primary relative inline-flex min-h-9 items-center gap-1.5 px-3.5 text-sm font-semibold text-vf-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vf-ember"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" focusable="false">
                <path d="M4.5 2.6v10.8l8.6-5.4z" fill="currentColor" />
              </svg>
              Start the guided tour
            </Link>
          </div>
        </nav>
      </m.div>
    </MotionRoot>
  );
}
