"use client";

// The help registry rows with live location: where the location came from (a badge), the state of the person's
// live-location link, the helper sent, and "Send helper". Used by the board's registry tab and the QRT view.

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { EXPORT_CSV_URL } from "@/lib/client/api";
import { fmtAgo, isFresh } from "@/lib/client/format";
import { HELP_SOURCE_LABEL, HELP_STATUS_LABEL, HELP_STATUS_TONE, NEED_LABEL, PRIORITY_COLOR, PRIORITY_LABEL } from "@/lib/client/labels";
import type { DispatchSummary, ShareSummary } from "@/lib/contracts";
import type { DispatchStatus, HelpRequest, ShareStatus } from "@/lib/types";
import { useAct, useBoard } from "@/components/board/BoardContext";
import { DecisionDialog } from "@/components/board/DecisionDialog";
import { PickupRuns } from "@/components/board/PickupRuns";
import { RegistryActions } from "@/components/board/RegistryActions";
import { Emoji } from "@/lib/ui/Emoji";
import { ICON, NEED_ICON } from "@/lib/ui/icons";
import { Button } from "@/components/ui/Button";
import { Chip, ColorChip } from "@/components/ui/Chip";
import { Field, inputClass } from "@/components/ui/Field";
import { displayActor } from "@/lib/ui/display";
import { sendHelper } from "./api";
import { useLiveRegistry } from "./LiveRegistryContext";

function PriorityChip({ priority }: { priority: 1 | 2 | 3 | 4 }) {
  return (
    <ColorChip color={PRIORITY_COLOR[priority]} text={priority === 3 ? "#111827" : "#ffffff"} title={PRIORITY_LABEL[priority]}>
      P{priority}
    </ColorChip>
  );
}

/** Needs, people, battery and animals, each with its icon (decorative: the words carry the meaning). */
function NeedsLine({ row }: { row: HelpRequest }) {
  const parts: ReactNode[] = [];
  if (row.needs.length) {
    row.needs.forEach((n, i) =>
      parts.push(
        <span key={`n${n}`}>
          {NEED_ICON[n] ? <Emoji e={NEED_ICON[n]} /> : null} {NEED_LABEL[n]}
          {i < row.needs.length - 1 ? "," : ""}
        </span>,
      ),
    );
  } else if (row.reason) {
    parts.push(<span key="reason">{row.reason.replaceAll("_", " ")}</span>);
  }
  if (row.people) {
    parts.push(
      <span key="people">
        <Emoji e={ICON.people} /> {row.people} {row.people === 1 ? "person" : "people"}
      </span>,
    );
  }
  if (row.device_battery_hours !== null) {
    parts.push(
      <span key="battery">
        <Emoji e="🔋" /> battery {row.device_battery_hours} h
      </span>,
    );
  }
  if (row.animals) {
    parts.push(
      <span key="animals">
        <Emoji e="🐾" /> animals: {row.animals}
      </span>,
    );
  }
  if (!parts.length) return <>Needs not recorded</>;
  return <span className="inline-flex flex-wrap gap-x-2 gap-y-0.5">{parts}</span>;
}

/** Where the row's location came from, how precise and how old: "Live GPS · 6 m · 12 s ago". */
export function LocationBadge({ row, now }: { row: HelpRequest; now: string }) {
  if (row.last_lat === null || row.last_lng === null) return <Chip>No location yet</Chip>;
  const fresh = isFresh(row.last_observed_at, now);
  const age = fmtAgo(row.last_observed_at, now);
  if (row.last_source === "gps_link") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${
          fresh ? "bg-blue-50 text-blue-800 ring-blue-300" : "bg-slate-100 text-slate-600 ring-slate-300"
        }`}
      >
        <span className="relative flex size-2.5" aria-hidden="true">
          {fresh ? <span className="absolute inline-flex size-full rounded-full bg-blue-500 opacity-70 motion-safe:animate-ping" /> : null}
          <span className={`relative inline-flex size-2.5 rounded-full ${fresh ? "bg-blue-600" : "bg-slate-400"}`} />
        </span>
        <Emoji e={ICON.gps} /> Live GPS{row.last_accuracy_m !== null ? ` · ${Math.round(row.last_accuracy_m)} m` : ""} · {age}
        {fresh ? "" : " · stale"}
      </span>
    );
  }
  const tone = fresh ? "neutral" : "warn";
  if (row.last_source === "stated") {
    return (
      <Chip tone={tone} className="max-w-full whitespace-normal" title={`Stated ${age}`}>
        <Emoji e={ICON.location} /> Stated: “{row.last_stated_text ?? "a place"}” · {age}
      </Chip>
    );
  }
  if (row.last_source === "enrolled")
    return (
      <Chip tone={tone}>
        <Emoji e="🏠" /> Enrolled address · {age}
      </Chip>
    );
  return <Chip tone="warn">Zone centre (low precision)</Chip>;
}

const LINK_TEXT: Record<ShareStatus, string> = {
  sent: "Link sent, waiting for tap",
  live: "Sharing live",
  stopped: "Link stopped by the person",
  expired: "Link expired (4 h)",
  closed: "Link closed: help reached",
};
const LINK_TONE: Record<ShareStatus, "info" | "good" | "neutral" | "warn"> = {
  sent: "warn",
  live: "good",
  stopped: "neutral",
  expired: "neutral",
  closed: "neutral",
};
const VIA: Record<string, string> = {
  twilio: "by text",
  retell: "by text (Retell)",
  browser_phone: "on the browser phone",
  simulated: "demo text, not sent",
};

function LinkState({ share }: { share: ShareSummary }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
      <Chip tone={LINK_TONE[share.status]}>{LINK_TEXT[share.status]}</Chip>
      <span title={`Consent: “${share.consent_quote}”`}>
        {share.sent_via ? VIA[share.sent_via] : ""}
        {share.ping_count ? ` · ${share.ping_count} fix${share.ping_count === 1 ? "" : "es"}` : ""}
        {share.synthetic ? " · synthetic" : ""} · consent “{share.consent_quote}”
      </span>
    </span>
  );
}

const DISPATCH_TEXT: Record<DispatchStatus, string> = {
  assigned: "Assigned",
  en_route: "En route",
  arrived: "Arrived",
  reached: "Person reached",
  cannot_reach: "Cannot reach",
  cancelled: "Stood down",
};
const DISPATCH_TONE: Record<DispatchStatus, "info" | "good" | "neutral" | "warn" | "bad"> = {
  assigned: "warn",
  en_route: "info",
  arrived: "info",
  reached: "good",
  cannot_reach: "bad",
  cancelled: "neutral",
};

function DispatchLine({ d }: { d: DispatchSummary }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
      <span className="font-semibold text-slate-800">
        <Emoji e={ICON.helper} /> Helper: {displayActor(d.helper_label)}
      </span>
      <Chip tone={DISPATCH_TONE[d.status]}>{DISPATCH_TEXT[d.status]}</Chip>
      <span>sent by {displayActor(d.dispatched_by)}</span>
      {d.note ? <span>· “{d.note}”</span> : null}
      <a href={d.link} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline-offset-2 hover:underline">
        <Emoji e={ICON.navigate} /> Helper link ↗
      </a>
    </span>
  );
}

const SOURCE_TEXT: Record<HelpRequest["last_source"], string> = {
  gps_link: "live GPS",
  stated: "the place they stated",
  enrolled: "the enrolled address",
  centroid: "the zone centre (low precision)",
};

/** "Send helper": a named human picks a helper and gives a reason; the helper gets a link with the live location. */
export function SendHelperButton({ row }: { row: HelpRequest }) {
  const act = useAct();
  const { live, refresh } = useLiveRegistry();
  const [open, setOpen] = useState(false);
  const roster = live?.roster ?? [];
  const [pick, setPick] = useState<string>("");
  const [other, setOther] = useState("");
  const [phone, setPhone] = useState("");
  const label = row.name ?? row.phone ?? "this person";
  const done = row.status === "closed" || row.status === "reached";
  const chosen = roster.find((h) => h.id === pick);
  const phoneOk = !phone.trim() || /^\+[1-9]\d{6,14}$/.test(phone.trim());
  const ready = (Boolean(chosen) || other.trim().length >= 2) && phoneOk;

  return (
    <>
      <Button
        size="sm"
        variant="primary"
        disabled={done || row.last_lat === null}
        title={row.last_lat === null ? "No location yet" : undefined}
        onClick={() => {
          setPick(roster[0]?.id ?? "");
          setOther("");
          setPhone("");
          setOpen(true);
        }}
      >
        <Emoji e={ICON.helper} /> Send helper
      </Button>
      {open ? (
        <DecisionDialog
          title={`Send helper: ${label}`}
          description={
            <>
              Sends one helper to {SOURCE_TEXT[row.last_source]}
              {row.last_accuracy_m !== null ? ` (about ${Math.round(row.last_accuracy_m)} m)` : ""}. They get a link with the
              person&apos;s location (live while the person shares it), their needs, and status buttons.{" "}
              {live?.sms === "simulated" ? "No text is sent in this demo: no text-message provider is set." : "The link is texted if you give a number."} Never
              give the person an arrival time.
            </>
          }
          confirmLabel="Send helper"
          reasonSuggestions={["Wheelchair, no car: needs the van", "Closest team to the live GPS", "Unreached: check on them"]}
          canSubmit={ready}
          onConfirm={async ({ actor, reason }) => {
            const helper = chosen ? { helper_id: chosen.id } : { helper_label: other.trim() };
            await act(
              () => sendHelper(row.id, { ...helper, helper_phone: phone.trim() || null, actor, reason }),
              (r) => `${chosen?.label ?? other.trim()} sent to ${label} (${VIA[r.via] ?? r.via})`,
            );
            refresh();
          }}
          onClose={() => setOpen(false)}
        >
          <fieldset>
            <legend className="mb-1 block text-[13px] font-semibold text-slate-800">
              Helper <span className="text-slate-500">*</span>
            </legend>
            <div className="grid gap-1.5">
              {roster.map((h) => (
                <label key={h.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 ring-1 ring-inset ring-slate-200 has-[:checked]:bg-blue-50 has-[:checked]:ring-blue-400">
                  <input type="radio" name="helper" className="mt-1" checked={pick === h.id} onChange={() => setPick(h.id)} />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{h.label}</span>
                    <span className="block text-xs text-slate-600">{h.note} · demo team</span>
                  </span>
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 ring-1 ring-inset ring-slate-200 has-[:checked]:bg-blue-50 has-[:checked]:ring-blue-400">
                <input type="radio" name="helper" checked={pick === ""} onChange={() => setPick("")} />
                <span className="text-sm font-semibold text-slate-900">Someone else</span>
                <input
                  className={`${inputClass} ml-1 h-8 flex-1`}
                  value={other}
                  onChange={(e) => {
                    setOther(e.target.value);
                    setPick("");
                  }}
                  placeholder="Team or person"
                  aria-label="Other helper"
                />
              </label>
            </div>
          </fieldset>
          <Field label="Text the helper link to (optional)" hint="E.164, for example +12135550142. Empty: the link is shown here only.">
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+1…" />
          </Field>
          {!phoneOk ? <p className="text-sm text-amber-800">That number is not in E.164 form.</p> : null}
        </DecisionDialog>
      ) : null}
    </>
  );
}

const telOk = (p: string | null): p is string => Boolean(p && /^\+?[0-9][0-9 ()-]{5,}$/.test(p));

/** One registry row with its location badge, live link, helper and actions. `showCall` (QRT only) adds a Call link. */
export function LiveRegistryCard({
  row,
  now,
  selected = false,
  onLocate,
  showCall = false,
}: {
  row: HelpRequest;
  now: string;
  selected?: boolean;
  onLocate?: (id: string) => void;
  showCall?: boolean;
}) {
  const { byHelp } = useLiveRegistry();
  const extra = byHelp.get(row.id);
  const done = row.status === "closed" || row.status === "reached";
  return (
    <article
      id={`registry-${row.id}`}
      className={`scroll-mt-2 rounded-md border border-l-[6px] border-slate-200 bg-white px-3 py-2 ${done ? "opacity-60" : ""} ${
        selected ? "ring-2 ring-blue-600" : ""
      }`}
      style={{ borderLeftColor: PRIORITY_COLOR[row.priority] }}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <PriorityChip priority={row.priority} />
        <b className="text-[15px]">{row.name ?? "Name not given"}</b>
        {row.phone ? <span className="font-mono text-sm text-slate-700">{row.phone}</span> : null}
        {showCall && telOk(row.phone) ? (
          <a href={`tel:${row.phone.replace(/[^\d+]/g, "")}`} className="text-xs font-semibold text-blue-700 underline-offset-2 hover:underline">
            Call
          </a>
        ) : null}
        {row.language ? <span className="text-sm text-slate-600">{row.language}</span> : null}
        <span className="ml-auto flex items-center gap-1.5">
          {row.synthetic ? (
            <Chip>synthetic</Chip>
          ) : (
            <Chip tone="info">
              <Emoji e={ICON.phone} /> real phone
            </Chip>
          )}
          <Chip tone={HELP_STATUS_TONE[row.status]}>{HELP_STATUS_LABEL[row.status]}</Chip>
          {onLocate && row.last_lat !== null ? (
            <button type="button" onClick={() => onLocate(row.id)} className="rounded px-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">
              <Emoji e={ICON.location} /> Locate
            </button>
          ) : null}
        </span>
      </header>
      <p className="mt-1 text-sm font-medium text-slate-800">
        <NeedsLine row={row} />
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-slate-500">
          <Emoji e={ICON.location} /> Location:
        </span>
        <LocationBadge row={row} now={now} />
      </p>
      {extra?.share ? (
        <p className="mt-1">
          <LinkState share={extra.share} />
        </p>
      ) : null}
      {extra?.dispatch ? (
        <p className="mt-1">
          <DispatchLine d={extra.dispatch} />
        </p>
      ) : null}
      <p className="mt-0.5 text-xs text-slate-500">
        {row.zone_id ?? "no zone"} · {HELP_SOURCE_LABEL[row.source]}
        {row.assigned_to ? ` · assigned to ${displayActor(row.assigned_to)}` : ""}
      </p>
      <div className="mt-1.5 flex flex-wrap items-start gap-1">
        <SendHelperButton row={row} />
        <RegistryActions row={row} />
      </div>
    </article>
  );
}

/** The board's registry tab: who needs a person, where they are (live GPS when they share it), and who was sent. */
export function LiveRegistryPanel({ registryLabel }: { registryLabel?: string }) {
  const { snap } = useBoard();
  const open = snap.registry.filter((r) => r.status !== "closed" && r.status !== "reached");
  const byPriority = ([1, 2, 3, 4] as const).map((p) => ({ p, n: open.filter((r) => r.priority === p).length }));
  const liveNow = open.filter((r) => r.last_source === "gps_link" && isFresh(r.last_observed_at, snap.now)).length;

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-700">
          <Emoji e={ICON.help} /> {open.length} open{registryLabel ? ` in the ${registryLabel.toLowerCase()}` : ""}
        </span>
        {byPriority.map(({ p, n }) => (
          <span key={p} className="inline-flex items-center gap-1 text-sm text-slate-700">
            <PriorityChip priority={p} /> {n}
          </span>
        ))}
        {liveNow ? (
          <Chip tone="info">
            <Emoji e={ICON.gps} /> {liveNow} live GPS
          </Chip>
        ) : null}
        <span className="ml-auto flex items-center gap-3 text-sm font-semibold">
          <a href={EXPORT_CSV_URL} className="text-blue-700 underline-offset-2 hover:underline">
            <Emoji e={ICON.csv} /> Export CSV
          </a>
          <Link href="/qrt" target="_blank" className="text-blue-700 underline-offset-2 hover:underline">
            <Emoji e={ICON.qrt} /> QRT view ↗
          </Link>
        </span>
      </div>
      <PickupRuns />
      {snap.registry.length ? (
        <div className="space-y-2">
          {snap.registry.map((r) => (
            <LiveRegistryCard key={r.id} row={r} now={snap.now} />
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
          Nobody has asked for a person yet. “I need help” on any call adds a row here, with the number and the last known location.
        </p>
      )}
    </div>
  );
}
