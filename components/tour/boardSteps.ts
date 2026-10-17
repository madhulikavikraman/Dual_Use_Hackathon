"use client";

// The supervisor board's tour, one step per region of the screen. Every sentence describes what the
// board shows (components/board/*); the targets are the data-tour attributes on those components.
import { PRIORITY_LABEL, stateShort, WORDING } from "@/lib/client/labels";
import type { Mode } from "@/lib/types";
import { captureView, getSelectedZoneId, revealSidebar, selectZone, setBoardView, type BoardView } from "@/lib/ui/boardView";
import type { TourStep } from "./types";

export const BOARD_TOUR = "board";

const SIDE_PANEL = '[data-tour="side-panel"]';
const NAV = '[data-tour="nav"]';
const NAV_MOBILE = '[data-tour="nav-mobile"]';
const LEGEND_TOGGLE = '[data-tour="legend"] button[aria-expanded]';

// ---------- The board's views (Map, Calls, Help, Ledger, Feed, Ask: lib/ui/boardView) ----------

/** Opens a view for its step. The tour puts back the view the supervisor had when it closes (captureTab). */
const show = (view: BoardView) => () => setBoardView(view);

/** Opens a view and, at phone width, the drawer (closed again when the step ends, if the step opened it). */
function showAnd(view: BoardView, opts: { drawer?: boolean } = {}) {
  return () => {
    setBoardView(view);
    return opts.drawer ? revealSidebar() : undefined;
  };
}

/** Tour opens: note the view on screen, and hand back how to return to it on close. */
export function captureTab(): () => void {
  return captureView();
}

// ---------- The map legend (folded by default) ----------

/**
 * Unfolds the legend for its step and folds it again after, only if the tour unfolded it. Deferred a
 * frame: in development React runs enter, undo, enter back to back, and a toggle clicked twice before the
 * board re-renders would fold the legend again.
 */
function unfoldLegend(): () => void {
  let unfolded = false;
  const frame = requestAnimationFrame(() => {
    const toggle = document.querySelector<HTMLButtonElement>(LEGEND_TOGGLE);
    if (toggle?.getAttribute("aria-expanded") === "false") {
      toggle.click();
      unfolded = true;
    }
  });
  return () => {
    cancelAnimationFrame(frame);
    if (!unfolded) return;
    const toggle = document.querySelector<HTMLButtonElement>(LEGEND_TOGGLE);
    if (toggle?.getAttribute("aria-expanded") === "true") toggle.click();
  };
}

// ---------- Steps ----------

/** "Life safety" → "P1 life safety", from the labels the registry itself shows. */
function prioritiesLine(): string {
  return Object.entries(PRIORITY_LABEL)
    .map(([p, label]) => `P${p} ${label.charAt(0).toLowerCase()}${label.slice(1)}`)
    .join(", ");
}

/**
 * Shows the Map view with a zone in Warning picked, so its Compose Order button is on screen, and hands back how
 * to put the supervisor's own pick back.
 */
function pickWarningZone(zoneId: string | null) {
  return () => {
    setBoardView("map");
    if (!zoneId) return undefined;
    const before = getSelectedZoneId();
    selectZone(zoneId);
    return () => selectZone(before);
  };
}

/** Shows the Map view with the zone that has a block plan picked, so its plan is in the zone detail. */
function pickPlanZone(zoneId: string | null) {
  return () => {
    setBoardView("map");
    if (!zoneId) return undefined;
    const before = getSelectedZoneId();
    selectZone(zoneId);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.querySelector('[data-tour="block-plan"]')?.scrollIntoView({ block: "nearest" })),
    );
    return () => selectZone(before);
  };
}

/**
 * `warningZoneId`: a zone in Warning, if any (the hold step points at its Compose Order button).
 * `planZoneId`: a zone with a block-by-block plan, if any (the blocks step opens its detail).
 */
export function boardSteps(mode: Mode, holdOpen: boolean, warningZoneId: string | null = null, planZoneId: string | null = null): TourStep[] {
  const registry = WORDING[mode].registry;
  return [
    {
      id: "welcome",
      placement: "center",
      hero: true,
      title: "The supervisor board",
      body: "One screen for the person on the overnight desk: zones, calls, the hold before an alert, and who needs help. Everything is simulated: residents are synthetic except 6 volunteer phones, and nothing reaches a real alert system.",
    },
    {
      id: "scenario",
      target: '[data-tour="scenario"]',
      placement: "right",
      padding: 4,
      onEnter: revealSidebar,
      title: "Scenario and mode",
      body: "The sidebar starts with the scenario. Switching one resets the run on this screen. The mode sets the words the board uses, and the SIMULATED badge never goes away.",
    },
    {
      id: "nav",
      target: [NAV, NAV_MOBILE],
      placement: "right",
      padding: 4,
      title: "One view at a time",
      body: "Map, Calls, Help, Ledger, Feed and Ask each have their own view. The map stays on screen and the column beside it shows the view you pick. A count on a view says work is waiting there.",
    },
    {
      id: "metrics",
      target: '[data-tour="metrics"]',
      placement: "right",
      padding: 4,
      onEnter: revealSidebar,
      title: "The live numbers",
      body: "Calls live and queued, people reached, how many repeated the plan back, open help requests, decisions made by a named person, the agent's refusals, the estimated call cost, and the volunteer phones online.",
    },
    {
      id: "header",
      target: '[data-tour="header"]',
      placement: "bottom",
      title: "Your name, the clock and autoplay",
      body: "Type your name once: every decision dialog uses it, and the ledger records it (on a phone it is in the menu). Retell shows whether real phone calls are on. Play the full fire runs the whole simulated event with captions.",
    },
    {
      id: "map",
      target: '[data-tour="map"]',
      placement: "right",
      onEnter: show("map"),
      title: "The map",
      body: `Zones take the color of their ladder state, grey ${stateShort("monitor", mode)} up to red ${stateShort("order", mode)}; a dashed outline is a change a model proposed. Dots are households colored by call status, diamonds are sentinels at the edges, triangles are canaries, and small orange dots are hazard reports.`,
    },
    {
      id: "legend",
      target: '[data-tour="legend"]',
      placement: "right",
      padding: 6,
      onEnter: unfoldLegend,
      title: "Legend",
      body: "Every color and shape on the map: zone states, call statuses, sentinels, canaries, help pins by priority and evacuation points.",
    },
    {
      id: "feed",
      target: ['[data-tour="feed-ticker"]', '[data-tour="nav-feed"]', '[data-tour="navm-feed"]'],
      placement: "right",
      padding: 6,
      title: "The feed",
      body: "New warnings float over the top of the map for 2 minutes, so the room sees them land. The Feed view keeps every item, newest first: proposals, clusters, silence, canary results and hand-offs.",
    },
    {
      id: "zones",
      target: SIDE_PANEL,
      placement: "left",
      onEnter: show("map"),
      title: "Zones and model proposals",
      body: "Model proposals sit on top, and nothing changes until a named person approves or rejects one. Below, one line per zone; pick one to see who approved it, its call progress and the actions that fit its state.",
    },
    holdOpen
      ? {
          id: "hold-open",
          target: '[data-tour="hold"]',
          placement: "left",
          onEnter: show("map"),
          title: "The hold",
          body: "This Order waits 90 seconds before it goes out. Up top is the dose, how many people it would wake; below, sentinels at the zone's edge say whether it matches what they see, and 2 answers make a quorum.",
        }
      : {
          id: "hold",
          target: '[data-tour="compose-order"]',
          placement: "left",
          padding: 6,
          onEnter: pickWarningZone(warningZoneId),
          title: "The hold",
          body: "Compose Order opens the hold: the Order waits 90 seconds while sentinels at the zone's edge say whether it matches what they see. The hold also shows the dose, how many people it would wake.",
          bodyWhenMissing:
            "When someone composes an Evacuation Order for a zone, it waits 90 seconds in a hold at the top of the Map view's column. Sentinels at the zone's edge say whether it matches what they see, and the hold shows how many people it would wake.",
        },
    holdOpen
      ? {
          id: "decide-open",
          target: '[data-tour="hold-actions"]',
          placement: "left",
          padding: 6,
          onEnter: show("map"),
          title: "Decide, or it sends on time",
          body: "Send now, Hold once (60 s more), Edit polygon, Cancel or Hand to authority, each with your name and a reason. If nobody decides, it sends at 0:00; then a canary phone outside the polygon is asked whether the alert reached it.",
        }
      : {
          // With no hold open, the strip shows how the last one ended, until it is dismissed.
          id: "decide",
          target: '[data-tour="last-hold"]',
          placement: "left",
          onEnter: show("map"),
          title: "Decide, or it sends on time",
          body: "This card shows how the last hold ended and what the canary phones outside the polygon reported. In a hold you choose Send now, Hold once, Edit polygon, Cancel or Hand to authority; if nobody decides, it sends at 0:00.",
          bodyWhenMissing:
            "Send now, Hold once (60 s more), Edit polygon, Cancel or Hand to authority, each with your name and a reason. If nobody decides, it sends at 0:00; then a canary phone outside the polygon is asked whether the alert reached it.",
        },
    ...(mode === "heat"
      ? []
      : [
          {
            id: "blocks",
            target: '[data-tour="block-plan"]',
            placement: "left" as const,
            padding: 6,
            onEnter: pickPlanZone(planZoneId),
            title: "Block by block, not the whole city",
            body: "An Order covers the whole zone, but people leave in waves, one patch of about 10 to 12 city blocks at a time, nearest the fire first, each on its own exit road, so no road takes more cars than it carries. A named person approves the plan and can start the next wave, hold it, or send everyone now. On the map, red patches go now, orange go next and yellow get ready.",
            bodyWhenMissing:
              "When an Order is composed for a zone with exit roads set up, a block plan is proposed: waves of patches of about 10 to 12 city blocks, nearest the fire first, each on its own road. A named person approves it; until then every call reads the full Order.",
          },
        ]),
    {
      id: "calls",
      target: '[data-tour="calls"]',
      placement: "left",
      onEnter: show("calls"),
      title: "Calls",
      body: "Every call ringing or connected right now, with its language and the last line said, then the call waves and how recent calls ended. The agent says it is an AI and reads only the directive, route and evacuation point a named person approved, in the caller's language.",
    },
    {
      id: "registry",
      target: SIDE_PANEL,
      placement: "left",
      onEnter: show("help"),
      title: registry,
      body: `Everyone who asked for a person, with their number and where they were last heard from. ${prioritiesLine()}; the quick response team works this list.`,
    },
    {
      id: "ledger",
      target: SIDE_PANEL,
      placement: "left",
      onEnter: show("ledger"),
      title: "Ledger",
      body: "Every human decision with a name and a reason, and every time the agent refused. Seeded and autoplay decisions are marked as stand-ins and not counted. Above it, what the agent can and cannot do.",
    },
    {
      id: "ask",
      target: '[data-tour="ask"]',
      placement: "left",
      padding: 6,
      onEnter: show("ask"),
      title: "Ask the board",
      body: "Type a question in plain words and Claude answers from a summary of the live board. It can read the board but cannot change anything.",
    },
    {
      id: "phones",
      target: '[data-tour="links"]',
      placement: "right",
      padding: 6,
      onEnter: showAnd("map", { drawer: true }),
      title: "Pick up a phone",
      body: "Phones has a QR code for each of the 6 volunteer phones: scan one to play a resident, a sentinel or the canary. QRT is the quick response team's screen: the registry map, pickup runs and a printable door-knock sheet.",
      actions: [
        { label: "Open phones", href: "/phones" },
        { label: "Open QRT", href: "/qrt" },
      ],
    },
  ];
}
