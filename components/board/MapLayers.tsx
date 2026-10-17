"use client";

import type { PathOptions } from "leaflet";
import { Fragment } from "react";
import { Circle, CircleMarker, Marker, Polygon, Polyline, Tooltip } from "react-leaflet";
import type { HouseholdView } from "@/lib/contracts";
import { capPerWave, firstWave, waveCount } from "@/lib/engine/blocks";
import { STATE_COLOR, STATE_RANK } from "@/lib/directives";
import { hexPolygon } from "@/lib/geo";
import { fmtAgo, fmtPeople, isFresh } from "@/lib/client/format";
import {
  ANSWER_COLOR,
  ANSWER_LABEL,
  CANARY_RESULT_LABEL,
  displayStatus,
  HELP_STATUS_LABEL,
  HOLLOW_STATUS,
  LOCATION_SOURCE_LABEL,
  NEED_LABEL,
  PRIORITY_COLOR,
  PULSE_STATUS,
  STATE_TEXT,
  stateLabel,
  stateShort,
  STATUS_COLOR,
  statusLabel,
} from "@/lib/client/labels";
import type { Canary, Cluster, EvacPlan, HelpRequest, Hold, Mode, Proposal, Report, Zone, ZoneState } from "@/lib/types";
import { useBoard } from "./BoardContext";
import { BLOCK_COLOR, BLOCK_EMOJI, BLOCK_FILL, BLOCK_LABEL, fmtN, loadColor, shownWave } from "./blockLabels";
import { usePlans, useZonePlan } from "./usePlans";
import {
  blockLabelHtml,
  centre,
  countHtml,
  diamondHtml,
  epHtml,
  helpPinHtml,
  holdLabelHtml,
  icon,
  latLngs,
  liveHelpPinHtml,
  pathStyle,
  routeLabelHtml,
  triangleHtml,
  zoneLabelHtml,
} from "./mapMarks";

const ZONE_FILL: Record<ZoneState, number> = {
  monitor: 0.06,
  watch: 0.14,
  warning: 0.24,
  order: 0.3,
  shelter_in_place: 0.26,
  lifted: 0.12,
};

const CLUSTER_COLOR: Record<Cluster["kind"], string> = {
  hazard: "#ea580c",
  help: "#dc2626",
  silence: "#6d28d9",
  volume: "#2563eb",
};

const CLUSTER_LABEL: Record<Cluster["kind"], string> = {
  hazard: "Hazard reports",
  help: "Help calls",
  silence: "Silence (no answers)",
  volume: "Call volume",
};

const SENTINEL_ON_POST = "#4f46e5";
const SENTINEL_OFF_POST = "#94a3b8";
const CANARY_IDLE = "#0d9488";

const needsText = (needs: HelpRequest["needs"]) => needs.map((n) => NEED_LABEL[n]).join(", ");

// ---------- Zones and proposals ----------

/**
 * Zones, and for a zone with a block-by-block plan its blocks colored by wave status instead of one solid fill (the zone
 * outline stays), plus its exit roads with each road's load in the wave shown.
 */
export function ZoneShapes({ zones, faint }: { zones: Zone[]; faint: boolean }) {
  const plans = usePlans();
  return zones.map((z) => {
    const color = STATE_COLOR[z.state];
    const plan = plans.find((p) => p.zone_id === z.id);
    const blocks = plan && plan.status !== "proposed" && !faint; // approved: blocks replace the solid fill
    const style = pathStyle({
      color,
      weight: blocks ? 2.5 : 2,
      opacity: 0.9,
      fillColor: color,
      fillOpacity: blocks ? 0 : ZONE_FILL[z.state] * (faint ? 0.5 : 1),
    });
    return (
      <Fragment key={z.id}>
        <Polygon positions={latLngs(z.geom)} interactive={false} {...style} pathOptions={style} />
        {plan && !faint ? <BlockShapes plan={plan} zone={z} /> : null}
      </Fragment>
    );
  });
}

function BlockShapes({ plan, zone }: { plan: EvacPlan; zone: Zone }) {
  const proposed = plan.status === "proposed";
  const total = waveCount(plan);
  const wave = shownWave(plan, total);
  const load = plan.waves.find((w) => w.n === wave)?.load ?? {};
  return (
    <>
      {plan.blocks.map((b) => {
        const c = BLOCK_COLOR[b.status];
        // A proposed plan shows only its dashed block lines over the zone's usual fill.
        const style = proposed
          ? pathStyle({ color: STATE_COLOR[zone.state], weight: 1, opacity: 0.8, dashArray: "4 4", fill: false })
          : pathStyle({ color: "#ffffff", weight: 1, opacity: 0.9, fillColor: c, fillOpacity: BLOCK_FILL[b.status] });
        const route = plan.routes.find((r) => r.id === b.route_id);
        return (
          <Polygon key={b.id} positions={latLngs(b.geom)} {...style} pathOptions={style}>
            <Tooltip className="sk-tip" sticky>
              <b>{b.id}</b> · <span aria-hidden="true">{BLOCK_EMOJI[b.status]}</span> {proposed ? "Proposed" : BLOCK_LABEL[b.status]} · wave {b.wave} of {total}
              <br />
              <span aria-hidden="true">🛣️</span> {route?.name ?? "no road set"}
              <br />
              <span aria-hidden="true">👥</span> about {fmtN(b.people_est)} people · <span aria-hidden="true">🚗</span> about {fmtN(b.vehicles_est)} cars (estimates)
              {b.households ? ` · ${b.households} on the roster` : ""}
              {b.pulled_forward ? (
                <>
                  <br />
                  <span aria-hidden="true">🔥</span> Pulled forward: {b.pulled_forward}
                </>
              ) : null}
            </Tooltip>
          </Polygon>
        );
      })}
      {plan.routes.map((r) => {
        const cars = load[r.id] ?? 0;
        const cap = capPerWave(r, plan.wave_minutes);
        const pct = cap ? Math.round((cars / cap) * 100) : 0;
        const casing = pathStyle({ color: "#ffffff", weight: 7, opacity: 0.9 });
        const line = pathStyle({ color: loadColor(pct), weight: 4, opacity: proposed ? 0.6 : 0.95, dashArray: proposed ? "8 6" : undefined });
        const pts = r.line.map(([lng, lat]) => [lat, lng] as [number, number]);
        return (
          <Fragment key={r.id}>
            <Polyline positions={pts} interactive={false} {...casing} pathOptions={casing} />
            <Polyline positions={pts} {...line} pathOptions={line}>
              <Tooltip className="sk-tip" sticky>
                <b>
                  <span aria-hidden="true">🛣️</span> {r.name}
                </b>
                <br />
                {r.lanes} outbound lane{r.lanes === 1 ? "" : "s"} × {fmtN(r.per_lane_vph)} cars an hour = {fmtN(r.capacity_vph)} cars an hour (planning assumption)
                <br />
                Wave {wave}: {fmtN(cars)} of {fmtN(cap)} cars ({pct}%)
              </Tooltip>
            </Polyline>
          </Fragment>
        );
      })}
    </>
  );
}

export function ProposalShapes({ proposals, zoneById }: { proposals: Proposal[]; zoneById: Map<string, Zone> }) {
  // The most severe proposal is drawn last, so its outline sits on top.
  const ordered = [...proposals].sort((a, b) => STATE_RANK[a.proposed_state] - STATE_RANK[b.proposed_state]);
  return ordered.map((p) => {
    const zone = zoneById.get(p.zone_id);
    if (!zone) return null;
    const outline = pathStyle({ color: STATE_COLOR[p.proposed_state], weight: 3.5, dashArray: "9 7", fill: false });
    const envelope = pathStyle({ color: "#b45309", weight: 1.5, dashArray: "2 6", fillColor: "#f59e0b", fillOpacity: 0.06 });
    return (
      <Fragment key={p.id}>
        <Polygon positions={latLngs(zone.geom)} interactive={false} {...outline} pathOptions={outline} />
        {p.envelope ? <Polygon positions={latLngs(p.envelope)} interactive={false} {...envelope} pathOptions={envelope} /> : null}
      </Fragment>
    );
  });
}

export function ZoneLabels({ zones, proposals, mode }: { zones: Zone[]; proposals: Proposal[]; mode: Mode }) {
  const plans = usePlans();
  return zones.map((z) => {
    // One badge per zone: the most severe open proposal, with a count of the others.
    const mine = proposals
      .filter((x) => x.zone_id === z.id)
      .sort((a, b) => STATE_RANK[b.proposed_state] - STATE_RANK[a.proposed_state]);
    const p = mine[0];
    const plan = plans.find((x) => x.zone_id === z.id);
    const html = zoneLabelHtml({
      name: z.name,
      state: stateShort(z.state, mode),
      color: STATE_COLOR[z.state],
      text: STATE_TEXT[z.state],
      proposal: p
        ? { state: stateLabel(p.proposed_state, mode), color: STATE_COLOR[p.proposed_state], reason: p.reason, more: mine.length - 1 }
        : null,
      plan: plan ? planLine(plan) : null,
    });
    return (
      <Fragment key={z.id}>
        <Marker position={centre(z.geom)} icon={icon(html)} interactive={false} keyboard={false} />
        {plan ? <BlockLabels plan={plan} /> : null}
      </Fragment>
    );
  });
}

/** "🚦 Wave 3 of 10 · 34 blocks" under the zone's name. */
function planLine(plan: EvacPlan): string {
  const total = waveCount(plan);
  if (plan.status === "proposed") return `📝 Block plan proposed: ${plan.blocks.length} blocks, ${total} waves`;
  if (plan.status === "standby") return `🕒 ${plan.blocks.length} blocks, ${total} waves: ready if an Order comes`;
  if (plan.status === "all_go") return `🚨 Everyone go now · ${plan.blocks.length} blocks`;
  if (plan.current_wave > total) return `✅ All ${total} waves done · ${plan.blocks.length} blocks`;
  return `🚦 Wave ${plan.current_wave} of ${total} going now${plan.held ? " · next held" : ""} · ${plan.blocks.length} blocks`;
}

/** Block ids at each block (only the blocks going now at a far zoom), and each road's load at its outbound end. */
function BlockLabels({ plan }: { plan: EvacPlan }) {
  const proposed = plan.status === "proposed";
  const wave = shownWave(plan, waveCount(plan));
  const load = plan.waves.find((w) => w.n === wave)?.load ?? {};
  return (
    <>
      {proposed
        ? null
        : plan.blocks.map((b) => (
            <Marker
              key={b.id}
              position={[b.centroid[1], b.centroid[0]]}
              icon={icon(blockLabelHtml(b.id, b.status, BLOCK_EMOJI[b.status], BLOCK_COLOR[b.status]))}
              interactive={false}
              keyboard={false}
            />
          ))}
      {plan.routes.map((r) => {
        const end = r.line[r.line.length - 1];
        if (!end) return null;
        const cap = capPerWave(r, plan.wave_minutes);
        const pct = cap ? Math.round(((load[r.id] ?? 0) / cap) * 100) : 0;
        return (
          <Marker
            key={r.id}
            position={[end[1], end[0]]}
            icon={icon(routeLabelHtml(r.short, `${pct}%`, loadColor(pct)))}
            interactive={false}
            keyboard={false}
          />
        );
      })}
    </>
  );
}

// ---------- Pattern watch ----------

export function ClusterShapes({ clusters }: { clusters: Cluster[] }) {
  return clusters
    .filter((c) => c.status !== "dismissed")
    .map((c) => {
      const color = CLUSTER_COLOR[c.kind];
      const style = pathStyle({ color, weight: 2, fillColor: color, fillOpacity: 0.22 });
      return (
        <Polygon key={c.id} positions={latLngs(hexPolygon(c.center_lat, c.center_lng))} {...style} pathOptions={style}>
          <Tooltip className="sk-tip" sticky>
            <b>{CLUSTER_LABEL[c.kind]}</b>: {c.count} (baseline {c.baseline})
            <br />
            {c.corroborated ? "Corroborated by a sentinel read" : `Not corroborated · sentinel reads: ${c.sentinel_reads}`}
          </Tooltip>
        </Polygon>
      );
    });
}

export function ClusterCounts({ clusters }: { clusters: Cluster[] }) {
  return clusters
    .filter((c) => c.status !== "dismissed")
    .map((c) => (
      <Marker
        key={c.id}
        position={[c.center_lat, c.center_lng]}
        icon={icon(countHtml(CLUSTER_COLOR[c.kind], String(c.count)))}
        interactive={false}
        keyboard={false}
      />
    ));
}

export function ReportDots({ reports }: { reports: Report[] }) {
  const style = pathStyle({ color: "#7c2d12", weight: 1, fillColor: "#fb923c", fillOpacity: 0.9 });
  return reports.map((r) => (
    <CircleMarker key={r.id} center={[r.lat, r.lng]} radius={3.5} {...style} pathOptions={style}>
      <Tooltip className="sk-tip" direction="top">
        Report: {r.type}
        {r.synthetic ? " · seeded (synthetic)" : ""}
        {r.text ? <> · “{r.text}”</> : null}
      </Tooltip>
    </CircleMarker>
  ));
}

// ---------- The hold ----------

export function HoldShape({ hold }: { hold: Hold }) {
  const style = pathStyle({ color: "#dc2626", weight: 5, dashArray: "14 10", fillColor: "#dc2626", fillOpacity: 0.07 });
  return <Polygon positions={latLngs(hold.polygon)} interactive={false} {...style} pathOptions={style} />;
}

export function HoldLabel({ hold }: { hold: Hold }) {
  // Under the polygon's northernmost vertex, so it never sits on the zone label at the centroid.
  const top = hold.polygon.coordinates[0].reduce((a, b) => (b[1] > a[1] ? b : a));
  // The dose keeps the zone total; a block plan adds how many move in wave 1 (only when the hold's polygon is the zone's).
  const plan = useZonePlan(hold.zone_id);
  const { zoneById } = useBoard();
  const w1 = plan && hold.polygon_label === zoneById.get(hold.zone_id)?.name ? firstWave(plan) : null;
  return (
    <Marker
      position={[top[1], top[0]]}
      icon={icon(holdLabelHtml(hold.polygon_label, `~${fmtPeople(hold.population_est)}`, w1 ? `wave ${w1.wave} now: ${fmtPeople(w1.people)}` : null))}
      interactive={false}
      keyboard={false}
    />
  );
}

// ---------- People ----------

function HouseholdTip({ h, status, mode }: { h: HouseholdView; status: HouseholdView["status"]; mode: Mode }) {
  return (
    <>
      <b>{h.name}</b> · {h.synthetic ? "synthetic" : "real phone"}
      <br />
      {statusLabel(status, mode)}
      {h.via === "linked_contact" ? " (via linked contact)" : ""}
      {h.destination ? ` → ${h.destination}` : ""}
      {h.understood ? " · understood" : ""}
      <br />
      {h.language}
      {h.needs.length ? ` · ${needsText(h.needs)}` : ""}
    </>
  );
}

/** Residents as dots colored by status; queued and ringing dots pulse (the edge-first sweep). */
export function HouseholdPins({ households, mode }: { households: HouseholdView[]; mode: Mode }) {
  return households.map((h) => {
    const status = displayStatus(h);
    const color = STATUS_COLOR[status];
    const hollow = HOLLOW_STATUS.includes(status);
    const pulse = PULSE_STATUS.includes(status);
    const style: PathOptions = pathStyle({
      color: pulse || hollow ? color : h.has_device ? "#0f172a" : "#ffffff",
      weight: h.has_device ? 3 : hollow ? 2.5 : 1.5,
      fillColor: color,
      fillOpacity: hollow ? 0 : 0.95,
    });
    return (
      // Keyed by status: Leaflet only applies className (the pulse) when a path is created.
      <CircleMarker
        key={`${h.id}:${status}`}
        center={[h.lat, h.lng]}
        radius={h.has_device ? 8 : 5.5}
        className={pulse ? "sk-pulse" : undefined}
        {...style}
        pathOptions={style}
      >
        {h.has_device ? (
          <Tooltip permanent direction="right" offset={[9, 0]} className="sk-device-tip">
            {h.device_label}
            {status === "pending" ? "" : ` · ${statusLabel(status, mode)}`}
            {h.via === "linked_contact" ? " (via linked contact)" : ""}
          </Tooltip>
        ) : (
          <Tooltip className="sk-tip" direction="top" offset={[0, -6]}>
            <HouseholdTip h={h} status={status} mode={mode} />
          </Tooltip>
        )}
      </CircleMarker>
    );
  });
}

function canaryColor(c: Canary | undefined): string {
  if (!c) return CANARY_IDLE;
  if (c.result === "pending") return ANSWER_COLOR.pending;
  if (c.flag === "clear") return "#16a34a";
  if (c.flag === "transport_failure") return "#dc2626";
  if (c.flag === "unverified") return "#ca8a04";
  return CANARY_IDLE;
}

/**
 * Sentinels (diamonds) and canaries (triangles). In an open hold a rung sentinel takes the color of its
 * answer; a backup that has not been rung yet (no call) stays in its roster color.
 */
export function EdgeMarks({ households, hold, canaries }: { households: HouseholdView[]; hold: Hold | null; canaries: Canary[] }) {
  return households.map((h) => {
    const live = h.call_state === "ringing" || h.call_state === "active";
    let html: string;
    let answer: string | null;
    let note: string;
    if (h.role === "sentinel") {
      const s = hold?.sentinels.find((x) => x.household_id === h.id && x.call_id !== null);
      const color = s ? ANSWER_COLOR[s.answer] : h.on_post ? SENTINEL_ON_POST : SENTINEL_OFF_POST;
      html = diamondHtml(color, s ? s.answer === "pending" : live, h.has_device);
      answer = s ? ANSWER_LABEL[s.answer] : null;
      note = s
        ? `${ANSWER_LABEL[s.answer]}${s.what ? `: ${s.what}` : ""}${s.direction ? `, ${s.direction}` : ""}`
        : `Sentinel${h.on_post ? " · on post" : ""}`;
    } else {
      const c = canaries.find((x) => x.household_id === h.id);
      html = triangleHtml(canaryColor(c), c ? c.result === "pending" : live);
      answer = c ? CANARY_RESULT_LABEL[c.result] : null;
      note = c ? `Canary · ${CANARY_RESULT_LABEL[c.result]}` : "Canary, outside the zones";
    }
    return (
      <Marker key={h.id} position={[h.lat, h.lng]} icon={icon(html)} zIndexOffset={400} keyboard={false}>
        {h.has_device ? (
          <Tooltip permanent direction="right" offset={[10, 0]} className="sk-device-tip">
            {h.device_label}
            {answer ? ` · ${answer}` : ""}
          </Tooltip>
        ) : (
          <Tooltip className="sk-tip" direction="top" offset={[0, -8]}>
            <b>{h.name}</b> · {h.synthetic ? "synthetic" : "real phone"}
            <br />
            {note} · reliability {Math.round(h.reliability * 100)}%
          </Tooltip>
        )}
      </Marker>
    );
  });
}

export function EvacPoints({ zones }: { zones: Zone[] }) {
  const points = new Map<string, { lat: number; lng: number; name: string }>();
  for (const z of zones) {
    if (z.evac_point && z.evac_point_lat !== null && z.evac_point_lng !== null) {
      points.set(`${z.evac_point_lat},${z.evac_point_lng}`, { lat: z.evac_point_lat, lng: z.evac_point_lng, name: z.evac_point });
    }
  }
  return [...points].map(([key, p]) => (
    <Marker key={key} position={[p.lat, p.lng]} icon={icon(epHtml())} zIndexOffset={200} keyboard={false}>
      <Tooltip permanent direction="right" offset={[12, 0]} className="sk-ep-tip">
        {p.name.split(",")[0]}
      </Tooltip>
    </Marker>
  ));
}

const LIVE_CIRCLE = pathStyle({ color: "#2563eb", weight: 1.5, opacity: 0.8, fillColor: "#3b82f6", fillOpacity: 0.12 });

/**
 * Help registry rows at their last known location: color by priority, solid ring fresh, dashed stale. A live GPS fix
 * from the person's link (response team only) gets a pulsing blue ring, a GPS tag and its accuracy circle.
 */
export function HelpPins({
  rows,
  now,
  selectedId,
  onSelect,
}: {
  rows: HelpRequest[];
  now: string;
  selectedId: string | null;
  onSelect?: (id: string) => void;
}) {
  return rows.map((r) => {
    if (r.last_lat === null || r.last_lng === null) return null;
    const fresh = isFresh(r.last_observed_at, now);
    const done = r.status === "reached" || r.status === "closed";
    const live = r.last_source === "gps_link";
    const html = live
      ? liveHelpPinHtml(r.priority, PRIORITY_COLOR[r.priority], fresh, done, r.id === selectedId)
      : helpPinHtml(r.priority, PRIORITY_COLOR[r.priority], fresh, done, r.id === selectedId);
    return (
      <Fragment key={r.id}>
        {live && r.last_accuracy_m && !done ? (
          <Circle
            center={[r.last_lat, r.last_lng]}
            radius={Math.max(5, r.last_accuracy_m)}
            pane="sk-pins"
            interactive={false}
            {...LIVE_CIRCLE}
            pathOptions={LIVE_CIRCLE}
          />
        ) : null}
        <Marker
          position={[r.last_lat, r.last_lng]}
          icon={icon(html)}
          zIndexOffset={1000 + (4 - r.priority) * 100 + (live ? 50 : 0)}
          keyboard={false}
          eventHandlers={onSelect ? { click: () => onSelect(r.id) } : undefined}
        >
          <Tooltip className="sk-tip" direction="top" offset={[0, -16]}>
            <b>
              P{r.priority} · {r.name ?? "Name not given"}
            </b>{" "}
            · {HELP_STATUS_LABEL[r.status]}
            <br />
            {r.needs.length ? needsText(r.needs) : (r.reason ?? "").replaceAll("_", " ")}
            {r.people ? ` · ${r.people} people` : ""}
            <br />
            Last seen: {live ? "Live GPS" : LOCATION_SOURCE_LABEL[r.last_source]}
            {live && r.last_accuracy_m ? ` · ${Math.round(r.last_accuracy_m)} m` : ""} · {fmtAgo(r.last_observed_at, now)} · {fresh ? "fresh" : "stale"}
            {r.last_stated_text ? (
              <>
                <br />“{r.last_stated_text}”
              </>
            ) : null}
          </Tooltip>
        </Marker>
      </Fragment>
    );
  });
}
