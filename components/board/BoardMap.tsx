"use client";

import dynamic from "next/dynamic";

/** The Leaflet map, loaded in the browser only (Leaflet touches window when imported). */
export const BoardMap = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-500">Loading the map…</div>,
});
