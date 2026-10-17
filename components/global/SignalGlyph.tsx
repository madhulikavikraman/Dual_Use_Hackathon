/** The emblem's flare spike and signal arcs as a small inline glyph (decorative). With `pulse`, the arcs light up
 *  inner to outer once, like a signal going out; remount it (change its key) to send the pulse again. */
export default function SignalGlyph({ className = "", pulse = false }: { className?: string; pulse?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 24"
      aria-hidden="true"
      focusable="false"
      className={`${pulse ? "vfg-arcs " : ""}${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
    >
      <path className="vfg-arc-1" d="M16.48 19.26A8 8 0 0 1 20.62 14.75" />
      <path className="vfg-arc-1" d="M27.38 14.75A8 8 0 0 1 31.52 19.26" />
      <path className="vfg-arc-2" d="M10.84 17.21A14 14 0 0 1 18.08 9.31" />
      <path className="vfg-arc-2" d="M29.92 9.31A14 14 0 0 1 37.16 17.21" />
      <path d="M24 2.5L25.7 22H22.3Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
