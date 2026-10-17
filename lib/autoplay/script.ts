// "Play the full fire": the demo run (docs/DEMO.md, "The run") as an ordered list of beats. Each beat has a
// ladder rung, a caption for the room, an action that calls the same HTTP APIs the board's buttons call, and a
// condition checked against GET /api/board with a timeout, after which the run moves on and says so.
// Isomorphic: the board's overlay (components/autoplay) and scripts/autoplay-check.ts run the same beats.
// No server-only imports: only types from the contracts, plus fetch and timers.
import type { BoardSnapshot, CallView, HouseholdView } from "@/lib/contracts";
import type { Canary, EvacPlan, HelpRequest, Hold, Zone } from "@/lib/types";

/** Every decision autoplay makes is signed with this name; metrics never count it as a human decision. */
export const AUTOPLAY_ACTOR = "Autoplay supervisor (simulated)";

// ---------- The ladder ----------

export type Rung = "watch" | "ask" | "slow" | "hold" | "hand";

export const RUNGS: { id: Rung; label: string }[] = [
  { id: "watch", label: "Watch" },
  { id: "ask", label: "Ask" },
  { id: "slow", label: "Slow" },
  { id: "hold", label: "Hold" },
  { id: "hand", label: "Hand to a person" },
];

// ---------- Environment: where the APIs are and how the board is read ----------

export interface AutoplayEnv {
  /** "" in the browser (same origin); "http://localhost:3101" from Node. */
  base: string;
  headers?: Record<string, string>;
  /** A fresh board snapshot now (GET /api/board). */
  board(signal?: AbortSignal): Promise<BoardSnapshot>;
  /** The next snapshot, about a second from now: the clock of every wait. */
  next(signal?: AbortSignal): Promise<BoardSnapshot>;
}

export class AutoplayHttpError extends Error {
  constructor(
    public status: number,
    message: string,
    /** True when the route itself does not exist (a 404 without a JSON error body). */
    public missing: boolean,
  ) {
    super(message);
  }
}

export function abortError(): Error {
  const e = new Error("Autoplay stopped");
  e.name = "AbortError";
  return e;
}

export const isAbort = (e: unknown) => e instanceof Error && e.name === "AbortError";

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** One JSON request to the app's API. Errors carry the server's message. */
export async function api<T>(env: AutoplayEnv, method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(env.base + path, {
      method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...env.headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (isAbort(e) || signal?.aborted) throw abortError();
    throw new AutoplayHttpError(0, `${method} ${path}: the server did not answer`, false);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : null;
    throw new AutoplayHttpError(res.status, msg ?? `${method} ${path}: HTTP ${res.status}`, res.status === 404 && msg === null);
  }
  return data as T;
}

/** The environment for Node (the check script): poll GET /api/board once a second. */
export function httpEnv(base: string, headers?: Record<string, string>): AutoplayEnv {
  const env: AutoplayEnv = {
    base: base.replace(/\/+$/, ""),
    headers,
    board: (signal) => api<BoardSnapshot>(env, "GET", "/api/board", undefined, signal),
    next: async (signal) => {
      await sleep(1000, signal);
      return env.board(signal);
    },
  };
  return env;
}

// ---------- Run memory, shared between beats ----------

export interface Memo {
  /** Autopilot before the first reset, put back on Exit. Null until autoplay has changed it. */
  autopilotBefore: boolean | null;
  /** Autoplay switched Wrong polygon on and no hold has used it yet. */
  wrongPolygonSet: boolean;
  holdId: string | null;
  doseBefore: number | null;
  doseAfter: number | null;
  /** Server time the current beat started (snapshot `now`). */
  beatAt: string;
  marks: Record<string, string>;
}

export const newMemo = (): Memo => ({
  autopilotBefore: null, wrongPolygonSet: false, holdId: null, doseBefore: null, doseAfter: null, beatAt: "", marks: {},
});

export interface BeatCtx {
  env: AutoplayEnv;
  memo: Memo;
  /** Fresh at the start of the beat; the latest one during the wait. */
  snap: BoardSnapshot;
  signal?: AbortSignal;
}

/** Put back what autoplay changed: autopilot to its prior state, an unused Wrong polygon switch off. */
export async function restoreAfterAutoplay(env: AutoplayEnv, memo: Memo, keepalive = false): Promise<void> {
  const patch: Record<string, boolean> = {};
  if (memo.autopilotBefore !== null) patch.autopilot_devices = memo.autopilotBefore;
  if (memo.wrongPolygonSet) patch.wrong_polygon = false;
  if (!Object.keys(patch).length) return;
  await fetch(env.base + "/api/demo/sim", {
    method: "POST",
    headers: { "content-type": "application/json", ...env.headers },
    body: JSON.stringify(patch),
    keepalive,
  });
  memo.wrongPolygonSet = false;
}

// ---------- Beats ----------

export type SideTab = "zones" | "registry" | "feed" | "ledger";

export interface Beat {
  id: string;
  rung: Rung;
  title: string;
  /** One or two short sentences for the room. */
  caption: string;
  /** What the board should show: a side-panel tab, and the element to spotlight (tour anchors, first match wins). */
  focus?: { tab?: SideTab; target?: string | string[] };
  /** Minimum time on screen at 1x, in ms. */
  dwellMs: number;
  /** After a late condition or a timeout: time to read the result line at 1x (default 3.5 s). */
  afterMs?: number;
  /** Never fails the run. */
  optional?: boolean;
  /** Hidden until it applies: shown once `skip` passes (beats with an action) or `until` holds (beats without). */
  quiet?: boolean;
  /** A reason to skip before the beat starts (a feature that is not there). */
  skip?: (ctx: BeatCtx) => Promise<string | null> | string | null;
  /** Calls the board's APIs. May return a short line for the room. */
  act?: (ctx: BeatCtx) => Promise<string | void>;
  /** What the beat waits for. */
  until?: (snap: BoardSnapshot, memo: Memo, ctx: BeatCtx) => boolean | Promise<boolean>;
  /** A live line while waiting. */
  progress?: (snap: BoardSnapshot, memo: Memo) => string | null;
  /** What happened, once `until` holds. */
  outcome?: (snap: BoardSnapshot, memo: Memo) => string | null;
  /** Wait limit in ms (default 60 s); a function reads the board (a hold's deadline). */
  timeoutMs?: number | ((snap: BoardSnapshot, memo: Memo) => number);
  /** Said when the wait runs out and the run moves on. */
  timeoutNote?: string;
}

// ---------- Board selectors ----------

const ZONE = "LA-CC"; // Culver City and Palms, the demo zone
const FINAL = new Set(["safe", "leaving", "needs_help", "wont_leave", "unclear", "wrong_number", "unreachable"]);
const UNANSWERED = new Set(["no_answer", "unreachable", "failed", "voicemail"]);

const device = (snap: BoardSnapshot, n: number): HouseholdView | undefined =>
  snap.households.find((h) => h.device_label !== null && new RegExp(`^Phone ${n}\\b`).test(h.device_label));
const person = (snap: BoardSnapshot, name: string) => snap.households.find((h) => h.name === name);
const zoneOf = (snap: BoardSnapshot, id = ZONE): Zone | undefined => snap.zones.find((z) => z.id === id);
const holdOf = (snap: BoardSnapshot, memo: Memo): Hold | undefined => snap.holds.find((h) => h.id === memo.holdId);
const peopleRow = (snap: BoardSnapshot, householdId: string | undefined): HelpRequest | undefined =>
  householdId ? snap.registry.find((r) => r.household_id === householdId && (r.kind ?? "people") === "people" && r.status !== "closed") : undefined;
const nameOf = (snap: BoardSnapshot, id: string) => snap.households.find((h) => h.id === id)?.name ?? "a sentinel";
const fmtN = (n: number) => Math.round(n).toLocaleString("en-US");
/** Stored enum words ("no_car") as plain words. */
const words = (s: string) => s.replace(/_/g, " ");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

function warningCalls(snap: BoardSnapshot): CallView[] {
  const camp = snap.campaigns.find((c) => c.zone_id === ZONE && c.kind === "warning" && c.wave === 1);
  return camp ? snap.calls.filter((c) => c.campaign_id === camp.id) : [];
}

function languagesHeard(snap: BoardSnapshot): string[] {
  const seen = new Set<string>();
  for (const c of [...snap.calls].reverse()) {
    if (c.answered_at && (c.purpose === "resident" || c.purpose === "linked_contact") && c.language) seen.add(c.language);
  }
  return [...seen];
}

const LOCATION_WORDS: Record<HelpRequest["last_source"], string> = {
  gps_link: "her live location, shared with her consent",
  stated: "the place she named on the call",
  enrolled: "her enrolled address",
  centroid: "the zone's center (low precision)",
};

function tally(h: Hold): string {
  const t = h.tally;
  return `Sentinels: ${t.yes} yes, ${t.no} no, ${t.unsure} unsure, ${t.silent} silent, ${t.pending} waiting.`;
}

/** Seconds of hold left, read from the board's clock. */
const holdLeftMs = (snap: BoardSnapshot, memo: Memo) => {
  const h = holdOf(snap, memo);
  return h ? Date.parse(h.deadline) - Date.parse(snap.now) : 0;
};

const sign = (reason: string) => ({ actor: AUTOPLAY_ACTOR, reason });

/** "Wave 1 goes now: CC-01, CC-02 and CC-05, about 4,540 people. 42 blocks in 11 waves of 20 min; busiest road 95%." */
function planLine(p: EvacPlan): string {
  const wave = Math.max(1, p.current_wave);
  const now = p.blocks.filter((b) => b.wave === wave);
  const total = Math.max(0, ...p.blocks.map((b) => b.wave));
  const load = p.waves.find((w) => w.n === wave)?.load ?? {};
  const busiest = Math.max(0, ...p.routes.map((r) => ((load[r.id] ?? 0) / Math.max(1, Math.floor((r.capacity_vph * p.wave_minutes) / 60))) * 100));
  return `Wave ${wave} goes now: ${list(now.map((b) => b.id))}, about ${fmtN(now.reduce((t, b) => t + b.people_est, 0))} people (estimate). ` +
    `${p.blocks.length} blocks in ${total} waves of ${p.wave_minutes} min; the busiest road is at ${Math.round(busiest)}% of what it carries.`;
}

/** The parts of GET /api/registry/live (helper dispatch, built in parallel) this script reads. Kept local on purpose. */
interface LiveRegistryLite {
  roster?: { id: string; label: string; vehicle?: string }[];
  dispatches?: { help_request_id: string; helper_label?: string }[];
}

// ---------- The run ----------

export const BEATS: Beat[] = [
  {
    id: "reset",
    rung: "watch",
    title: "The Westside Fire (simulated)",
    caption:
      "Santa Monica is under an Evacuation Order, moving out block by block: gray blocks are done, red ones go now, yellow ones get ready. Venice is under a Warning. Everything here is simulated; autopilot answers for the six volunteer phones.",
    focus: { tab: "zones", target: '[data-tour="map"]' },
    dwellMs: 7000,
    async act({ env, memo, snap, signal }) {
      if (memo.autopilotBefore === null) memo.autopilotBefore = snap.meta.autopilot_devices;
      await api(env, "POST", "/api/demo/reset", { scenario: "westside" }, signal);
      await api(env, "POST", "/api/demo/sim", { autopilot_devices: true }, signal);
    },
    until: (snap) => snap.meta.scenario === "westside" && snap.meta.autopilot_devices && zoneOf(snap)?.state === "watch",
    timeoutMs: 20_000,
    timeoutNote: "The reset is slow to show on the board; going on.",
  },
  {
    id: "proposal",
    rung: "watch",
    title: "The model proposes",
    caption:
      "The fire model's envelope reaches the edge of Culver City and Palms, so it proposes a Warning. A model may only propose: nothing rings until a named person approves.",
    focus: { tab: "zones", target: '[data-tour="side-panel"]' },
    dwellMs: 8000,
    until: (snap) => snap.proposals.some((p) => p.zone_id === ZONE && p.status === "open"),
    outcome: () => "No calls yet. The dashed outline on the map is the proposal.",
    timeoutMs: 10_000,
    timeoutNote: "No open proposal for Culver City; the supervisor approves the Warning directly.",
  },
  {
    id: "approve",
    rung: "hand",
    title: "A named person approves",
    caption:
      "The supervisor approves the Warning with a name and a reason. The approved words are the only instruction the agent may read to anyone.",
    focus: { tab: "zones", target: '[data-tour="side-panel"]' },
    dwellMs: 9000,
    async act({ env, snap, signal }) {
      const reason = "Model envelope reaches the north-west edge; Stage 1 calls, edge-first";
      const proposal = snap.proposals.find((p) => p.zone_id === ZONE && p.status === "open" && p.proposed_state === "warning");
      if (proposal) {
        await api(env, "POST", `/api/proposals/${encodeURIComponent(proposal.id)}/decide`, { decision: "approve", ...sign(reason) }, signal);
      } else {
        await api(env, "POST", `/api/zones/${ZONE}/approve`, { state: "warning", approved_by: AUTOPLAY_ACTOR, reason }, signal);
      }
    },
    until: (snap) => zoneOf(snap)?.state === "warning" && warningCalls(snap).some((c) => c.started_at),
    outcome: (snap) => {
      const z = zoneOf(snap);
      return z?.directive_text ? `Approved by ${z.approved_by ?? AUTOPLAY_ACTOR}. The agent reads: "${z.directive_text}"` : null;
    },
    timeoutMs: 30_000,
    timeoutNote: "The first call has not rung yet; going on.",
  },
  {
    id: "waves",
    rung: "slow",
    title: "Edge-first, in waves",
    caption:
      "Calls start at the edge the fire comes from and move inward in 200 m rings, five at a time. Not one blast to everyone.",
    focus: { target: '[data-tour="map"]' },
    dwellMs: 9000,
    until: (snap) => warningCalls(snap).filter((c) => c.started_at).length >= Math.min(5, Math.max(1, warningCalls(snap).length)),
    progress: (snap) => {
      const calls = warningCalls(snap);
      return calls.length ? `${calls.filter((c) => c.started_at).length} of ${calls.length} households called so far.` : null;
    },
    outcome: (snap) => {
      const calls = warningCalls(snap);
      return `${calls.filter((c) => c.started_at).length} of ${calls.length} called so far, nearest the fire first.`;
    },
    timeoutMs: 40_000,
    timeoutNote: "The first wave is slow to ring; going on.",
  },
  {
    id: "languages",
    rung: "ask",
    title: "Each in their own language",
    caption:
      "Every resident hears the same approved Warning in their own language. The agent never gives an arrival time and never tells anyone they are safe.",
    focus: { target: '[data-tour="calls"]' },
    dwellMs: 8000,
    until: (snap) => languagesHeard(snap).length >= 3,
    progress: (snap) => {
      const heard = languagesHeard(snap);
      return heard.length ? `Answered so far in ${list(heard)}.` : null;
    },
    outcome: (snap) => `Answered so far in ${list(languagesHeard(snap))}.`,
    timeoutMs: 45_000,
    timeoutNote: "Fewer than three languages have answered so far; going on.",
  },
  {
    id: "lucia",
    rung: "ask",
    title: "Phone 1 answers in Spanish",
    caption: "Lucía Romero hears the approved Warning in Spanish, word for word, and is asked what she will do.",
    focus: { target: '[data-tour="calls"]' },
    dwellMs: 8000,
    until: (snap) => FINAL.has(device(snap, 1)?.status ?? "pending"),
    progress: (snap) => {
      const h = device(snap, 1);
      return h?.call_state === "ringing" ? "Phone 1 is ringing." : h?.call_state === "active" ? "Phone 1 is on the call." : "Phone 1 is in the queue.";
    },
    outcome: (snap) => {
      const h = device(snap, 1);
      if (!h) return null;
      return `Recorded: ${h.status.replace("_", " ")}${h.destination ? `, to ${h.destination}` : ""}.`;
    },
    timeoutMs: 75_000,
    timeoutNote: "Phone 1 has not finished yet; going on.",
  },
  {
    id: "janet",
    rung: "hand",
    title: "Wheelchair, no car: the help registry",
    caption:
      "Phone 2, Janet Moore: her husband uses a wheelchair and they have no car. She goes into the help registry for the response team, with where she was last heard from.",
    focus: { tab: "registry", target: '[data-tour="side-panel"]' },
    dwellMs: 10_000,
    until: (snap) => Boolean(peopleRow(snap, device(snap, 2)?.id)),
    progress: (snap) => {
      const h = device(snap, 2);
      return h?.call_state === "ringing" ? "Phone 2 is ringing." : h?.call_state === "active" ? "Phone 2 is on the call." : "Phone 2 is in the queue.";
    },
    outcome: (snap, memo) => {
      const row = peopleRow(snap, device(snap, 2)?.id);
      if (!row) return null;
      memo.marks.janetRow = row.id;
      const eta = snap.ledger.some((l) => l.kind === "refusal" && /ETA|how long/i.test(l.action));
      return `Priority ${row.priority}: ${words(row.reason ?? "needs help")}. Location: ${LOCATION_WORDS[row.last_source]}.${
        eta ? " She asked how long until the fire arrives; the agent would not guess, and the refusal is in the ledger." : ""
      }`;
    },
    timeoutMs: 90_000,
    timeoutNote: "Phone 2 is not in the registry yet; going on.",
  },
  {
    // Live location with consent (built in parallel): shows only if her registry row gets a GPS fix.
    id: "live-location",
    rung: "hand",
    title: "Her exact spot",
    caption: "She agreed to share her live location. The response team sees her exact spot.",
    focus: { tab: "registry", target: '[data-tour="side-panel"]' },
    dwellMs: 8000,
    optional: true,
    quiet: true,
    until: (snap) => {
      const janet = peopleRow(snap, device(snap, 2)?.id);
      return janet ? janet.last_source === "gps_link" : snap.registry.some((r) => r.last_source === "gps_link");
    },
    outcome: (snap) => {
      const row = peopleRow(snap, device(snap, 2)?.id);
      return row?.last_accuracy_m ? `Accurate to about ${fmtN(row.last_accuracy_m)} m.` : null;
    },
    timeoutMs: 8000,
  },
  {
    id: "compose",
    rung: "hold",
    title: "A wrong polygon meets the hold",
    caption:
      "On January 9, 2025, about 10 million phones got a warning meant for one fire area. Here a countywide polygon is switched on by mistake, and Compose Order opens a 90-second hold that shows the dose first.",
    focus: { target: '[data-tour="hold"]' },
    dwellMs: 11_000,
    async act({ env, memo, signal }) {
      await api(env, "POST", "/api/demo/sim", { wrong_polygon: true }, signal);
      memo.wrongPolygonSet = true;
      const hold = await api<Hold>(
        env, "POST", "/api/holds",
        { zone_id: ZONE, proposed_state: "order", opened_by: AUTOPLAY_ACTOR, reason: "Envelope reached the zone edge; duty officer asks for an Order" },
        signal,
      );
      memo.wrongPolygonSet = false; // the switch is one-shot: this hold used it
      memo.holdId = hold.id;
      memo.doseBefore = hold.population_est;
    },
    until: (snap, memo) => holdOf(snap, memo)?.status === "open",
    outcome: (snap, memo) => {
      const h = holdOf(snap, memo);
      return h ? `Dose: wakes about ${fmtN(h.population_est)} phones across ${fmtN(h.area_sq_mi)} sq mi (estimate). Sentinels are ringing.` : null;
    },
    timeoutMs: 15_000,
    timeoutNote: "The hold is slow to show; going on.",
  },
  {
    id: "sentinel-no",
    rung: "ask",
    title: "Does this match what you see?",
    caption:
      "Sentinels at the polygon's far edges are asked whether the alert matches what they see. Phone 5 is the Long Beach sentinel, far from the fire.",
    focus: { target: '[data-tour="hold"]' },
    dwellMs: 8000,
    until: (snap, memo) => (holdOf(snap, memo)?.tally.no ?? 0) >= 1 || holdOf(snap, memo)?.status !== "open",
    progress: (snap, memo) => {
      const h = holdOf(snap, memo);
      return h ? tally(h) : null;
    },
    outcome: (snap, memo) => {
      const h = holdOf(snap, memo);
      if (!h) return null;
      const no = h.sentinels.filter((s) => s.answer === "no").map((s) => nameOf(snap, s.household_id));
      return no.length ? `${list(no)}: nothing here. ${tally(h)}` : tally(h);
    },
    timeoutMs: (snap, memo) => Math.max(5000, Math.min(60_000, holdLeftMs(snap, memo) - 45_000)),
    timeoutNote: "No sentinel has said no yet; the supervisor edits the polygon anyway.",
  },
  {
    id: "edit-polygon",
    rung: "slow",
    title: "Edit polygon: the dose drops",
    caption: "The supervisor edits the polygon back to Culver City and Palms, with a name and a reason. Watch the dose.",
    focus: { target: '[data-tour="hold"]' },
    dwellMs: 9000,
    async act({ env, memo, snap, signal }) {
      const h = holdOf(snap, memo);
      if (!h || h.status !== "open") return "The hold is no longer open.";
      await api(
        env, "POST", `/api/holds/${encodeURIComponent(h.id)}/decision`,
        { decision: "edit", polygon: "zone", ...sign("Sentinels far from the fire see nothing: wrong polygon. Back to the zone's own polygon.") },
        signal,
      );
    },
    until: (snap, memo) => {
      const h = holdOf(snap, memo);
      return Boolean(h && (h.population_est < (memo.doseBefore ?? Infinity) || h.status !== "open"));
    },
    outcome: (snap, memo) => {
      const h = holdOf(snap, memo);
      if (!h) return null;
      memo.doseAfter = h.population_est;
      return `Dose: ${memo.doseBefore !== null ? `${fmtN(memo.doseBefore)} → ` : ""}${fmtN(h.population_est)} phones (estimate). Reads from outside the new polygon are set aside.`;
    },
    timeoutMs: 15_000,
    timeoutNote: "The edited polygon is slow to show; going on.",
  },
  {
    // Played while the new sentinels answer: his retry and linked-contact call run on their own clock (about two
    // minutes after the Warning), and must finish before Send, since the Order cancels Stage 1 calls still queued.
    id: "linked-contact",
    rung: "ask",
    title: "Meanwhile: no answer is never safe",
    caption:
      "While the sentinels answer: Walter Hale did not pick up. The line tries once more, then calls his linked contact, his neighbor Lucía, and asks about him.",
    focus: { target: '[data-tour="calls"]' },
    dwellMs: 10_000,
    until: (snap) => {
      const w = person(snap, "Walter Hale");
      return Boolean(w && w.via === "linked_contact" && FINAL.has(w.status));
    },
    progress: (snap) => {
      const w = person(snap, "Walter Hale");
      const lucia = device(snap, 1);
      if (!w) return null;
      const own = snap.calls.filter((c) => c.household_id === w.id);
      const missed = own.filter((c) => UNANSWERED.has(c.state)).length;
      const linked = snap.calls.find((c) => c.purpose === "linked_contact" && c.household_id === lucia?.id);
      if (linked) return linked.state === "active" ? "Lucía is on the line about Walter." : "No answer twice. Calling Lucía, his linked contact.";
      if (missed >= 1) return `No answer from Walter (${missed} of 2 tries). The retry comes 30 s later.`;
      return own.some((c) => c.state === "ringing") ? "Walter's phone is ringing." : "Walter is in the queue.";
    },
    outcome: (snap) => {
      const w = person(snap, "Walter Hale");
      return w ? `Walter: ${w.status.replace("_", " ")}, via his linked contact.` : null;
    },
    // Leave the hold time for its quorum and the Send (no hold open: up to 2.5 minutes).
    timeoutMs: (snap, memo) =>
      holdOf(snap, memo)?.status === "open" ? Math.max(3000, Math.min(150_000, holdLeftMs(snap, memo) - 25_000)) : 150_000,
    timeoutNote: "Walter's linked-contact call has not finished; back to the hold.",
  },
  {
    id: "quorum",
    rung: "ask",
    title: "Two answers make a quorum",
    caption: "Sentinels inside the right polygon are asked the same question. Two answers make a quorum.",
    focus: { target: '[data-tour="hold"]' },
    dwellMs: 8000,
    until: (snap, memo) => {
      const h = holdOf(snap, memo);
      return !h || h.status !== "open" || h.read === "confirmed";
    },
    progress: (snap, memo) => {
      const h = holdOf(snap, memo);
      return h ? `${tally(h)} About ${Math.max(0, Math.round(holdLeftMs(snap, memo) / 1000))} s left on the hold.` : null;
    },
    outcome: (snap, memo) => {
      const h = holdOf(snap, memo);
      if (!h) return null;
      if (h.status !== "open") return "The hold already closed.";
      const what = h.sentinels.find((s) => s.answer === "yes" && s.what)?.what;
      return `Read: confirmed, ${h.tally.yes} yes.${what ? ` They see: ${what.replace(/\.$/, "")}.` : ""}`;
    },
    // Leave room to press Send before the hold sends on its own at 0:00.
    timeoutMs: (snap, memo) => Math.max(3000, Math.min(80_000, holdLeftMs(snap, memo) - 6000)),
    timeoutNote: "No quorum yet and the clock is close to 0:00; the supervisor decides now.",
  },
  {
    id: "send",
    rung: "hand",
    title: "Send now",
    caption: "Send now, with a name and a reason. The Order goes out (simulated) to the corrected polygon only.",
    focus: { target: ['[data-tour="hold-actions"]', '[data-tour="last-hold"]'] },
    dwellMs: 7000,
    async act({ env, memo, snap, signal }) {
      const h = holdOf(snap, memo);
      if (!h) return "There is no hold to send.";
      if (h.status !== "open") return "The timer sent it at 0:00: a hold can delay an alert, never stop it.";
      const why = h.read === "confirmed" ? "Two edge sentinels confirm smoke to the west; polygon corrected" : "Polygon corrected; sending before the timer";
      await api(env, "POST", `/api/holds/${encodeURIComponent(h.id)}/decision`, { decision: "send", ...sign(why) }, signal);
    },
    until: (snap, memo) => holdOf(snap, memo)?.status === "sent",
    outcome: (snap, memo) => {
      const h = holdOf(snap, memo);
      return h ? `Sent to about ${fmtN(h.population_est)} phones in ${h.polygon_label}, not ${fmtN(memo.doseBefore ?? h.population_est)}. Stage 3 calls start.` : null;
    },
    timeoutMs: 15_000,
    timeoutNote: "The send is slow to show; going on.",
  },
  {
    // Block by block (lib/engine/plans.ts): the hold proposed a plan; a named person approves it after the Send.
    id: "block-plan",
    rung: "slow",
    title: "Block by block, not the whole zone at once",
    caption:
      "The Order stays the Order for all of Culver City and Palms. The supervisor approves the block plan: blocks nearest the fire go first, each on its own road, so no road gets more cars than it carries. Later blocks hear when to get ready, and to leave at once if they see fire or smoke.",
    focus: { target: ['[data-tour="block-plan"]', '[data-tour="map"]'] },
    dwellMs: 11_000,
    optional: true,
    async skip({ env, signal }) {
      try {
        const r = await api<{ plan: EvacPlan | null }>(env, "GET", `/api/zones/${ZONE}/plan`, undefined, signal);
        return r.plan ? null : "No block plan for Culver City";
      } catch (e) {
        if (isAbort(e)) throw e;
        return e instanceof AutoplayHttpError && e.missing ? "Placeholder: no block plan API yet" : `Block plan not ready: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
    async act({ env, signal }) {
      const r = await api<{ plan: EvacPlan | null }>(env, "GET", `/api/zones/${ZONE}/plan`, undefined, signal);
      if (r.plan?.status === "proposed") {
        await api(env, "POST", `/api/zones/${ZONE}/plan/approve`, { approved_by: AUTOPLAY_ACTOR, reason: "Exit roads checked; nearest the fire first" }, signal);
      }
    },
    async until(_snap, memo, { env, signal }) {
      const r = await api<{ plan: EvacPlan | null }>(env, "GET", `/api/zones/${ZONE}/plan`, undefined, signal).catch((e) => {
        if (isAbort(e)) throw e;
        return null;
      });
      const p = r?.plan;
      if (!p || (p.status !== "active" && p.status !== "all_go")) return false;
      memo.marks.planLine = planLine(p);
      return true;
    },
    outcome: (_snap, memo) => memo.marks.planLine ?? null,
    timeoutMs: 15_000,
    timeoutNote: "The block plan is slow to show; going on.",
  },
  {
    id: "canary",
    rung: "watch",
    title: "The canary confirms delivery",
    caption:
      "15 seconds after the send, a canary phone just outside the zone, Phone 6, is asked: did you just get an alert? Outside the polygon, no is the right answer.",
    focus: { target: ['[data-tour="last-hold"]', '[data-tour="calls"]'] },
    dwellMs: 9000,
    // Both canaries (Phone 6 and a synthetic one) answer within seconds of each other; wait for every answer.
    until: (snap, memo) => {
      const rows = snap.canaries.filter((c) => c.hold_id === memo.holdId);
      return rows.length > 0 && rows.every((c) => c.result !== "pending");
    },
    progress: (snap, memo) => {
      const rows = snap.canaries.filter((c) => c.hold_id === memo.holdId);
      if (!rows.length) return null;
      const done = rows.filter((c) => c.result !== "pending").length;
      return done ? `${done} of ${rows.length} canaries answered.` : "Canary calls ring 15 s after the send.";
    },
    outcome: (snap, memo) => {
      const rows: Canary[] = snap.canaries.filter((c) => c.hold_id === memo.holdId && c.result !== "pending");
      if (!rows.length) return null;
      const phone6 = device(snap, 6)?.id;
      const said = [...rows]
        .sort((a, b) => Number(b.household_id === phone6) - Number(a.household_id === phone6))
        .map((c) => `${nameOf(snap, c.household_id)}${c.household_id === phone6 ? " (Phone 6)" : ""}: ${c.result}`);
      const flag = rows.some((c) => c.flag === "transport_failure")
        ? "Transport failure flagged to the authority."
        : rows.every((c) => c.flag === "clear")
          ? "Canary clear."
          : "Delivery unverified.";
      return `${said.join(". ")}. ${flag}`;
    },
    timeoutMs: 75_000,
    timeoutNote: "The canary has not answered yet; going on.",
  },
  {
    // Played while Stage 3 calls go out (the tower block is far from Janet and the canaries).
    id: "tower-down",
    rung: "watch",
    title: "Meanwhile: a tower goes down",
    caption:
      "While Stage 3 calls go out, a cell tower fails (simulated) and one Palms block stops answering at once. Silence is never read as safe: correlated silence goes to a person.",
    focus: { target: ['[data-tour="feed-ticker"]', '[data-tour="map"]'] },
    dwellMs: 9000,
    async act({ env, signal }) {
      await api(env, "POST", "/api/demo/sim", { event: "tower_down" }, signal);
    },
    until: (snap, memo) =>
      snap.feed.some((f) => f.kind === "silence_cluster" && f.created_at >= memo.beatAt) ||
      snap.clusters.some((c) => c.kind === "silence" && c.count >= 5 && c.last_at >= memo.beatAt),
    outcome: (snap) => {
      const c = snap.clusters.filter((x) => x.kind === "silence").sort((a, b) => b.count - a.count)[0];
      return c ? `Card: ${c.count} households not answering, possible tower or power loss; recommend a door-knock team.` : null;
    },
    timeoutMs: 30_000,
    timeoutNote: "The silence card has not shown yet; going on.",
  },
  {
    id: "stage3",
    rung: "hand",
    title: "Stage 3: we can't leave",
    caption:
      "Stage 3 relays the Order to everyone not confirmed gone. Janet says they can't leave, so her row moves to priority 1, life safety.",
    focus: { tab: "registry", target: '[data-tour="side-panel"]' },
    dwellMs: 9000,
    until: (snap) => peopleRow(snap, device(snap, 2)?.id)?.priority === 1,
    progress: (snap) => {
      const camp = snap.campaigns.find((c) => c.zone_id === ZONE && c.kind === "order");
      if (!camp) return null;
      const calls = snap.calls.filter((c) => c.campaign_id === camp.id);
      return `Stage 3: ${calls.filter((c) => c.started_at).length} of ${calls.length} called so far.`;
    },
    outcome: (snap) => {
      const row = peopleRow(snap, device(snap, 2)?.id);
      return row ? `Priority ${row.priority}: ${words(row.reason ?? "needs help now")}. She was told to hang up and call 911.` : null;
    },
    timeoutMs: 120_000,
    timeoutNote: "Janet's Stage 3 call has not finished; going on.",
  },
  {
    // Played after Janet's call so the wave-2 calls do not queue ahead of hers.
    id: "next-wave",
    rung: "hand",
    title: "A person starts the next wave",
    caption:
      "The roads are moving, so the supervisor starts wave 2 early, with a name and a reason. Its blocks hear “leave now” on their roads. Hold next wave and Everyone go now are one click away too.",
    focus: { target: ['[data-tour="block-plan"]', '[data-tour="map"]'] },
    dwellMs: 9000,
    optional: true,
    quiet: true,
    async skip({ env, memo, signal }) {
      const r = await api<{ plan: EvacPlan | null }>(env, "GET", `/api/zones/${ZONE}/plan`, undefined, signal).catch((e) => {
        if (isAbort(e)) throw e;
        return null;
      });
      const p = r?.plan;
      if (!p || p.status !== "active") return "No running block plan for Culver City";
      memo.marks.waveBefore = String(p.current_wave);
      return null;
    },
    async act({ env, signal }) {
      await api(env, "POST", `/api/zones/${ZONE}/plan/advance`, sign("Wave 1 roads are moving; start the next wave early"), signal);
    },
    async until(_snap, memo, { env, signal }) {
      const r = await api<{ plan: EvacPlan | null }>(env, "GET", `/api/zones/${ZONE}/plan`, undefined, signal).catch((e) => {
        if (isAbort(e)) throw e;
        return null;
      });
      const p = r?.plan;
      if (!p || p.current_wave <= Number(memo.marks.waveBefore ?? 0)) return false;
      const ids = p.blocks.filter((b) => b.wave === p.current_wave).map((b) => b.id);
      memo.marks.nextWaveLine = `Wave ${p.current_wave} goes now: ${list(ids)}. The ledger has the supervisor's name and reason.`;
      return true;
    },
    outcome: (_snap, memo) => memo.marks.nextWaveLine ?? null,
    timeoutMs: 15_000,
    timeoutNote: "The next wave is slow to show; going on.",
  },
  {
    // Helper dispatch (built in parallel): POST /api/registry/[id]/dispatch. Skipped quietly until that route exists.
    id: "send-helper",
    rung: "hand",
    title: "Send a helper to her exact spot",
    caption: "The supervisor sends a helper to Janet's latest location, with a name and a reason. The helper's page shows her needs and where she is.",
    focus: { tab: "registry", target: '[data-tour="side-panel"]' },
    dwellMs: 8000,
    optional: true,
    quiet: true,
    async skip({ env, snap, memo, signal }) {
      const row = peopleRow(snap, device(snap, 2)?.id);
      if (!row) return "Janet has no open registry row";
      try {
        const live = await api<LiveRegistryLite>(env, "GET", "/api/registry/live", undefined, signal);
        if (!Array.isArray(live?.roster)) return "Placeholder: the live registry has no helper roster yet";
        memo.marks.helperId = (live.roster.find((h) => h.vehicle === "accessible_van") ?? live.roster[0])?.id ?? "";
        memo.marks.helperLabel = (live.roster.find((h) => h.id === memo.marks.helperId))?.label ?? "";
      } catch (e) {
        if (isAbort(e)) throw e;
        return e instanceof AutoplayHttpError && e.missing ? "Placeholder: no dispatch API yet (POST /api/registry/[id]/dispatch)" : `Dispatch API not ready: ${e instanceof Error ? e.message : String(e)}`;
      }
      memo.marks.helperRow = row.id;
      return null;
    },
    async act({ env, memo, signal }) {
      await api(
        env, "POST", `/api/registry/${encodeURIComponent(memo.marks.helperRow)}/dispatch`,
        {
          ...(memo.marks.helperId ? { helper_id: memo.marks.helperId } : { helper_label: "Response team (simulated)" }),
          ...sign("Priority 1: wheelchair, no car; send a helper to her latest location"),
        },
        signal,
      );
    },
    async until(_snap, memo, { env, signal }) {
      const live = await api<LiveRegistryLite>(env, "GET", "/api/registry/live", undefined, signal).catch((e) => {
        if (isAbort(e)) throw e;
        return null;
      });
      return Boolean(live?.dispatches?.some((d) => d.help_request_id === memo.marks.helperRow));
    },
    outcome: (snap, memo) => {
      const row = snap.registry.find((r) => r.id === memo.marks.helperRow);
      const who = memo.marks.helperLabel || "A helper";
      return row ? `${who} sent to ${LOCATION_WORDS[row.last_source]}.` : `${who} sent.`;
    },
    timeoutMs: 15_000,
  },
  {
    id: "pickup-runs",
    rung: "hand",
    title: "Pickup runs",
    caption: "Build pickup runs: wheelchair, oxygen and bedbound needs go to accessible vans first, nearest stops in order.",
    focus: { tab: "registry", target: '[data-tour="side-panel"]' },
    dwellMs: 8000,
    async act({ env, signal }) {
      await api(env, "POST", "/api/registry/runs", sign("Registry priority 1-2: accessible vans for mobility and medical needs"), signal);
    },
    until: (snap) => snap.runs.length > 0,
    outcome: (snap) => `Planned: ${list(snap.runs.map((r) => r.label))}.`,
    timeoutMs: 15_000,
    timeoutNote: "No open priority 1-2 rows to route yet; going on.",
  },
  {
    id: "ledger",
    rung: "hand",
    title: "The ledger",
    caption:
      "Every decision has a name and a reason, and every refusal sits beside the allowlist. Autoplay's decisions are labeled simulated and are not counted as human decisions.",
    focus: { tab: "ledger", target: '[data-tour="side-panel"]' },
    dwellMs: 11_000,
    outcome: (snap) => {
      const mine = snap.ledger.filter((l) => l.actor === AUTOPLAY_ACTOR && l.kind === "decision").length;
      const refusals = snap.ledger.filter((l) => l.kind === "refusal" || !l.allowed).length;
      return `${plural(mine, "decision")} by the autoplay supervisor, ${plural(refusals, "refusal")} by the agent, ${plural(snap.metrics.human_decisions, "human decision")} counted.`;
    },
  },
];

/** Beats shown in every run (quiet ones appear only when they apply). */
export const VISIBLE_BEATS = BEATS.filter((b) => !b.quiet).length;

/** The end card's recap, one line per rung, with this run's numbers where it has them. */
export function recap(memo: Memo): Record<Rung, string> {
  const dose =
    memo.doseBefore !== null && memo.doseAfter !== null ? ` The dose went from ${fmtN(memo.doseBefore)} to ${fmtN(memo.doseAfter)} phones.` : "";
  return {
    watch: "The fire model proposed and nothing rang. After the send, the canary and the silence watch kept checking.",
    ask: "Sentinels at the edge and residents were asked what they see and need, each in their own language.",
    slow: `Calls went out edge-first in waves, and the dose showed before anything was sent.${dose} The zone moved out block by block, nearest the fire first, so no road jammed.`,
    hold: "The Order waited in a 90-second hold that sends on time, long enough to catch a wrong polygon.",
    hand: "Every decision has a name and a reason. People who need a person went to the registry and the pickup runs.",
  };
}
