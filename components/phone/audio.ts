// Browser audio for the phone pages: the iOS sound unlock, the ring, and speech synthesis.
// Client-only (window APIs); every function is safe to call during SSR (it no-ops).

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let unlocked = false;

export const hasWindow = () => typeof window !== "undefined";
export const hasSpeechSynthesis = () => hasWindow() && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

/** True once unlockAudio() ran in a user gesture in this document (survives client-side navigation). */
export function isAudioUnlocked(): boolean {
  return unlocked;
}

const UNLOCK_EVENT = "secondkey:audio-unlocked";

/** useSyncExternalStore subscription for isAudioUnlocked(). */
export function subscribeAudioUnlock(cb: () => void): () => void {
  if (!hasWindow()) return () => {};
  window.addEventListener(UNLOCK_EVENT, cb);
  return () => window.removeEventListener(UNLOCK_EVENT, cb);
}

function audioContext(): AudioContext | null {
  if (!hasWindow()) return null;
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

/**
 * Call from a tap/click handler. iOS only lets a page make sound after a user gesture: resume an
 * AudioContext with a silent buffer and prime speechSynthesis with an empty utterance.
 */
export function unlockAudio(): void {
  if (!hasWindow()) return;
  const ac = audioContext();
  if (ac) {
    try {
      void ac.resume();
      const buf = ac.createBuffer(1, 1, 22050);
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(ac.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
  }
  if (hasSpeechSynthesis()) {
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }
  if (!unlocked) {
    unlocked = true;
    window.dispatchEvent(new Event(UNLOCK_EVENT));
  }
}

/** Start a phone ring (two short double-tone bursts every 2.2 s) plus vibration. Returns stop(). */
export function startRinging(opts: { sound: boolean }): () => void {
  if (!hasWindow()) return () => {};
  let stopped = false;
  let timer: number | undefined;
  const ac = opts.sound ? audioContext() : null;

  const burst = (t0: number) => {
    if (!ac) return;
    for (const [start, dur] of [[0, 0.42], [0.6, 0.42]] as const) {
      const g = ac.createGain();
      const a = t0 + start;
      g.gain.setValueAtTime(0.0001, a);
      g.gain.exponentialRampToValueAtTime(0.3, a + 0.02);
      g.gain.setValueAtTime(0.3, a + dur - 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, a + dur);
      g.connect(ac.destination);
      for (const f of [880, 1175]) {
        const o = ac.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        o.connect(g);
        o.start(a);
        o.stop(a + dur + 0.02);
      }
    }
  };

  const cycle = () => {
    if (stopped) return;
    if (ac) {
      if (ac.state === "suspended") void ac.resume().catch(() => undefined);
      try {
        burst(ac.currentTime + 0.05);
      } catch {
        /* ignore */
      }
    }
    try {
      navigator.vibrate?.([420, 180, 420]);
    } catch {
      /* ignore */
    }
    timer = window.setTimeout(cycle, 2200);
  };
  cycle();

  return () => {
    stopped = true;
    if (timer !== undefined) window.clearTimeout(timer);
    try {
      navigator.vibrate?.(0);
    } catch {
      /* ignore */
    }
  };
}

// ---------- Speech synthesis ----------

const norm = (lang: string) => lang.replace("_", "-").toLowerCase();

/** Voices load lazily on Chrome/Android: wait for voiceschanged (bounded). */
export function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (!hasSpeechSynthesis()) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      clearTimeout(t);
      resolve(window.speechSynthesis.getVoices());
    };
    const t = setTimeout(done, timeoutMs);
    window.speechSynthesis.addEventListener("voiceschanged", done);
  });
}

export type VoiceMatch = "exact" | "prefix" | "none" | "unknown";

/** Voice for a BCP-47 tag: exact match, else same language prefix (es-US -> es-MX), else none. */
export function pickVoice(lang: string, voices: SpeechSynthesisVoice[]): { voice: SpeechSynthesisVoice | null; match: VoiceMatch } {
  if (!voices.length) return { voice: null, match: "unknown" }; // list not available: let the browser choose by lang
  const want = norm(lang);
  const prefix = want.split("-")[0];
  const score = (v: SpeechSynthesisVoice) => (v.localService ? 0 : 1) + (v.default ? -0.5 : 0);
  const exact = voices.filter((v) => norm(v.lang) === want).sort((a, b) => score(a) - score(b));
  if (exact[0]) return { voice: exact[0], match: "exact" };
  // Mandarin: zh-CN may be listed as cmn-Hans-CN; Filipino as tl-PH.
  const aliases: Record<string, string[]> = { zh: ["zh", "cmn"], fil: ["fil", "tl"], hy: ["hy"] };
  const prefixes = aliases[prefix] ?? [prefix];
  const near = voices.filter((v) => prefixes.includes(norm(v.lang).split("-")[0])).sort((a, b) => score(a) - score(b));
  if (near[0]) return { voice: near[0], match: "prefix" };
  return { voice: null, match: "none" };
}

/** Split into sentences so long replies are not cut off (Chrome stops utterances after ~15 s). */
function chunks(text: string): string[] {
  const parts = text.match(/[^.!?。！？।]+[.!?。！？।]*[\s"”』」)]*/g) ?? [text];
  return parts.map((p) => p.trim()).filter(Boolean);
}

export interface SpeakHandle {
  cancel: () => void;
  done: Promise<void>;
}

/** Speak text in a language. Resolves `done` when finished (or a watchdog fires: iOS can drop onend). */
export function speak(text: string, lang: string, voice: SpeechSynthesisVoice | null, opts: { rate?: number } = {}): SpeakHandle {
  if (!hasSpeechSynthesis() || !text.trim()) return { cancel: () => {}, done: Promise.resolve() };
  const synth = window.speechSynthesis;
  let cancelled = false;
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));
  const finish = () => {
    window.clearTimeout(timer);
    resolveDone();
  };

  const parts = chunks(text);
  const totalChars = parts.reduce((n, p) => n + p.length, 0);
  // CJK packs more speech per character.
  const perChar = /[぀-ヿ㐀-鿿가-힯]/.test(text) ? 260 : 85;
  const timer = window.setTimeout(finish, totalChars * perChar + 4000);

  try {
    synth.cancel();
    synth.resume(); // Chrome can be stuck "paused"
  } catch {
    /* ignore */
  }
  // Chrome drops an utterance queued in the same tick as cancel(); wait a beat.
  window.setTimeout(() => {
    if (cancelled) return finish();
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = lang;
      if (voice) u.voice = voice;
      u.rate = opts.rate ?? 1;
      if (i === parts.length - 1) {
        u.onend = finish;
        u.onerror = finish;
      }
      synth.speak(u);
    });
  }, 60);

  return {
    cancel: () => {
      cancelled = true;
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
      finish();
    },
    done,
  };
}

export function cancelAllSpeech(): void {
  if (!hasSpeechSynthesis()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
