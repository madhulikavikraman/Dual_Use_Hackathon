// Shared building blocks for the landing page (server components): the page width, the section frame, the two
// button styles (cut corners like the emblem, drawn in app/globals.css under .vf-cta), external links, route names
// and small icons.
import Link from "next/link";
import type { ReactNode } from "react";

export function Container({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

/** A page section with a real h2 (id `${id}-title`) and an optional one-paragraph lede. */
export function Section({
  id,
  title,
  lede,
  className = "",
  children,
}: {
  id: string;
  title: string;
  lede?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`scroll-mt-16 py-20 sm:py-28 ${className}`}>
      <Container>
        <h2
          id={`${id}-title`}
          className="max-w-[22ch] text-balance font-display text-[clamp(2rem,1.35rem+2.3vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.02em] text-vf-bone"
        >
          {title}
        </h2>
        {lede ? <p className="mt-5 max-w-[62ch] text-lg leading-relaxed text-vf-smoke">{lede}</p> : null}
        {children}
      </Container>
    </section>
  );
}

const CTA_BASE =
  "vf-cta relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[color,translate,filter] duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vf-ember active:translate-y-px";

/** A link styled as a button. Primary: flare with ink text (5.4:1). Secondary: outlined, bone text. */
export function Cta({
  href,
  children,
  variant = "primary",
  size = "md",
  icon,
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  size?: "md" | "sm";
  icon?: ReactNode;
  className?: string;
}) {
  const sizing = size === "md" ? "min-h-12 px-5 text-[15px]" : "min-h-10 px-4 text-sm";
  const look = variant === "primary" ? "vf-cta-primary text-vf-ink" : "vf-cta-secondary text-vf-bone";
  return (
    <Link href={href} className={`${CTA_BASE} ${sizing} ${look} ${className}`}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}

export function ExternalLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-vf-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf-ember ${className}`}
    >
      {children}
      <ExternalIcon />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/** "https://www.cbsnews.com/losangeles/" -> "cbsnews.com" */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** A route people type or open, e.g. /board. */
export function Route({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.86em] text-vf-ember">{children}</code>;
}

export function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden="true" focusable="false">
      <path d="M4.5 2.6v10.8l8.6-5.4z" fill="currentColor" />
    </svg>
  );
}

export function ExternalIcon() {
  return (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0 opacity-70" aria-hidden="true" focusable="false">
      <path d="M4.5 2.5h5v5M9.5 2.5 3 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-4 shrink-0 ${className}`} aria-hidden="true" focusable="false">
      <path d="M8 1.5 13.5 3.6v4c0 3.2-2.3 5.7-5.5 6.9C4.8 13.3 2.5 10.8 2.5 7.6v-4z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="m5.6 8 1.7 1.7L10.6 6.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
