"use client";

// The browser phone (/phone/[id]): a volunteer's real phone plays one household. It polls
// GET /api/phone/[id] every second (also the presence heartbeat), rings, answers, speaks the agent's
// replies with SpeechSynthesis in the call's language, and sends what the person says (push-to-talk
// SpeechRecognition, or typed in text mode) with POST /api/phone/[id].

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { PhoneActionBody, PhoneState, PhoneTurnResult } from "@/lib/contracts";
import { languageByCode } from "@/lib/languages";
import {
  cancelAllSpeech,
  hasSpeechSynthesis,
  isAudioUnlocked,
  loadVoices,
  pickVoice,
  speak,
  startRinging,
  subscribeAudioUnlock,
  unlockAudio,
  type SpeakHandle,
  type VoiceMatch,
} from "./audio";
import { en, label, native, type LabelKey } from "./i18n";
import { FATAL_SR_ERRORS, speechRecognitionSupported, useSpeechRecognition } from "./useSpeechRecognition";

const POLL_MS = 1000;
const HOLD_MS = 350; // a press at least this long is hold-to-talk; a shorter tap toggles listening
const ENDED_STATES = new Set(["ended", "no_answer", "unreachable", "failed", "voicemail", "cancelled"]);

type Line = { role: "agent" | "person"; text: string; at: string };
type Phase = "loading" | "missing" | "idle" | "ringing" | "connect" | "connecting" | "talking" | "ended";
type MyCall = { id: string; status: "connecting" | "talking" | "ended" | "declined"; byAgent?: boolean };

const noopSubscribe = () => () => {};
function useClientValue<T>(get: () => T, server: T): T {
  return useSyncExternalStore(noopSubscribe, get, () => server);
}

async function postAction(phoneId: string, body: PhoneActionBody): Promise<PhoneTurnResult> {
  const res = await fetch(`/api/phone/${encodeURIComponent(phoneId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as (Partial<PhoneTurnResult> & { error?: string }) | null;
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return { reply: data?.reply ?? "", ended: Boolean(data?.ended), lang_code: data?.lang_code ?? "" };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** English label with the caller's language underneath. */
function Bi({ k, lang, className = "" }: { k: LabelKey; lang: string; className?: string }) {
  const n = native(k, lang);
  return (
    <span className={`flex flex-col items-center leading-tight ${className}`}>
      <span>{en(k)}</span>
      {n && <span className="text-[0.8em] font-normal opacity-80">{n}</span>}
    </span>
  );
}

export default function PhoneClient() {
  const params = useParams<{ id: string }>();
  const phoneId = typeof params?.id === "string" ? params.id : "";
  const search = useSearchParams();
  const autoAnswer = search.get("autoanswer") === "1";

  const [phone, setPhone] = useState<PhoneState | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [missing, setMissing] = useState(false);
  const [netDown, setNetDown] = useState(false);
  const [myCall, setMyCall] = useState<MyCall | null>(null);
  const [autoDone, setAutoDone] = useState(false); // the one automatic answer (?autoanswer=1) has run
  const autoStartedRef = useRef(false);
  const [turnLang, setTurnLang] = useState<string | null>(null);
  const [local, setLocal] = useState<{ callId: string; lines: Line[] }>({ callId: "", lines: [] });
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [userText, setUserText] = useState(false);
  const [srFatal, setSrFatal] = useState<string | null>(null);
  // iOS may refuse to start recognition from a touch press (not a "user activation"); then the button
  // switches to tap-to-start / tap-to-send, which starts from a click.
  const [tapOnly, setTapOnly] = useState(false);
  const srWorkedRef = useRef(false);
  const [voiceMatch, setVoiceMatch] = useState<VoiceMatch>("unknown");
  const [soundOn, setSoundOn] = useState(true);
  const [wakeLock, setWakeLock] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const unlocked = useSyncExternalStore(subscribeAudioUnlock, isAudioUnlocked, () => false);
  const srSupported = useClientValue(speechRecognitionSupported, true);
  const ttsSupported = useClientValue(hasSpeechSynthesis, true);
  const insecure = useClientValue(() => !window.isSecureContext, false);

  const call = phone?.call ?? null;
  const household = phone?.household ?? null;
  const lang = turnLang || call?.lang_code || household?.lang_code || "en-US";
  const langInfo = languageByCode(lang);

  // ---------- Polling (also the presence heartbeat) ----------
  const kickRef = useRef<() => void>(() => {});
  const latestRef = useRef<PhoneState | null>(null);
  const autoTryRef = useRef<(data: PhoneState | null) => void>(() => {});
  useEffect(() => {
    if (!phoneId) return;
    let stopped = false;
    let timer: number | undefined;
    let inFlight = false;
    let again = false;
    let failures = 0;
    const ctrl = new AbortController();
    const tick = async () => {
      if (inFlight) {
        again = true;
        return;
      }
      inFlight = true;
      let delay = POLL_MS;
      try {
        const res = await fetch(`/api/phone/${encodeURIComponent(phoneId)}`, { cache: "no-store", signal: ctrl.signal });
        if (res.status === 404) {
          setMissing(true);
          setPhone(null);
          delay = 4000;
        } else if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        } else {
          const data = (await res.json()) as PhoneState;
          latestRef.current = data;
          setPhone(data);
          setFetchedAt(Date.now());
          setMissing(false);
          autoTryRef.current(data);
        }
        failures = 0;
        setNetDown(false);
      } catch {
        if (stopped) return;
        failures++;
        if (failures >= 3) setNetDown(true);
        delay = Math.min(5000, POLL_MS * failures);
      } finally {
        inFlight = false;
      }
      if (stopped) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, again ? 0 : delay);
      again = false;
    };
    kickRef.current = () => {
      window.clearTimeout(timer);
      void tick();
    };
    void tick();
    return () => {
      stopped = true;
      ctrl.abort();
      window.clearTimeout(timer);
      kickRef.current = () => {};
    };
  }, [phoneId]);

  // ---------- Phase ----------
  const phase: Phase = useMemo(() => {
    if (!phone) return missing ? "missing" : "loading";
    if (call && myCall && call.id === myCall.id) {
      if (myCall.status === "declined") return "idle";
      if (myCall.status === "ended" || ENDED_STATES.has(call.state)) return "ended";
      return myCall.status;
    }
    if (call?.state === "ringing") return "ringing";
    if (call?.state === "active") {
      if (autoAnswer && !autoDone) return "connecting";
      return call.lines.length ? "talking" : "connect";
    }
    if (myCall?.status === "ended") return "ended";
    return "idle";
  }, [phone, missing, call, myCall, autoAnswer, autoDone]);

  const activeCallId = phase === "talking" || phase === "connecting" ? (call?.id ?? null) : null;
  const callIdRef = useRef<string | null>(null);
  const phaseRef = useRef<Phase>(phase);
  const soundOnRef = useRef(soundOn);
  useEffect(() => {
    callIdRef.current = activeCallId;
    phaseRef.current = phase;
    soundOnRef.current = soundOn;
  });

  // ---------- Speech out ----------
  const speakRef = useRef<SpeakHandle | null>(null);
  const stopSpeaking = useCallback(() => {
    speakRef.current?.cancel();
    speakRef.current = null;
    setSpeaking(false);
  }, []);

  const sayAloud = useCallback(async (text: string, lc: string) => {
    if (!text.trim() || !soundOnRef.current) return;
    speakRef.current?.cancel();
    const voices = await loadVoices();
    const { voice, match } = pickVoice(lc, voices);
    setVoiceMatch(match);
    if (match === "none") return; // no voice for this language on this device: text mode shows it
    const h = speak(text, lc, voice);
    speakRef.current = h;
    setSpeaking(true);
    await h.done;
    if (speakRef.current === h) {
      speakRef.current = null;
      setSpeaking(false);
    }
  }, []);

  // Which voices exist for this language (decides the automatic text mode).
  useEffect(() => {
    let alive = true;
    void loadVoices().then((vs) => {
      if (alive) setVoiceMatch(pickVoice(lang, vs).match);
    });
    return () => {
      alive = false;
    };
  }, [lang]);

  const appendLocal = useCallback((callId: string, line: Line) => {
    setLocal((cur) => (cur.callId === callId ? { callId, lines: [...cur.lines, line] } : { callId, lines: [line] }));
  }, []);

  const handleTurn = useCallback(
    (r: PhoneTurnResult, callId: string) => {
      if (r.lang_code) setTurnLang(r.lang_code);
      if (r.reply) {
        appendLocal(callId, { role: "agent", text: r.reply, at: new Date().toISOString() });
        // After the call ends nothing more is spoken; the goodbye that comes with ended=true still is.
        if (phaseRef.current !== "ended" || r.ended) void sayAloud(r.reply, r.lang_code || lang);
      }
      if (r.ended) setMyCall({ id: callId, status: "ended", byAgent: true });
    },
    [appendLocal, lang, sayAloud],
  );

  // ---------- Actions ----------
  const answer = useCallback(
    async (callId: string) => {
      unlockAudio(); // a tap on Answer counts as the sound unlock
      autoStartedRef.current = true; // any answer uses up the automatic one
      setMyCall({ id: callId, status: "connecting" });
      try {
        const r = await postAction(phoneId, { action: "answer", call_id: callId });
        setMyCall({ id: callId, status: r.ended ? "ended" : "talking" });
        handleTurn(r, callId);
      } catch (e) {
        setMyCall(null);
        setNotice(`Could not answer: ${errMsg(e)}`);
      } finally {
        setAutoDone(true);
      }
      kickRef.current();
    },
    [phoneId, handleTurn],
  );

  // ?autoanswer=1 (the public line): answer the first ringing or active call once sound is unlocked.
  // Runs when poll data arrives and when the sound-unlock tap happens (not in an effect).
  const tryAutoAnswer = useCallback(
    (data: PhoneState | null) => {
      if (!autoAnswer || autoStartedRef.current || !isAudioUnlocked()) return;
      const c = data?.call;
      if (!c || (c.state !== "ringing" && c.state !== "active")) return;
      void answer(c.id);
    },
    [autoAnswer, answer],
  );
  useEffect(() => {
    autoTryRef.current = tryAutoAnswer;
  });
  const unlockNow = () => {
    unlockAudio();
    tryAutoAnswer(latestRef.current);
  };

  const decline = useCallback(
    async (callId: string) => {
      setMyCall({ id: callId, status: "declined" });
      try {
        await postAction(phoneId, { action: "decline", call_id: callId });
      } catch (e) {
        setNotice(`Could not decline: ${errMsg(e)}`);
      }
      kickRef.current();
    },
    [phoneId],
  );

  const sendSay = useCallback(
    async (text: string) => {
      const callId = callIdRef.current;
      const t = text.trim();
      if (!callId || !t) return;
      appendLocal(callId, { role: "person", text: t, at: new Date().toISOString() });
      setThinking(true);
      try {
        const r = await postAction(phoneId, { action: "say", call_id: callId, text: t });
        handleTurn(r, callId);
      } catch (e) {
        setNotice(`Not sent: ${errMsg(e)}`);
      } finally {
        setThinking(false);
        kickRef.current();
      }
    },
    [phoneId, appendLocal, handleTurn],
  );

  const sr = useSpeechRecognition({
    lang,
    onFinal: (text) => {
      srWorkedRef.current = true;
      void sendSay(text);
    },
    onError: (code) => {
      const denied = code === "not-allowed" || code === "service-not-allowed";
      if (denied && !tapOnly && !srWorkedRef.current) {
        setTapOnly(true);
        setNotice("Tap the green button once to talk, and tap again to send.");
        return;
      }
      if (FATAL_SR_ERRORS.has(code) || code === "unsupported") {
        setSrFatal(
          code === "not-allowed" || code === "service-not-allowed"
            ? "Microphone permission was denied, so this call uses text."
            : code === "language-not-supported"
              ? `This browser cannot recognize ${langInfo.name} speech, so this call uses text.`
              : "Voice input is not available here, so this call uses text.",
        );
      } else if (code === "no-speech") setNotice("Didn't catch that. Hold the button while you talk, or type.");
      else if (code === "network") setNotice("Speech recognition needs an internet connection. Try again or type.");
      else setNotice(`Voice input error: ${code}`);
    },
  });
  const { abort: srAbort, finish: srFinish, start: srStart, listening } = sr;

  const hangup = useCallback(async () => {
    const callId = call?.id;
    if (!callId) return;
    stopSpeaking();
    cancelAllSpeech();
    srAbort();
    setMyCall({ id: callId, status: "ended" });
    try {
      await postAction(phoneId, { action: "hangup", call_id: callId });
    } catch (e) {
      setNotice(`Hang up failed: ${errMsg(e)}`);
    }
    kickRef.current();
  }, [call?.id, phoneId, srAbort, stopSpeaking]);

  // ---------- Effects tied to the phase ----------
  useEffect(() => {
    if (phase !== "ringing") return;
    return startRinging({ sound: unlocked && soundOn });
  }, [phase, unlocked, soundOn]);

  // Stop listening once the call is over (whoever ended it).
  useEffect(() => {
    if (phase === "ended" || phase === "idle") srAbort();
  }, [phase, srAbort]);

  // Keep the screen on while the page is open (after the first tap).
  useEffect(() => {
    if (!unlocked || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const l = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void l.release();
          return;
        }
        lock = l;
        setWakeLock(true);
        l.addEventListener("release", () => setWakeLock(false));
      } catch {
        setWakeLock(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [unlocked]);

  // Never keep talking after the page is hidden by navigation.
  useEffect(() => () => cancelAllSpeech(), []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // ---------- Transcript ----------
  const lines: Line[] = useMemo(() => {
    const server = call?.lines ?? [];
    const mine = local.callId === call?.id ? local.lines : [];
    return mine.length > server.length ? mine : server;
  }, [call, local]);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, thinking, sr.interim]);

  // ---------- Push-to-talk ----------
  const pressRef = useRef<number | null>(null);
  const pressStart = useCallback(() => {
    if (!activeCallId || thinking) return;
    if (listening) {
      srFinish(); // second tap of tap-to-talk
      pressRef.current = null;
      return;
    }
    unlockAudio();
    stopSpeaking(); // talking over the agent interrupts it
    pressRef.current = srStart() ? performance.now() : null;
  }, [activeCallId, thinking, listening, srFinish, srStart, stopSpeaking]);
  const pressEnd = useCallback(() => {
    const t0 = pressRef.current;
    pressRef.current = null;
    if (t0 !== null && performance.now() - t0 >= HOLD_MS) srFinish(); // released after holding
  }, [srFinish]);

  const onTapToggle = () => {
    if (!activeCallId || thinking) return;
    if (listening) {
      srFinish();
      return;
    }
    stopSpeaking();
    srStart();
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    pressStart();
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      pressStart();
    }
  };
  const onKeyUp = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      pressEnd();
    }
  };

  const textReason = !srSupported
    ? "Voice input isn't available in this browser, so this call uses text."
    : srFatal
      ? srFatal
      : voiceMatch === "none"
        ? `This device has no ${langInfo.name} voice, so replies are shown as text.`
        : !ttsSupported
          ? "This browser cannot speak, so replies are shown as text."
          : null;
  const textMode = userText || textReason !== null;

  const submitText = (e: FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t || thinking) return;
    setDraft("");
    void sendSay(t);
  };

  const soundCheck = () => {
    unlockAudio();
    const stop = startRinging({ sound: true });
    window.setTimeout(() => {
      stop();
      void sayAloud(label("soundCheck", lang), lang);
    }, 1300);
  };

  // ---------- Render ----------
  const roleText = household?.role === "sentinel" ? "Sentinel" : household?.role === "canary" ? "Canary" : household?.role === "staff" ? "Staff" : "Resident";
  const zone =
    call?.zone_name ||
    (call?.purpose === "inbound" ? "Public line" : household?.zone_id ? `Zone ${household.zone_id}` : "Outside the demo zones");
  const lastAgent = [...lines].reverse().find((l) => l.role === "agent")?.text ?? null;
  const elapsed = call?.answered_at && fetchedAt ? fmtElapsed(fetchedAt - Date.parse(call.answered_at)) : null;

  return (
    <main className="flex min-h-dvh flex-col bg-slate-950 text-slate-50 [-webkit-tap-highlight-color:transparent]">
      <header className="flex items-start justify-between gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Second Key{household?.device_label ? ` · ${household.device_label}` : ""}
          </p>
          <p className="truncate text-lg font-semibold">{household?.name ?? "Browser phone"}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {(phone?.simulated ?? true) && (
            <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/40">
              Simulated call
            </span>
          )}
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
            {langInfo.native}
            {langInfo.native !== langInfo.name ? ` · ${langInfo.name}` : ""}
          </span>
        </div>
      </header>

      {netDown && (
        <p role="status" className="mx-4 mb-2 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200 ring-1 ring-red-500/40">
          Can&apos;t reach the line. Retrying… Check the Wi-Fi or the link.
        </p>
      )}
      {insecure && (
        <p className="mx-4 mb-2 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-100 ring-1 ring-amber-500/40">
          This page is not on HTTPS, so the microphone and keep-awake are blocked. Open the https link (the tunnel URL).
        </p>
      )}
      {notice && (
        <p role="status" className="mx-4 mb-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200">
          {notice}
        </p>
      )}

      <section className="flex min-h-0 flex-1 flex-col px-4">
        {phase === "loading" && (
          <div className="flex flex-1 items-center justify-center text-slate-400">Connecting to the line…</div>
        )}

        {phase === "missing" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-2xl font-semibold">Phone not found</p>
            <p className="max-w-sm text-slate-400">
              This link is not a phone in the current scenario (or the line is restarting). Ask for a new link or QR code.
            </p>
            <Link href="/phones" className="rounded-xl bg-slate-800 px-5 py-3 font-medium">
              Device sheet
            </Link>
          </div>
        )}

        {phase === "idle" && household && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center">
            <div className="w-full max-w-md rounded-2xl bg-slate-900 p-5 ring-1 ring-slate-800">
              <p className="text-sm text-slate-400">This phone plays</p>
              <p className="mt-1 text-2xl font-semibold">{household.name}</p>
              <p className="mt-2 text-slate-300">
                {roleText} · {langInfo.native} · Zone {household.zone_id ?? "none"}
              </p>
            </div>
            {!unlocked ? (
              <button
                type="button"
                onClick={unlockNow}
                className="w-full max-w-md rounded-2xl bg-emerald-500 px-6 py-6 text-xl font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
              >
                Tap to enable sound
                <span className="mt-1 block text-sm font-normal">Then leave this page open. It will ring.</span>
              </button>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <span className="relative flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-400" />
                </span>
                <p className="text-xl font-medium">Waiting for a call…</p>
                <p className="max-w-xs text-sm text-slate-400">Keep this page open and the volume up. It rings here.</p>
              </div>
            )}
            <button type="button" onClick={soundCheck} className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-medium active:bg-slate-700">
              Sound check ({langInfo.native})
            </button>
          </div>
        )}

        {phase === "ringing" && call && (
          <div className="flex flex-1 flex-col items-center justify-between gap-8 py-8 text-center">
            <div>
              <p className="text-sm uppercase tracking-wider text-emerald-300">Incoming call</p>
              <p className="mt-2 text-3xl font-semibold">{en("line")}</p>
              {native("line", lang) && <p className="mt-1 text-xl text-slate-300">{native("line", lang)}</p>}
              <p className="mt-3 text-slate-400">{zone}</p>
            </div>
            <div className="relative flex h-32 w-32 items-center justify-center">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500/30" />
              <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/20 text-5xl" aria-hidden>
                ☎
              </span>
            </div>
            {!unlocked && <p className="text-sm text-amber-200">Sound is off until you tap. Answer turns it on.</p>}
            <div className="grid w-full max-w-sm grid-cols-2 gap-6">
              <button
                type="button"
                onClick={() => void decline(call.id)}
                className="flex min-h-24 items-center justify-center rounded-3xl bg-red-600 px-3 py-4 text-lg font-semibold active:scale-95"
              >
                <Bi k="decline" lang={lang} />
              </button>
              <button
                type="button"
                onClick={() => void answer(call.id)}
                className="flex min-h-24 animate-pulse items-center justify-center rounded-3xl bg-emerald-500 px-3 py-4 text-lg font-semibold text-emerald-950 active:scale-95"
              >
                <Bi k="answer" lang={lang} />
              </button>
            </div>
          </div>
        )}

        {phase === "connect" && call && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <p className="text-2xl font-semibold">{en("line")}</p>
            <button
              type="button"
              onClick={() => void answer(call.id)}
              className="w-full max-w-sm rounded-3xl bg-emerald-500 px-6 py-6 text-xl font-semibold text-emerald-950 active:scale-95"
            >
              <Bi k="answer" lang={lang} />
            </button>
          </div>
        )}

        {phase === "connecting" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-400" />
            <p className="text-lg text-slate-300">Connecting…</p>
            <p className="max-w-xs text-sm text-slate-500">The first answer can take a few seconds.</p>
            {autoAnswer && !unlocked && (
              <button
                type="button"
                onClick={unlockNow}
                className="w-full max-w-sm rounded-2xl bg-emerald-500 px-6 py-5 text-xl font-semibold text-emerald-950"
              >
                Tap to enable sound
              </button>
            )}
          </div>
        )}

        {phase === "talking" && call && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between py-1 text-sm text-slate-400">
              <span>{label("line", lang)}</span>
              <span className="tabular-nums">{elapsed ?? ""}</span>
            </div>
            <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto py-2" aria-live="polite">
              {lines.map((l, i) => (
                <div key={`${i}-${l.role}`} className={`flex ${l.role === "person" ? "justify-end" : "justify-start"}`}>
                  <p
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 ${
                      l.role === "agent" ? "rounded-bl-sm bg-slate-800 text-lg leading-snug" : "rounded-br-sm bg-emerald-600/90 text-base"
                    }`}
                  >
                    {l.text}
                  </p>
                </div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <p className="rounded-2xl rounded-bl-sm bg-slate-800 px-4 py-2.5 text-slate-400">
                    <span className="inline-block animate-pulse">● ● ●</span>
                  </p>
                </div>
              )}
              {listening && sr.interim && (
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-900/60 px-4 py-2.5 italic text-emerald-100">{sr.interim}</p>
                </div>
              )}
            </div>

            <div className="space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
              {textReason && <p className="text-center text-xs text-amber-200">{textReason}</p>}
              <p className="min-h-5 text-center text-sm text-slate-300" role="status" aria-live="polite">
                {thinking
                  ? "Agent is thinking…"
                  : listening
                    ? `${label("listening", lang)}${tapOnly ? " Tap again to send." : " Release, or tap again, to send."}`
                    : speaking
                      ? textMode
                        ? "Agent is speaking…"
                        : "Agent is speaking. Press the button to interrupt."
                      : ""}
              </p>

              {textMode ? (
                <form onSubmit={submitText} className="flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    lang={lang}
                    enterKeyHint="send"
                    placeholder={label("typeHere", lang)}
                    className="min-h-14 min-w-0 flex-1 rounded-2xl bg-slate-900 px-4 text-lg text-white ring-1 ring-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || thinking}
                    className="min-h-14 rounded-2xl bg-emerald-500 px-5 text-lg font-semibold text-emerald-950 disabled:opacity-40"
                  >
                    {label("send", lang)}
                  </button>
                </form>
              ) : (
                <div className="flex justify-center">
                  <button
                    type="button"
                    {...(tapOnly
                      ? { onClick: onTapToggle }
                      : { onPointerDown, onPointerUp: pressEnd, onPointerCancel: pressEnd, onKeyDown, onKeyUp })}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={thinking}
                    aria-pressed={listening}
                    className={`flex h-36 w-36 touch-none select-none items-center justify-center rounded-full text-base font-semibold transition [-webkit-touch-callout:none] [-webkit-user-select:none] ${
                      listening
                        ? "scale-105 bg-red-500 text-white shadow-[0_0_0_12px_rgba(239,68,68,0.25)]"
                        : "bg-emerald-500 text-emerald-950 active:scale-95 disabled:opacity-50"
                    }`}
                  >
                    {listening ? (
                      <Bi k="listening" lang={lang} className="px-2" />
                    ) : (
                      <Bi k={tapOnly ? "tap" : "hold"} lang={lang} className="px-3" />
                    )}
                  </button>
                </div>
              )}
              {!textMode && (
                <p className="text-center text-xs text-slate-500">
                  {tapOnly ? "Tap once to talk, tap again to send." : "Hold while you talk, or tap once to start and again to send."}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                {textReason ? (
                  <span />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      srAbort();
                      setUserText((v) => !v);
                    }}
                    className="min-h-12 rounded-xl bg-slate-800 px-4 text-sm font-medium active:bg-slate-700"
                  >
                    {textMode ? label("useVoice", lang) : label("typeInstead", lang)}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (soundOn) stopSpeaking();
                    setSoundOn((v) => !v);
                  }}
                  className="min-h-12 rounded-xl bg-slate-800 px-4 text-sm font-medium active:bg-slate-700"
                  aria-pressed={!soundOn}
                >
                  {soundOn ? "Mute agent" : "Unmute agent"}
                </button>
                <button
                  type="button"
                  onClick={() => void hangup()}
                  className="min-h-12 rounded-xl bg-red-600 px-5 text-sm font-semibold active:bg-red-700"
                >
                  {label("hangUp", lang)}
                </button>
              </div>
              {lastAgent && !speaking && soundOn && !textMode && (
                <button
                  type="button"
                  onClick={() => void sayAloud(lastAgent, lang)}
                  className="w-full text-center text-xs text-slate-400 underline underline-offset-2"
                >
                  Repeat the last thing the agent said
                </button>
              )}
            </div>
          </div>
        )}

        {phase === "ended" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6 text-center">
            <p className="text-3xl font-semibold">
              <Bi k="ended" lang={lang} />
            </p>
            {lastAgent && myCall?.byAgent && <p className="max-w-md text-lg text-slate-300">“{lastAgent}”</p>}
            <p className="text-slate-400">Waiting for the next call. Keep this page open.</p>
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                setMyCall(null);
                setLocal({ callId: "", lines: [] });
              }}
              className="rounded-xl bg-slate-800 px-6 py-3 font-medium active:bg-slate-700"
            >
              Done
            </button>
          </div>
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-[11px] text-slate-500">
        <span>{netDown ? "● offline" : phone ? "● online" : "○ connecting"}</span>
        <span>{unlocked ? "sound on" : "sound locked"}</span>
        <span>{wakeLock ? "screen stays on" : "screen may sleep"}</span>
        {phone?.retell && <span>real-phone calls on</span>}
      </footer>
    </main>
  );
}
