"use client";

// GCJ-02, live: the shift lib/geo-cn.ts computes for a point, drawn on a small stand-in for a Chinese basemap.
// On such a map the household is drawn at its GCJ-02 position; a raw GPS (WGS-84) point drawn as-is lands the
// computed distance away. VoiceFlare stores WGS-84 and converts only when it draws (decision D-40).
import { useId, useState } from "react";
import { MotionConfig, motion } from "motion/react";
import { gcjOffsetMeters, wgs84ToGcj02 } from "@/lib/geo-cn";
import { motionTokens, springs } from "./motion";

const POINTS = [
  { id: "beibei", label: "Beibei, Chongqing", lng: 106.42, lat: 29.81 },
  { id: "culver", label: "Culver City, Los Angeles", lng: -118.397, lat: 34.01 },
] as const;
type PointId = (typeof POINTS)[number]["id"];
type Mode = "raw" | "converted";

const M_PER_DEG = 111_320; // the constant gcjOffsetMeters uses
const PX_PER_M = 0.25; // 100 m on the ground = 25 px in the drawing
const W = 360;
const H = 240;
const BLOCK = 100 * PX_PER_M;

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
function compass(east: number, north: number): string {
  const deg = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(deg / 45) % 8];
}

function measure(lng: number, lat: number) {
  const [gLng, gLat] = wgs84ToGcj02(lng, lat);
  const east = (gLng - lng) * M_PER_DEG * Math.cos((lat * Math.PI) / 180);
  const north = (gLat - lat) * M_PER_DEG;
  return { gLng, gLat, east, north, meters: gcjOffsetMeters(lng, lat) };
}

const fmt = (n: number) => n.toFixed(5);

function Choice<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-vf-smoke">{legend}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label
            key={o.id}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-vf-ember ${
              value === o.id ? "border-vf-flare/70 bg-vf-ash text-vf-bone" : "border-vf-ash text-vf-smoke hover:text-vf-bone"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.id}
              checked={value === o.id}
              onChange={() => onChange(o.id)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function GcjExplainer() {
  const [pointId, setPointId] = useState<PointId>("beibei");
  const [mode, setMode] = useState<Mode>("raw");
  const id = useId();
  const p = POINTS.find((x) => x.id === pointId) ?? POINTS[0];
  const m = measure(p.lng, p.lat);
  const shifted = m.meters > 0;

  // Raw GPS drawn as-is sits at minus the shift from the household. SVG x grows east, y grows south.
  const vx = -m.east * PX_PER_M;
  const vy = m.north * PX_PER_M;
  const house = { x: W / 2 - vx / 2, y: H / 2 - vy / 2 };
  const raw = { x: W / 2 + vx / 2, y: H / 2 + vy / 2 };
  const dot = mode === "raw" ? raw : house;
  const dir = compass(-m.east, -m.north);

  const x0 = (((house.x - BLOCK / 2) % BLOCK) + BLOCK) % BLOCK;
  const y0 = (((house.y - BLOCK / 2) % BLOCK) + BLOCK) % BLOCK;
  const streetsX: number[] = [];
  const streetsY: number[] = [];
  for (let x = x0; x <= W; x += BLOCK) streetsX.push(x);
  for (let y = y0; y <= H; y += BLOCK) streetsY.push(y);
  const mainY = house.y + BLOCK / 2;

  const sentence = !shifted
    ? `${p.label}: outside mainland China the conversion leaves the point unchanged, so the offset is 0 m.`
    : mode === "raw"
      ? `${p.label}: raw GPS drawn on a Chinese basemap lands ${m.meters} m ${dir} of the household.`
      : `${p.label}: converted to GCJ-02 first, the dot lands on the household.`;

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid gap-6 rounded-2xl border border-vf-ash bg-vf-coal p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center">
        <figure className="m-0">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-labelledby={`${id}-t ${id}-d`}
            className="block h-auto w-full rounded-xl border border-vf-ash bg-vf-ink"
          >
            <title id={`${id}-t`}>A GPS point on a Chinese basemap</title>
            <desc id={`${id}-d`}>{sentence}</desc>
            <g stroke="var(--vf-ash)" strokeWidth={1}>
              {streetsX.map((x) => (
                <line key={`x${x}`} x1={x} y1={0} x2={x} y2={H} />
              ))}
              {streetsY.map((y) => (
                <line key={`y${y}`} x1={0} y1={y} x2={W} y2={y} />
              ))}
            </g>
            <line x1={0} y1={mainY} x2={W} y2={mainY} stroke="#2a2a31" strokeWidth={4} />
            <rect
              x={house.x - 7}
              y={house.y - 7}
              width={14}
              height={14}
              rx={2}
              fill="rgb(245 245 244 / 0.16)"
              stroke="var(--vf-bone)"
              strokeOpacity={0.8}
            />
            {shifted && (
              <>
                <motion.line
                  x1={house.x}
                  y1={house.y}
                  x2={raw.x}
                  y2={raw.y}
                  stroke="var(--vf-ember)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  initial={false}
                  animate={{ opacity: mode === "raw" ? 0.95 : 0.3 }}
                  transition={{ duration: motionTokens.duration.normal }}
                />
                <circle cx={raw.x} cy={raw.y} r={6} fill="none" stroke="var(--vf-flare)" strokeOpacity={0.45} strokeDasharray="2 2" />
                <g transform={`translate(${(house.x + raw.x) / 2 + 10}, ${(house.y + raw.y) / 2 - 6})`}>
                  <rect x={-2} y={-11} width={54} height={16} rx={3} fill="var(--vf-ink)" fillOpacity={0.85} />
                  <text x={4} y={1} fill="var(--vf-bone)" fontSize={11} fontFamily="var(--font-geist-mono), monospace">
                    {m.meters} m
                  </text>
                </g>
              </>
            )}
            <motion.g initial={false} animate={{ x: dot.x, y: dot.y }} transition={springs.gentle}>
              <circle r={12} fill="var(--vf-flare)" fillOpacity={0.16} />
              <circle r={5.5} fill="var(--vf-flare)" stroke="var(--vf-ink)" strokeWidth={1.5} />
            </motion.g>
            <g transform={`translate(14, ${H - 16})`} fill="var(--vf-smoke)" fontSize={10} fontFamily="var(--font-geist-mono), monospace">
              <line x1={0} y1={0} x2={2 * BLOCK} y2={0} stroke="var(--vf-smoke)" strokeWidth={1.5} />
              <line x1={0} y1={-3} x2={0} y2={3} stroke="var(--vf-smoke)" />
              <line x1={2 * BLOCK} y1={-3} x2={2 * BLOCK} y2={3} stroke="var(--vf-smoke)" />
              <text x={2 * BLOCK + 6} y={3.5}>
                200 m
              </text>
            </g>
            <g transform={`translate(${W - 20}, 18)`} fill="var(--vf-smoke)" fontSize={10} textAnchor="middle">
              <path d="M0 -8 L4 2 L0 0 L-4 2 Z" />
              <text y={14}>N</text>
            </g>
          </svg>
          <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-vf-smoke">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px] border border-vf-bone/80 bg-vf-bone/15" />
              The household on the basemap
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-vf-flare" />
              VoiceFlare&apos;s dot
            </span>
            <span>Streets every 100 m (illustrative)</span>
          </figcaption>
        </figure>

        <div className="space-y-4">
          <Choice
            legend="Point"
            name={`${id}-point`}
            value={pointId}
            options={POINTS.map((x) => ({ id: x.id, label: x.label }))}
            onChange={setPointId}
          />
          <Choice
            legend="How the dot is drawn"
            name={`${id}-mode`}
            value={mode}
            options={[
              { id: "raw", label: "Raw GPS, as stored" },
              { id: "converted", label: "Converted to GCJ-02 first" },
            ]}
            onChange={setMode}
          />
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-vf-smoke">Stored (WGS-84)</dt>
            <dd className="font-mono text-vf-bone">
              {fmt(p.lng)}, {fmt(p.lat)}
            </dd>
            <dt className="text-vf-smoke">Drawn (GCJ-02)</dt>
            <dd className="font-mono text-vf-bone">
              {fmt(m.gLng)}, {fmt(m.gLat)}
            </dd>
            <dt className="text-vf-smoke">Raw GPS off by</dt>
            <dd className="font-display text-xl font-semibold leading-tight text-vf-flare">{m.meters} m</dd>
          </dl>
          <p aria-live="polite" className="border-l-2 border-vf-flare/60 pl-3 text-sm leading-relaxed text-vf-bone">
            {sentence}
          </p>
        </div>
      </div>
    </MotionConfig>
  );
}
