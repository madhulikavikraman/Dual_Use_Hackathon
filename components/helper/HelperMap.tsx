"use client";

import "leaflet/dist/leaflet.css";
import "@/components/board/map.css";
import { useEffect, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { icon, liveDotHtml, pathStyle } from "@/components/board/mapMarks";

// The helper's small map: the person's latest fix and its accuracy circle. Loaded in the browser only.

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
const BASE_TILES = `${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
const LABEL_TILES = `${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`;
const ATTRIBUTION =
  'Basemap &copy; <a href="https://www.esri.com">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const CIRCLE = pathStyle({ color: "#2563eb", weight: 1.5, fillColor: "#3b82f6", fillOpacity: 0.15 });
const CIRCLE_LOW = pathStyle({ color: "#b45309", weight: 1.5, dashArray: "4 4", fillColor: "#f59e0b", fillOpacity: 0.1 });

function Follow({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([lat, lng]);
  }, [map, lat, lng]);
  return null;
}

export interface HelperMapProps {
  lat: number;
  lng: number;
  accuracy_m: number | null;
  live: boolean;
  fresh: boolean;
}

/** Mounted through a callback ref, like the board map, so a hidden-then-shown route gets a fresh Leaflet map. */
export default function HelperMap(props: HelperMapProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setHost} className="h-full w-full">
      {host ? <Inner {...props} /> : null}
    </div>
  );
}

function Inner({ lat, lng, accuracy_m, live, fresh }: HelperMapProps) {
  const [center] = useState<[number, number]>(() => [lat, lng]);
  const style = live ? CIRCLE : CIRCLE_LOW;
  return (
    <MapContainer center={center} zoom={accuracy_m && accuracy_m > 500 ? 14 : 17} className="sk-map h-full w-full" zoomSnap={0.5}>
      <TileLayer url={BASE_TILES} attribution={ATTRIBUTION} maxNativeZoom={16} maxZoom={19} />
      <TileLayer url={LABEL_TILES} maxNativeZoom={16} maxZoom={19} />
      <Follow lat={lat} lng={lng} />
      {accuracy_m ? <Circle center={[lat, lng]} radius={Math.max(5, accuracy_m)} interactive={false} {...style} pathOptions={style} /> : null}
      <Marker position={[lat, lng]} icon={icon(liveDotHtml(live && fresh))} keyboard={false} />
    </MapContainer>
  );
}
