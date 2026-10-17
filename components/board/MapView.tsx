"use client";

import "leaflet/dist/leaflet.css";
import "./map.css";
import type { FitBoundsOptions } from "leaflet";
import { useEffect, useState } from "react";
import { MapContainer, Pane, TileLayer, ZoomControl, useMap } from "react-leaflet";
import type { HelpRequest } from "@/lib/types";
import { useBoard } from "./BoardContext";
import {
  ClusterCounts,
  ClusterShapes,
  EdgeMarks,
  EvacPoints,
  HelpPins,
  HoldLabel,
  HoldShape,
  HouseholdPins,
  ProposalShapes,
  ReportDots,
  ZoneLabels,
  ZoneShapes,
} from "./MapLayers";
import { boxOf, boxOfPoints, parseBox } from "./mapMarks";

// Esri World Light Gray: calm under the zone colors, no key needed (CARTO's light tiles now require one),
// and the same basemap family the county's ArcGIS maps use. Labels ride above the zone fills.
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
const BASE_TILES = `${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
const LABEL_TILES = `${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`;
const ATTRIBUTION =
  'Basemap &copy; <a href="https://www.esri.com">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const FALLBACK_BOX = "33.9000,-118.6000,34.2000,-118.2000"; // Los Angeles
// [x, y]: wider at the sides, where zone labels centred on edge zones would otherwise clip.
const FIT: FitBoundsOptions = { padding: [44, 20], maxZoom: 15 };

export interface MapViewProps {
  variant: "board" | "qrt";
  /** Registry rows to pin; defaults to every row that is not closed. */
  registry?: HelpRequest[];
  selectedId?: string | null;
  onSelectRegistry?: (id: string) => void;
}

/**
 * Fits the view to `box` whenever the extent changes (scenario switch, a hold opening, its polygon
 * edited). Leaflet measures its container only when told, so a resize re-measures and, until the
 * person pans or zooms by hand, fits again: the first fit can happen before the layout settles.
 */
function FitView({ box }: { box: string }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    let handled = false;
    const markHandled = () => {
      handled = true;
    };
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      if (!handled) map.fitBounds(parseBox(box), FIT);
    });
    map.fitBounds(parseBox(box), FIT);
    observer.observe(container);
    container.addEventListener("pointerdown", markHandled);
    container.addEventListener("wheel", markHandled, { passive: true });
    return () => {
      observer.disconnect();
      container.removeEventListener("pointerdown", markHandled);
      container.removeEventListener("wheel", markHandled);
    };
  }, [map, box]);
  return null;
}

/** Marks the container "near" when zoomed in, so proposal badges have room for the whole reason. */
function ZoomBand() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const update = () => {
      container.dataset.zoom = map.getZoom() >= 13 ? "near" : "far";
      // Closer still, every block's label shows (map.css); at "near" only the blocks going now and next.
      container.dataset.close = map.getZoom() >= 14 ? "1" : "0";
    };
    update();
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [map]);
  return null;
}

/** Pans to the selected registry row's last known location (QRT: list → map). */
function PanToSelected({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const lat = target?.[0];
  const lng = target?.[1];
  useEffect(() => {
    if (lat !== undefined && lng !== undefined) map.panTo([lat, lng]);
  }, [map, lat, lng]);
  return null;
}

/**
 * The map, mounted only while its route is on screen.
 *
 * Next keeps visited routes mounted in a hidden <Activity> and runs their effect cleanups while hidden.
 * react-leaflet's MapContainer removes its Leaflet map in that cleanup but keeps the removed map in
 * state, so showing the route again (Back, or a link to a page already visited) re-ran every layer and
 * pane against a dead map and the page crashed ("Map container is being reused by another instance").
 * React detaches a hidden route's refs and attaches them again when it is shown, so this callback ref
 * drops the whole Leaflet tree on hide and mounts a fresh map, with fresh panes, on show. It also covers
 * Strict Mode's simulated unmount in dev, and a real unmount (the route evicted) removes the map as before.
 */
export default function MapView(props: MapViewProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setHost} className="h-full w-full">
      {host ? <LiveMap {...props} /> : null}
    </div>
  );
}

function LiveMap({ variant, registry, selectedId = null, onSelectRegistry }: MapViewProps) {
  const { snap, zoneById, hold: selectedHold } = useBoard();
  const board = variant === "board";
  // The same open hold the hold strip shows (and its buttons act on), not just the first one.
  const hold = board ? selectedHold : null;
  const proposals = board ? snap.proposals.filter((p) => p.status === "open") : [];
  const rows = registry ?? snap.registry.filter((r) => r.status !== "closed");
  // Board: the open hold's polygon, else every zone. QRT: the rows it lists, else every zone.
  const pins = rows.flatMap((r): [number, number][] => (r.last_lat !== null && r.last_lng !== null ? [[r.last_lat, r.last_lng]] : []));
  const box =
    (hold ? boxOf([hold.polygon]) : board ? null : boxOfPoints(pins)) ?? boxOf(snap.zones.map((z) => z.geom)) ?? FALLBACK_BOX;
  const [initialBounds] = useState(() => parseBox(box));

  const selected = rows.find((r) => r.id === selectedId);
  const target: [number, number] | null =
    selected && selected.last_lat !== null && selected.last_lng !== null ? [selected.last_lat, selected.last_lng] : null;
  const residents = board ? snap.households.filter((h) => h.role === "resident" || h.role === "staff") : [];
  const edge = board ? snap.households.filter((h) => h.role === "sentinel" || h.role === "canary") : [];

  return (
    <MapContainer
      bounds={initialBounds}
      boundsOptions={FIT}
      zoomSnap={0.25}
      zoomControl={false}
      className="sk-map h-full w-full"
    >
      <TileLayer url={BASE_TILES} attribution={ATTRIBUTION} maxNativeZoom={16} maxZoom={19} />
      <ZoomControl position="topright" />
      <FitView box={box} />
      <ZoomBand />
      <PanToSelected target={target} />
      <Pane name="sk-zones" style={{ zIndex: 405 }}>
        <ZoneShapes zones={snap.zones} faint={!board} />
        <ProposalShapes proposals={proposals} zoneById={zoneById} />
      </Pane>
      <Pane name="sk-basemap-labels" style={{ zIndex: 407, pointerEvents: "none" }}>
        <TileLayer url={LABEL_TILES} maxNativeZoom={16} maxZoom={19} />
      </Pane>
      <Pane name="sk-clusters" style={{ zIndex: 410 }}>
        <ClusterShapes clusters={snap.clusters} />
        {board ? <ReportDots reports={snap.reports} /> : null}
      </Pane>
      <Pane name="sk-hold" style={{ zIndex: 415 }}>
        {hold ? <HoldShape hold={hold} /> : null}
      </Pane>
      <Pane name="sk-pins" style={{ zIndex: 420 }}>
        <HouseholdPins households={residents} mode={snap.meta.mode} />
      </Pane>
      <Pane name="sk-labels" style={{ zIndex: 430 }}>
        <ZoneLabels zones={snap.zones} proposals={proposals} mode={snap.meta.mode} />
        <ClusterCounts clusters={snap.clusters} />
        {hold ? <HoldLabel hold={hold} /> : null}
      </Pane>
      <EdgeMarks households={edge} hold={hold} canaries={snap.canaries} />
      <EvacPoints zones={snap.zones} />
      <HelpPins rows={rows} now={snap.now} selectedId={selectedId} onSelect={onSelectRegistry} />
    </MapContainer>
  );
}
