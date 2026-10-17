// The emblem's signal arcs, repeated outward around the logo: each ring of arcs brightens in turn, like a call going
// out (.vf-arc in app/globals.css, pure CSS, no JavaScript). With reduced motion the arcs hold still.

/** Angular spans in degrees, left and right of the spire, matching the arcs drawn in the emblem. */
const SPANS: [number, number][] = [
  [115, 150],
  [30, 65],
];
/** Radii in viewBox units; the viewBox is 200 wide, centred on the emblem's arcs. */
const RINGS = [58, 76, 94];

function arc(r: number, from: number, to: number): string {
  const at = (deg: number) => [r * Math.cos((deg * Math.PI) / 180), -r * Math.sin((deg * Math.PI) / 180)].map((v) => v.toFixed(2));
  const [x0, y0] = at(from);
  const [x1, y1] = at(to);
  return `M${x0} ${y0}A${r} ${r} 0 0 0 ${x1} ${y1}`;
}

export function SignalArcs({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="-100 -100 200 200" fill="none" className={className} aria-hidden="true" focusable="false">
      {RINGS.map((r, i) => (
        <g
          key={r}
          className="vf-arc"
          style={{ animationDelay: `${i * 0.5}s` }}
          stroke="currentColor"
          strokeWidth={2.8 - i * 0.5}
          strokeLinecap="round"
        >
          {SPANS.map(([from, to]) => (
            <path key={from} d={arc(r, from, to)} />
          ))}
        </g>
      ))}
    </svg>
  );
}
