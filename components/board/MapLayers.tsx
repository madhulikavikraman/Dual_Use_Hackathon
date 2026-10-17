"use client";

import type { PathOptions } from "leaflet";
import { Fragment } from "react";
import { CircleMarker, Marker, Polygon, Tooltip } from "react-leaflet";
import type { HouseholdView } from "@/lib/contracts";
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
import type { Canary, Cluster, HelpRequest, Hold, Mode, Proposal, Report, Zone, ZoneState } from "@/lib/types";
import {
  centre,
  countHtml,
  diamondHtml,
  epHtml,
  helpPinHtml,
  holdLabelHtml,
  icon,
  latLngs,
  pathStyle,
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

export function ZoneShapes({ zones, faint }: { zones: Zone[]; faint: boolean }) {
  return zones.map((z) => {
    const color = STATE_COLOR[z.state];
    const style = pathStyle({
      color,
      weight: 2,
      opacity: 0.9,
      fillColor: color,
      fillOpacity: ZONE_FILL[z.state] * (faint ? 0.5 : 1),
    });
    return <Polygon key={z.id} positions={latLngs(z.geom)} interactive={false} {...style} pathOptions={style} />;
  });
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
  return zones.map((z) => {
    // One badge per zone: the most severe open proposal, with a count of the others.
    const mine = proposals
      .filter((x) => x.zone_id === z.id)
      .sort((a, b) => STATE_RANK[b.proposed_state] - STATE_RANK[a.proposed_state]);
    const p = mine[0];
    const html = zoneLabelHtml({
      name: z.name,
      state: stateShort(z.state, mode),
      color: STATE_COLOR[z.state],
      text: STATE_TEXT[z.state],
      proposal: p
        ? { state: stateLabel(p.proposed_state, mode), color: STATE_COLOR[p.proposed_state], reason: p.reason, more: mine.length - 1 }
        : null,
    });
    return <Marker key={z.id} position={centre(z.geom)} icon={icon(html)} interactive={false} keyboard={false} />;
  });
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
  return (
    <Marker
      position={[top[1], top[0]]}
      icon={icon(holdLabelHtml(hold.polygon_label, `${fmtPeople(hold.population_est)} people`))}
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

/** Help registry rows at their last known location: color by priority, solid ring fresh, dashed stale. */
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
    const html = helpPinHtml(r.priority, PRIORITY_COLOR[r.priority], fresh, done, r.id === selectedId);
    return (
      <Marker
        key={r.id}
        position={[r.last_lat, r.last_lng]}
        icon={icon(html)}
        zIndexOffset={1000 + (4 - r.priority) * 100}
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
          Last seen: {LOCATION_SOURCE_LABEL[r.last_source]} · {fmtAgo(r.last_observed_at, now)} · {fresh ? "fresh" : "stale"}
          {r.last_stated_text ? (
            <>
              <br />“{r.last_stated_text}”
            </>
          ) : null}
        </Tooltip>
      </Marker>
    );
  });
}
