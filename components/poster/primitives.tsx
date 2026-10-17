// Small building blocks for the printed poster (/poster): the emblem's signal arcs, section heads, chips and a
// QR code rendered to an SVG string on the server. Server components only.
import QRCode from "qrcode";
import type { ReactNode } from "react";

/** The emblem's signal arcs: `rings` arcs either side of a centre, opening upward like a broadcast. */
export function Arcs({
  className = "",
  rings = 2,
  stroke = 7,
  dot = true,
}: {
  className?: string;
  rings?: number;
  stroke?: number;
  dot?: boolean;
}) {
  const cx = 100;
  const cy = 112;
  const pt = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  };
  const arc = (r: number, a1: number, a2: number) => `M ${pt(r, a1)} A ${r} ${r} 0 0 1 ${pt(r, a2)}`;
  const radii = Array.from({ length: rings }, (_, i) => 30 + i * (78 / Math.max(rings, 1)));
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden fill="none">
      {radii.map((r) => (
        <g key={r} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round">
          <path d={arc(r, 212, 252)} />
          <path d={arc(r, 288, 328)} />
        </g>
      ))}
      {dot ? <circle cx={cx} cy={cy - 6} r={stroke * 1.1} fill="currentColor" /> : null}
    </svg>
  );
}

/** Numbered section head: arcs, number, title, optional kicker on the right. */
export function SectionHead({ n, title, kicker }: { n?: string; title: string; kicker?: string }) {
  return (
    <div className="mb-[14px] flex items-end gap-[16px] border-b border-vf-ash pb-[10px]">
      <Arcs className="mb-[6px] h-[30px] w-[50px] shrink-0 text-vf-flare" stroke={11} />
      {n ? <span className="pb-[3px] font-mono text-[28px] font-semibold leading-none text-vf-flare">{n}</span> : null}
      <h2 className="whitespace-nowrap font-display text-[52px] font-bold uppercase leading-[0.9] tracking-[0.01em] text-vf-bone">
        {title}
      </h2>
      {kicker ? (
        <span className="ml-auto min-w-0 truncate pb-[4px] font-mono text-[22px] uppercase leading-none tracking-[0.14em] text-vf-ember">
          {kicker}
        </span>
      ) : null}
    </div>
  );
}

export function Section({
  n,
  title,
  kicker,
  className = "",
  children,
}: {
  n?: string;
  title: string;
  kicker?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-[26px] border border-vf-ash bg-vf-coal/85 px-[28px] pb-[22px] pt-[18px] ${className}`}>
      <SectionHead n={n} title={title} kicker={kicker} />
      {children}
    </section>
  );
}

export function Chip({ children, tone = "ash" }: { children: ReactNode; tone?: "ash" | "flare" | "solid" }) {
  const toneClass =
    tone === "flare"
      ? "border-vf-flare/60 bg-vf-flare/10 text-vf-bone"
      : tone === "solid"
        ? "border-vf-flare bg-vf-flare text-vf-ink font-semibold"
        : "border-vf-ash bg-vf-ink/70 text-vf-bone";
  return (
    <span className={`inline-flex items-center rounded-full border-2 px-[16px] py-[3px] text-[28px] leading-[1.2] ${toneClass}`}>
      {children}
    </span>
  );
}

/** A QR code as an inline SVG string, rendered on the server (qrcode's string renderer is synchronous). */
export function QrCode({ value, className = "" }: { value: string; className?: string }) {
  let svg = "";
  QRCode.toString(
    value,
    { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#050505ff", light: "#f5f5f4ff" } },
    (err, s) => {
      if (!err) svg = s;
    },
  );
  return (
    <div
      role="img"
      aria-label={`QR code: ${value}`}
      className={`[&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** "https://www.cbsnews.com/losangeles/" -> "cbsnews.com". */
export function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
