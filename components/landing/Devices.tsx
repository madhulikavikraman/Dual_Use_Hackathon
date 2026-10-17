// Small schematic drawings of each demo screen for "What's on the screens": shapes only, no text, so a visitor
// recognises the real screen when they open it. Decorative (aria-hidden); the words around them carry the meaning.
// Colours follow the board's own: zone states grey, yellow, orange, red; help priorities red, orange, yellow, violet.

const FRAME = "#2e2e35";
const GLASS = "#0b0b0e";
const PANEL = "#131317";
const LINE = "#3f3f46";
const TEXT = "#d4d4d8";

const svgProps = { "aria-hidden": true, focusable: false } as const;

/** /board: header, metrics, map with zones and the hold strip, side panel, live-calls strip. */
export function BoardMini() {
  const metrics = [1, 21, 41, 61, 81, 101, 121, 141];
  return (
    <svg viewBox="0 0 160 90" className="block h-auto w-full" {...svgProps}>
      <rect width="160" height="90" fill={GLASS} />
      <rect width="160" height="7" fill="#17171c" />
      <rect x="3" y="2.3" width="12" height="2.4" rx="0.5" fill="#f5f5f4" />
      <rect x="17" y="2.3" width="9" height="2.4" rx="0.5" fill="#fbbf24" />
      <rect x="28" y="2" width="17" height="3" rx="0.6" fill="#26262c" />
      <rect x="114" y="2.3" width="12" height="2.4" rx="0.5" fill={TEXT} />
      <rect x="129" y="1.9" width="17" height="3.2" rx="0.6" fill="none" stroke="#fbbf24" strokeWidth="0.5" />
      <rect x="149" y="2.3" width="8" height="2.4" rx="0.5" fill="#a3a3ad" />
      {metrics.map((x, i) => (
        <g key={x}>
          <rect x={x} y="8" width="19" height="6" fill={PANEL} />
          <rect x={x + 1.5} y="9" width="8" height="1" rx="0.3" fill="#52525b" />
          <rect x={x + 1.5} y="10.8" width={i === 3 ? 4 : 6.5} height="2" rx="0.4" fill={i === 3 ? "#ef4444" : "#e4e4e7"} />
        </g>
      ))}
      {/* Map with zones on the ladder: order red, warning orange, proposals dashed, watch yellow, monitor grey. */}
      <rect x="1" y="15" width="99" height="63" fill="#18181d" />
      <path d="M8 42 20 31 31 39 25 52 12 52Z" fill="#dc2626" fillOpacity="0.55" stroke="#dc2626" strokeWidth="0.7" />
      <path d="M25 52 31 39 43 45 41 60 28 62Z" fill="#f97316" fillOpacity="0.45" stroke="#f97316" strokeWidth="0.7" />
      <path d="M20 31 31 23 43 27 43 45 31 39Z" fill="none" stroke="#dc2626" strokeWidth="0.8" strokeDasharray="2 1.4" />
      <path d="M43 45 57 41 65 51 57 63 41 60Z" fill="none" stroke="#f97316" strokeWidth="0.8" strokeDasharray="2 1.4" />
      <path d="M43 27 61 23 73 33 65 51 57 41 43 45Z" fill="#eab308" fillOpacity="0.28" stroke="#eab308" strokeWidth="0.6" />
      <path d="M73 33 85 29 91 41 81 49 65 51Z" fill="#eab308" fillOpacity="0.2" stroke="#eab308" strokeWidth="0.6" />
      <path d="M85 29 96 27 98 39 91 41Z" fill="#9ca3af" fillOpacity="0.25" stroke="#9ca3af" strokeWidth="0.6" />
      {[
        [18, 44, "#16a34a"],
        [23, 38, "#f59e0b"],
        [33, 52, "#f59e0b"],
        [36, 56, "#dc2626"],
        [49, 50, "#2563eb"],
        [54, 55, "#16a34a"],
        [60, 47, "#2563eb"],
        [29, 47, "#16a34a"],
      ].map(([cx, cy, fill]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" fill={fill as string} stroke={GLASS} strokeWidth="0.4" />
      ))}
      {/* The hold strip: a red-edged bar with its ring. */}
      <rect x="4" y="17.5" width="64" height="8.5" rx="1" fill="#0e0e11" stroke="#ff2a12" strokeWidth="0.7" />
      <circle cx="9.2" cy="21.75" r="2.5" fill="none" stroke="#ff2a12" strokeWidth="0.9" strokeDasharray="10 6" />
      <rect x="14" y="19.6" width="22" height="1.8" rx="0.4" fill="#f5f5f4" />
      <rect x="14" y="22.6" width="34" height="1.4" rx="0.4" fill="#a3a3ad" />
      <rect x="52" y="19.4" width="13" height="4.6" rx="0.8" fill="#ff2a12" />
      {/* Side panel: Ask the board, tabs, zone cards. */}
      <rect x="102" y="15" width="57" height="74" fill={PANEL} />
      <rect x="104" y="17" width="44" height="4" rx="0.8" fill="#1d1d23" stroke={LINE} strokeWidth="0.4" />
      <rect x="150" y="17" width="7" height="4" rx="0.8" fill="#26262c" />
      {[104, 116, 128, 140].map((x, i) => (
        <rect key={x} x={x} y="23.5" width="10" height="1.6" rx="0.4" fill={i === 0 ? "#f5f5f4" : "#52525b"} />
      ))}
      <rect x="104" y="26" width="10" height="0.6" fill="#ff2a12" />
      {[
        [29, "#dc2626"],
        [45, "#f97316"],
        [61, "#f97316"],
        [77, "#eab308"],
      ].map(([y, c]) => (
        <g key={y as number}>
          <rect x="104" y={y as number} width="53" height="13" rx="0.8" fill="#17171c" />
          <rect x="104" y={y as number} width="1" height="13" fill={c as string} />
          <rect x="107" y={(y as number) + 2.5} width="22" height="1.8" rx="0.4" fill="#e4e4e7" />
          <rect x="139" y={(y as number) + 2.2} width="15" height="2.6" rx="1" fill={c as string} fillOpacity="0.85" />
          <rect x="107" y={(y as number) + 6.2} width="40" height="1.2" rx="0.4" fill="#52525b" />
          <rect x="107" y={(y as number) + 9.2} width="13" height="2.4" rx="0.5" fill="#26262c" />
        </g>
      ))}
      {/* Live calls strip. */}
      <rect x="1" y="80" width="99" height="9" fill={PANEL} />
      <rect x="4" y="82.3" width="18" height="1.6" rx="0.4" fill="#e4e4e7" />
      <rect x="24" y="82.3" width="50" height="1.4" rx="0.4" fill="#52525b" />
      <rect x="4" y="85.4" width="60" height="1.2" rx="0.4" fill="#3f3f46" />
    </svg>
  );
}

const ROLE_TONE = { resident: "#38bdf8", sentinel: "#a78bfa", canary: "#fbbf24" } as const;
export type PhoneTone = keyof typeof ROLE_TONE;

/** /phone/[id]: a ringing browser phone, coloured by the role it plays (as on /phones). */
export function PhoneMini({ tone }: { tone: PhoneTone }) {
  const c = ROLE_TONE[tone];
  return (
    <svg viewBox="0 0 44 88" className="block h-auto w-full" {...svgProps}>
      <rect x="1" y="1" width="42" height="86" rx="8" fill={GLASS} stroke={FRAME} strokeWidth="1.2" />
      <rect x="17.5" y="4.5" width="9" height="2" rx="1" fill={FRAME} />
      <g stroke={c} strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M17.6 30.4a6.2 6.2 0 0 0 0 8.8" />
        <path d="M26.4 30.4a6.2 6.2 0 0 1 0 8.8" />
        <path d="M14.4 27.2a10.6 10.6 0 0 0 0 15.2" opacity="0.6" />
        <path d="M29.6 27.2a10.6 10.6 0 0 1 0 15.2" opacity="0.6" />
      </g>
      <circle cx="22" cy="34.8" r="2.6" fill={c} />
      <rect x="9" y="52" width="26" height="2.2" rx="1" fill={LINE} />
      <rect x="12" y="57" width="20" height="1.8" rx="0.9" fill="#27272a" />
      <rect x="9" y="70" width="26" height="8" rx="4" fill={c} fillOpacity="0.85" />
    </svg>
  );
}

/** /qrt: the registry map beside the list, rows by priority (P1 red, P2 orange, P3 yellow, P4 salvage violet). */
export function TabletMini() {
  const rows = ["#dc2626", "#ea580c", "#ea580c", "#eab308", "#eab308", "#8b5cf6"];
  return (
    <svg viewBox="0 0 120 90" className="block h-auto w-full" {...svgProps}>
      <rect x="1" y="1" width="118" height="88" rx="7" fill={GLASS} stroke={FRAME} strokeWidth="1.2" />
      <rect x="6" y="6" width="108" height="78" rx="2.5" fill="#111115" />
      <rect x="8" y="8" width="50" height="74" rx="1.5" fill="#18181d" />
      <path d="M14 22 34 16 50 26 46 48 28 54 14 44Z" fill="#f97316" fillOpacity="0.16" stroke="#f97316" strokeWidth="0.8" />
      {[
        [24, 30, "#dc2626"],
        [36, 38, "#ea580c"],
        [30, 46, "#ea580c"],
        [42, 28, "#eab308"],
        [20, 64, "#eab308"],
        [44, 60, "#8b5cf6"],
      ].map(([cx, cy, fill]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" fill={fill as string} stroke={GLASS} strokeWidth="0.6" />
      ))}
      {rows.map((c, i) => {
        const y = 9 + i * 12.2;
        return (
          <g key={y}>
            <rect x="61" y={y} width="50" height="10.4" rx="1.2" fill="#17171c" />
            <rect x="63" y={y + 3} width="7.5" height="4.4" rx="1" fill={c} />
            <rect x="73" y={y + 2.8} width="24" height="1.7" rx="0.5" fill="#e4e4e7" />
            <rect x="73" y={y + 6} width="33" height="1.3" rx="0.5" fill="#52525b" />
          </g>
        );
      })}
    </svg>
  );
}

/** /call: the public line in a browser window, a call button and the 8 language choices. */
export function BrowserMini() {
  return (
    <svg viewBox="0 0 120 90" className="block h-auto w-full" {...svgProps}>
      <rect x="1" y="1" width="118" height="88" rx="6" fill={GLASS} stroke={FRAME} strokeWidth="1.2" />
      <path d="M1.6 12.5h116.8" stroke={FRAME} strokeWidth="1" />
      {[8, 13, 18].map((cx) => (
        <circle key={cx} cx={cx} cy="6.8" r="1.6" fill={LINE} />
      ))}
      <rect x="26" y="4" width="66" height="5.6" rx="2.8" fill="#18181d" />
      <rect x="30" y="6" width="16" height="1.6" rx="0.8" fill="#71717a" />
      <circle cx="60" cy="40" r="13" fill="#16a34a" fillOpacity="0.9" />
      <path
        d="M54.6 35.2c.5-.6 1.4-.7 2-.1l1.6 1.6c.6.6.6 1.5 0 2.1l-.8.8c1 1.8 2.4 3.2 4.2 4.2l.8-.8c.6-.6 1.5-.6 2.1 0l1.6 1.6c.6.6.5 1.5-.1 2l-1.1 1c-1 .9-2.5 1.1-3.7.5-3.3-1.7-5.9-4.3-7.6-7.6-.6-1.2-.4-2.7.5-3.7z"
        fill="#f5f5f4"
      />
      {[0, 1].map((row) =>
        [20, 41, 62, 83].map((x) => (
          <rect key={`${row}-${x}`} x={x} y={63 + row * 9} width="17" height="5.6" rx="2.8" fill="#1c1c21" stroke={LINE} strokeWidth="0.5" />
        )),
      )}
    </svg>
  );
}

/** /demo: the operator console on a laptop: scenario resets, simulator events, the autopilot switch. */
export function LaptopMini() {
  return (
    <svg viewBox="0 0 120 90" className="block h-auto w-full" {...svgProps}>
      <rect x="12" y="8" width="96" height="64" rx="4" fill={GLASS} stroke={FRAME} strokeWidth="1.2" />
      <rect x="16" y="12" width="88" height="56" rx="1.5" fill="#111115" />
      {[19, 40, 61, 82].map((x, i) => (
        <rect key={x} x={x} y="16" width="19" height="7.5" rx="1.5" fill="#1c1c21" stroke={i === 0 ? "#ff2a12" : LINE} strokeWidth="0.7" />
      ))}
      {[
        [29, "#f97316"],
        [37, "#dc2626"],
        [45, "#8b5cf6"],
      ].map(([y, c]) => (
        <g key={y as number}>
          <rect x="19" y={y as number} width="82" height="6" rx="1.2" fill="#17171c" />
          <rect x="21" y={(y as number) + 1.6} width="2.8" height="2.8" rx="0.6" fill={c as string} />
          <rect x="26" y={(y as number) + 2.2} width="30" height="1.6" rx="0.5" fill="#a1a1aa" />
        </g>
      ))}
      <rect x="19" y="56" width="12" height="6" rx="3" fill="#16a34a" />
      <circle cx="28" cy="59" r="2.2" fill="#f5f5f4" />
      <rect x="34" y="58.2" width="22" height="1.6" rx="0.5" fill="#a1a1aa" />
      <path d="M2 74h116l-6 8H8z" fill="#1c1c21" stroke={FRAME} strokeWidth="1" />
      <rect x="50" y="74" width="20" height="2" rx="1" fill={FRAME} />
    </svg>
  );
}

/** /evidence: the three NSF Phase I milestones as bars, on a second screen. */
export function EvidenceMini() {
  return (
    <svg viewBox="0 0 120 90" className="block h-auto w-full" {...svgProps}>
      <rect x="4" y="4" width="112" height="64" rx="4" fill={GLASS} stroke={FRAME} strokeWidth="1.2" />
      <rect x="8" y="8" width="104" height="56" rx="1.5" fill="#111115" />
      {[
        [15, 70, "#4ade80"],
        [31, 84, "#4ade80"],
        [47, 52, "#ff6b3d"],
      ].map(([y, w, c]) => (
        <g key={y as number}>
          <rect x="14" y={y as number} width="30" height="2" rx="0.6" fill="#71717a" />
          <rect x="14" y={(y as number) + 5} width="92" height="4" rx="2" fill="#1c1c21" />
          <rect x="14" y={(y as number) + 5} width={w as number} height="4" rx="2" fill={c as string} />
        </g>
      ))}
      <rect x="54" y="68" width="12" height="10" fill="#1c1c21" />
      <rect x="38" y="78" width="44" height="3" rx="1.5" fill={FRAME} />
    </svg>
  );
}
