"use client";

// Push-to-talk speech recognition (Web Speech API: SpeechRecognition / webkitSpeechRecognition).
// start() begins listening, finish() stops and delivers the final text to onFinal, abort() drops it.
// Recognition that ends on its own while the user still wants to talk (Android ends after each phrase,
// iOS after a pause) is restarted and the text accumulated, until finish() or abort().

import { useCallback, useEffect, useRef, useState } from "react";

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: RecognitionResult };
}
interface RecognitionErrorEvent {
  readonly error: string;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported(): boolean {
  return recognitionCtor() !== null;
}

/** Errors that mean voice input will not work here: switch to text mode. */
export const FATAL_SR_ERRORS = new Set(["not-allowed", "service-not-allowed", "language-not-supported", "audio-capture"]);

export function useSpeechRecognition(opts: { lang: string; onFinal: (text: string) => void; onError?: (code: string) => void }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<Recognition | null>(null);
  const wantRef = useRef(false); // the user still wants to talk
  const finalRef = useRef(""); // text finalized across restarts
  const sessionFinalRef = useRef(""); // finals within the current recognition session
  const interimRef = useRef("");
  const restartsRef = useRef(0);
  const deliverRef = useRef(false); // finish() asked to deliver on end
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  const deliver = useCallback(() => {
    const text = `${finalRef.current} ${interimRef.current}`.replace(/\s+/g, " ").trim();
    finalRef.current = "";
    sessionFinalRef.current = "";
    interimRef.current = "";
    setInterim("");
    if (text) optsRef.current.onFinal(text);
    else optsRef.current.onError?.("no-speech");
  }, []);

  const startSession = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      optsRef.current.onError?.("unsupported");
      return false;
    }
    const rec = new Ctor();
    rec.lang = optsRef.current.lang;
    // Android Chrome repeats earlier text in continuous mode: use single-phrase sessions and restart.
    rec.continuous = !isAndroid;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    sessionFinalRef.current = "";

    rec.onresult = (e) => {
      let finals = "";
      let pending = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finals += `${t} `;
        else pending += t;
      }
      sessionFinalRef.current = finals.trim();
      interimRef.current = pending.trim();
      setInterim(`${finalRef.current} ${sessionFinalRef.current} ${pending}`.replace(/\s+/g, " ").trim());
    };
    rec.onerror = (e) => {
      if (e.error === "aborted") return;
      if (e.error === "no-speech" && wantRef.current) return; // keep waiting while held
      if (FATAL_SR_ERRORS.has(e.error) || e.error === "network") {
        wantRef.current = false;
        deliverRef.current = false;
      }
      optsRef.current.onError?.(e.error);
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      finalRef.current = `${finalRef.current} ${sessionFinalRef.current}`.trim();
      sessionFinalRef.current = "";
      if (wantRef.current && restartsRef.current < 40) {
        // Ended on its own while the user is still talking: keep listening.
        restartsRef.current++;
        if (interimRef.current) {
          finalRef.current = `${finalRef.current} ${interimRef.current}`.trim();
          interimRef.current = "";
        }
        try {
          rec.start();
          return;
        } catch {
          /* fall through */
        }
      }
      recRef.current = null;
      setListening(false);
      if (deliverRef.current) {
        deliverRef.current = false;
        deliver();
      } else {
        finalRef.current = "";
        interimRef.current = "";
        setInterim("");
      }
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      recRef.current = null;
      optsRef.current.onError?.(err instanceof Error ? err.message : "start-failed");
      return false;
    }
    return true;
  }, [deliver, isAndroid]);

  const start = useCallback(() => {
    if (recRef.current) return true;
    wantRef.current = true;
    deliverRef.current = true;
    restartsRef.current = 0;
    finalRef.current = "";
    interimRef.current = "";
    setInterim("");
    const ok = startSession();
    setListening(ok);
    if (!ok) wantRef.current = false;
    return ok;
  }, [startSession]);

  /** Stop listening and deliver what was heard. */
  const finish = useCallback(() => {
    wantRef.current = false;
    const rec = recRef.current;
    if (!rec) return;
    deliverRef.current = true;
    try {
      rec.stop();
    } catch {
      rec.onend?.();
    }
  }, []);

  /** Stop listening and throw the text away. */
  const abort = useCallback(() => {
    wantRef.current = false;
    deliverRef.current = false;
    const rec = recRef.current;
    if (!rec) return;
    try {
      rec.abort();
    } catch {
      rec.onend?.();
    }
  }, []);

  // Never leave the microphone open when the component goes away (or is hidden by Activity).
  useEffect(() => () => {
    wantRef.current = false;
    deliverRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.abort();
    } catch {
      /* ignore */
    }
  }, []);

  return { listening, interim, start, finish, abort };
}
