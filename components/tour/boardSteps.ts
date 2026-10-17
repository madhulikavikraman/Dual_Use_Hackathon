"use client";

// The supervisor board's tour, one step per region of the screen. Every sentence describes what the
// board shows (components/board/*); the targets are the data-tour attributes on those components.
import { PRIORITY_LABEL, stateShort, WORDING } from "@/lib/client/labels";
import type { Mode } from "@/lib/types";
import type { TourStep } from "./types";

export const BOARD_TOUR = "board";

const SIDE_PANEL = '[data-tour="side-panel"]';
const LEGEND_TOGGLE = '[data-tour="legend"] button[aria-expanded]';

// ---------- The side panel's tabs (Zones, registry, Feed, Ledger) ----------

const sideTabs = () => Array.from(document.querySelectorAll<HTMLButtonElement>(`${SIDE_PANEL} [role="tab"]`));

/** A side-panel tab by its label (the label is followed by a count badge in the same button). */
const findTab = (label: string) => sideTabs().find((t) => (t.textContent ?? "").trim().startsWith(label)) ?? null;

function showTab(label: string) {
  const tab = findTab(label);
  if (tab && tab.getAttribute("aria-selected") !== "true") tab.click();
}

/** Tour opens: note the tab the supervisor had open, and hand back how to open it again on close. */
export function captureTab(): () => void {
  const before = sideTabs().findIndex((t) => t.getAttribute("aria-selected") === "true");
  return () => {
    const tab = sideTabs()[before];
    if (tab && tab.getAttribute("aria-selected") !== "true") tab.click();
  };
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

export function boardSteps(mode: Mode, holdOpen: boolean): TourStep[] {
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
      id: "header",
      target: '[data-tour="header"]',
      placement: "bottom",
      title: "Scenario, mode and your name",
      body: "Switch scenarios and see the mode, whether Retell phone calls are on, and the time. Type your name once: every decision dialog uses it, and the ledger records it.",
    },
    {
      id: "metrics",
      target: '[data-tour="metrics"]',
      placement: "bottom",
      title: "The numbers",
      body: "Left to right: volunteer phones accounted for, people reached, how many repeated the plan back, open help requests and live calls. Then the agent's refusals, decisions made by a named person, and the estimated call cost.",
    },
    {
      id: "map",
      target: '[data-tour="map"]',
      placement: "right",
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
      target: ['[data-tour="feed-ticker"]', () => findTab("Feed")],
      placement: "right",
      padding: 6,
      title: "The feed",
      body: "New warnings float over the top of the map for 2 minutes, so the room sees them land. The Feed tab keeps every item, newest first: proposals, clusters, silence, canary results and hand-offs.",
    },
    {
      id: "calls",
      target: '[data-tour="calls"]',
      placement: "top",
      title: "Live calls",
      body: "Every call ringing or connected right now, with its language and the last line said. The agent says it is an AI and reads only the directive, route and evacuation point a named person approved, in the caller's language.",
    },
    holdOpen
      ? {
          id: "hold-open",
          target: '[data-tour="hold"]',
          placement: "left",
          title: "The hold",
          body: "This Order waits 90 seconds before it goes out. Up top is the dose, how many people it would wake; below, sentinels at the zone's edge say whether it matches what they see, and 2 answers make a quorum.",
        }
      : {
          id: "hold",
          target: '[data-tour="compose-order"]',
          placement: "left",
          padding: 6,
          onEnter: () => showTab("Zones"),
          title: "The hold",
          body: "Compose Order opens the hold: the Order waits 90 seconds while sentinels at the zone's edge say whether it matches what they see. The hold also shows the dose, how many people it would wake.",
          bodyWhenMissing:
            "When someone composes an Evacuation Order, it waits 90 seconds in a hold at the top of the right column. Sentinels at the zone's edge say whether it matches what they see, and the hold shows how many people it would wake.",
        },
    holdOpen
      ? {
          id: "decide-open",
          target: '[data-tour="hold-actions"]',
          placement: "left",
          padding: 6,
          title: "Decide, or it sends on time",
          body: "Send now, Hold once (60 s more), Edit polygon, Cancel or Hand to authority, each with your name and a reason. If nobody decides, it sends at 0:00; then a canary phone outside the polygon is asked whether the alert reached it.",
        }
      : {
          // With no hold open, the strip shows how the last one ended, until it is dismissed.
          id: "decide",
          target: '[data-tour="last-hold"]',
          placement: "left",
          title: "Decide, or it sends on time",
          body: "This card shows how the last hold ended and what the canary phones outside the polygon reported. In a hold you choose Send now, Hold once, Edit polygon, Cancel or Hand to authority; if nobody decides, it sends at 0:00.",
          bodyWhenMissing:
            "Send now, Hold once (60 s more), Edit polygon, Cancel or Hand to authority, each with your name and a reason. If nobody decides, it sends at 0:00; then a canary phone outside the polygon is asked whether the alert reached it.",
        },
    {
      id: "ask",
      target: '[data-tour="ask"]',
      placement: "left",
      padding: 6,
      title: "Ask the board",
      body: "Type a question in plain words and Claude answers from a summary of the live board. It can read the board but cannot change anything.",
      bodyWhenMissing:
        "While a hold is open, the hold takes this space. Afterwards, type a question in plain words and Claude answers from a summary of the live board, without changing anything.",
    },
    {
      id: "zones",
      target: SIDE_PANEL,
      placement: "left",
      onEnter: () => showTab("Zones"),
      title: "Zones and model proposals",
      body: "Model proposals sit on top, and nothing changes until a named person approves or rejects one. Below them, every zone with its state, who approved it, and the calls you can start.",
    },
    {
      id: "registry",
      target: SIDE_PANEL,
      placement: "left",
      onEnter: () => showTab(registry),
      title: registry,
      body: `Everyone who asked for a person, with their number and where they were last heard from. ${prioritiesLine()}; the quick response team works this list.`,
    },
    {
      id: "ledger",
      target: SIDE_PANEL,
      placement: "left",
      onEnter: () => showTab("Ledger"),
      title: "Ledger",
      body: "Every human decision with a name and a reason, and every time the agent refused. Above it, what the agent can and cannot do.",
    },
    {
      id: "phones",
      target: '[data-tour="links"]',
      placement: "bottom",
      padding: 6,
      title: "Pick up a phone",
      body: "Phones has a QR code for each of the 6 volunteer phones: scan one to play a resident, a sentinel or the canary. QRT is the quick response team's screen: the registry map, pickup runs and a printable door-knock sheet.",
      actions: [
        { label: "Open phones", href: "/phones" },
        { label: "Open QRT", href: "/qrt" },
      ],
    },
  ];
}
