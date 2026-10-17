"use client";

// The live-location share on the person's phone: polls the link's state, and while sharing watches the GPS
// (navigator.geolocation.watchPosition, high accuracy) and posts fixes. Throttle: at most one fix every 5 s, sooner
// after 25 m of movement. Keeps the screen awake while sharing when the browser allows it. Used by /l/[token] and by
// the in-call card on the browser phone.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ShareView } from "@/lib/contracts";
import { getShare, LinkError, postShare } from "./api";

const POLL_MS = 5_000;
const SEND_EVERY_MS = 5_000;
const MOVED_M = 25;
const MOVED_MIN_GAP_MS = 2_500; // the server accepts one fix every 2 s
const HEARTBEAT_MS = 15_000; // a phone that does not move still sends a fresh fix this often
const MAX_ACCURACY_M = 5_000;

export type GeoProblem = "denied" | "unavailable" | "timeout" | "unsupported" | "insecure" | "coarse";

export interface LiveShare {
  view: ShareView | null;
  missing: boolean;
  /** The link no longer accepts fixes (stopped, expired, help reached): the server's sentence. */
  gone: string | null;
  error: string | null;
  sharing: boolean;
  lastSentAt: number | null;
  accuracy: number | null;
  geo: GeoProblem | null;
  wakeLock: boolean;
  start: () => void;
  stop: () => Promise<void>;
  sendStated: (text: string) => Promise<{ found: boolean; label: string | null }>;
}

function meters(a: GeolocationCoordinates, b: GeolocationCoordinates): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.latitude - a.latitude);
  const dLng = r(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

const ACTIVE = new Set(["sent", "live"]);

export function useLiveShare(token: string): LiveShare {
  const [view, setView] = useState<ShareView | null>(null);
  const [missing, setMissing] = useState(false);
  const [gone, setGone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [geo, setGeo] = useState<GeoProblem | null>(null);
  const [wakeLock, setWakeLock] = useState(false);

  const watchRef = useRef<number | null>(null);
  const lockRef = useRef<WakeLockSentinel | null>(null);
  const sentRef = useRef<{ at: number; coords: GeolocationCoordinates } | null>(null);
  const inFlightRef = useRef(false);
  const sharingRef = useRef(false);

  const releaseLock = useCallback(() => {
    lockRef.current?.release().catch(() => undefined);
    lockRef.current = null;
    setWakeLock(false);
  }, []);

  const requestLock = useCallback(async () => {
    try {
      if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
      const lock = await navigator.wakeLock.request("screen");
      lockRef.current = lock;
      setWakeLock(true);
      lock.addEventListener("release", () => {
        if (lockRef.current === lock) {
          lockRef.current = null;
          setWakeLock(false);
        }
      });
    } catch {
      setWakeLock(false); // not allowed (battery saver, iOS before 16.4): sharing still works while the page is open
    }
  }, []);

  const endWatch = useCallback(() => {
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    watchRef.current = null;
    sharingRef.current = false;
    setSharing(false);
    releaseLock();
  }, [releaseLock]);

  const accept = useCallback(
    (v: ShareView) => {
      setView(v);
      setMissing(false);
      if (!ACTIVE.has(v.status)) endWatch();
    },
    [endWatch],
  );

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof LinkError) {
        if (e.status === 404) setMissing(true);
        else if (e.status === 410) {
          setGone(e.message);
          endWatch();
        } else if (e.status !== 429) setError(e.message);
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
    },
    [endWatch],
  );

  // Poll the link's state (helper assigned, help reached, expiry) whether or not this phone is sharing.
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const v = await getShare(token);
        if (!stopped) {
          accept(v);
          setError(null);
        }
      } catch (e) {
        if (!stopped) fail(e);
      }
      if (!stopped) timer = window.setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [token, accept, fail]);

  const send = useCallback(
    async (pos: GeolocationPosition) => {
      if (inFlightRef.current || !sharingRef.current) return;
      const c = pos.coords;
      if (!Number.isFinite(c.accuracy) || c.accuracy > MAX_ACCURACY_M) {
        setGeo("coarse");
        return;
      }
      inFlightRef.current = true;
      try {
        const v = await postShare(token, {
          lat: c.latitude,
          lng: c.longitude,
          accuracy_m: c.accuracy,
          heading: c.heading ?? null,
          speed: c.speed ?? null,
          captured_at: new Date(pos.timestamp || Date.now()).toISOString(),
        });
        sentRef.current = { at: Date.now(), coords: c };
        setLastSentAt(Date.now());
        setAccuracy(Math.round(c.accuracy));
        setGeo(null);
        setError(null);
        accept(v);
      } catch (e) {
        fail(e);
      } finally {
        inFlightRef.current = false;
      }
    },
    [token, accept, fail],
  );

  const onPosition = useCallback(
    (pos: GeolocationPosition) => {
      const last = sentRef.current;
      const now = Date.now();
      if (!last) return void send(pos);
      const gap = now - last.at;
      if (gap >= SEND_EVERY_MS || (gap >= MOVED_MIN_GAP_MS && meters(last.coords, pos.coords) >= MOVED_M)) void send(pos);
    },
    [send],
  );

  const onGeoError = useCallback(
    (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setGeo("denied");
        endWatch();
      } else setGeo(err.code === err.TIMEOUT ? "timeout" : "unavailable");
    },
    [endWatch],
  );

  const start = useCallback(() => {
    setError(null);
    if (typeof window !== "undefined" && !window.isSecureContext) return setGeo("insecure");
    if (!("geolocation" in navigator)) return setGeo("unsupported");
    if (watchRef.current !== null) return;
    sharingRef.current = true;
    setSharing(true);
    setGeo(null);
    watchRef.current = navigator.geolocation.watchPosition(onPosition, onGeoError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 30_000,
    });
    void requestLock();
  }, [onPosition, onGeoError, requestLock]);

  // A phone that sits still may not report a new position: ask for a fresh one now and then.
  useEffect(() => {
    if (!sharing) return;
    const id = window.setInterval(() => {
      const last = sentRef.current;
      if (last && Date.now() - last.at < HEARTBEAT_MS) return;
      navigator.geolocation?.getCurrentPosition((p) => void send(p), () => undefined, {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 15_000,
      });
    }, SEND_EVERY_MS);
    return () => window.clearInterval(id);
  }, [sharing, send]);

  // The screen lock is dropped whenever the page is hidden; take it again on return.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && sharingRef.current && !lockRef.current) void requestLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [requestLock]);

  // Leaving the page stops the watch (the link itself stays on until stopped, help arrives, or 4 hours).
  useEffect(() => endWatch, [endWatch]);

  const stop = useCallback(async () => {
    endWatch();
    try {
      accept(await postShare(token, { action: "stop" }));
    } catch (e) {
      fail(e);
    }
  }, [token, endWatch, accept, fail]);

  const sendStated = useCallback(
    async (text: string) => {
      const r = await postShare(token, { action: "stated", text });
      accept(r);
      return r.stated ?? { found: false, label: null };
    },
    [token, accept],
  );

  return { view, missing, gone, error, sharing, lastSentAt, accuracy, geo, wakeLock, start, stop, sendStated };
}

/** Re-render every second while `on` (for "last sent N s ago"). */
export function useNow(on: boolean): number {
  // 0 until the first tick: reading the clock during render would be baked into the prerender.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!on) return;
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [on]);
  return now;
}
