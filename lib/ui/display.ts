// Display-only helpers: safe lookups by mode (a stored mode the labels no longer know, such as an old
// "campus" run, falls back to city wording instead of crashing) and engine text shown without the
// word "simulated". Stored data is never changed here. Never pass a directive or any approved words
// through plain(): the board shows those exactly as they are relayed.
import { MODE_LABEL, WORDING } from "@/lib/client/labels";
import type { Mode } from "@/lib/types";

export const modeWords = (mode: string) => WORDING[mode as Mode] ?? WORDING.civilian;

export const modeLabel = (mode: string) => MODE_LABEL[mode as Mode] ?? MODE_LABEL.civilian;

const keepCase = (from: string, to: string) =>
  from === from.toUpperCase() ? to.toUpperCase() : from[0] === from[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to;

/**
 * Engine and script text for display, without "simulated": "Autoplay supervisor (simulated)" →
 * "Autoplay supervisor", "Send · simulated" → "Send", "met in simulation" → "met in rehearsal",
 * any other "simulated" or "simulator" → "demo".
 */
export function plain(text: string): string;
export function plain(text: string | null | undefined): string | null | undefined;
export function plain(text: string | null | undefined) {
  if (!text) return text;
  return text
    .replace(/\b(every send|everything)( here| in this build)? is simulated\b/gi, (m, what: string, where = "") =>
      keepCase(m, `${/send/i.test(what) ? "no send" : "nothing"}${where} reaches a real alert system`),
    )
    .replace(/\blabeled simulated\b/gi, "labeled as stand-ins")
    .replace(/\s*\((?:simulated|sim)\)/gi, "")
    .replace(/\s*·\s*simulated\b/gi, "")
    .replace(/\b(in|during) simulation\b/gi, (_m, w: string) => `${w} rehearsal`)
    .replace(/\bsimulations?\b/gi, (m) => keepCase(m, "demo"))
    .replace(/\bsimulated\b/gi, (m) => keepCase(m, "demo"))
    .replace(/\bsimulators?\b/gi, (m) => keepCase(m, "demo"))
    .replace(/ {2,}/g, " ");
}

/** "Autoplay supervisor (simulated)" → "Autoplay supervisor", for display only. */
export const displayActor = (actor: string) => plain(actor).trim() || actor;
