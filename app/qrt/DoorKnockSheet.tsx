"use client";

import type { HouseholdView } from "@/lib/contracts";
import { fmtTime } from "@/lib/client/format";
import { HELP_STATUS_LABEL, LOCATION_SOURCE_LABEL, NEED_LABEL, scenarioLabel } from "@/lib/client/labels";
import type { Cluster, HelpRequest } from "@/lib/types";
import { useBoard } from "@/components/board/BoardContext";

/** Rows for the door-knock teams: unreached people and priority-3 "check later" rows still open. */
export function doorKnockRows(registry: HelpRequest[]): HelpRequest[] {
  return registry.filter(
    (r) => r.status !== "closed" && r.status !== "reached" && (r.priority === 3 || (r.reason ?? "").toLowerCase().includes("unreached")),
  );
}

export function silenceClusters(clusters: Cluster[]): Cluster[] {
  return clusters.filter((c) => c.kind === "silence" && c.status !== "dismissed");
}

const where = (r: HelpRequest) =>
  r.last_lat === null || r.last_lng === null
    ? "No location"
    : `${r.last_stated_text ? `“${r.last_stated_text}” · ` : ""}${LOCATION_SOURCE_LABEL[r.last_source]} · ${r.last_lat.toFixed(5)}, ${r.last_lng.toFixed(5)}`;

const OUTCOMES = ["Knocked", "Answered", "Needs help", "No answer"];

function Tick({ label }: { label: string }) {
  return (
    <span className="mr-2 inline-flex items-center gap-1 whitespace-nowrap">
      <span className="inline-block size-3 border border-black" aria-hidden="true" />
      {label}
    </span>
  );
}

function ClusterBlock({ cluster, households }: { cluster: Cluster; households: Map<string, HouseholdView> }) {
  const members = cluster.member_ids.map((id) => households.get(id)).filter((h): h is HouseholdView => Boolean(h));
  return (
    <div className="break-inside-avoid border border-slate-400 p-2">
      <p className="font-bold">
        Silence cluster · {cluster.zone_id ?? "no zone"} · {cluster.count} households silent between {fmtTime(cluster.first_at)} and{" "}
        {fmtTime(cluster.last_at)}
      </p>
      <p className="text-slate-700">
        Centre {cluster.center_lat.toFixed(5)}, {cluster.center_lng.toFixed(5)} (about 300 m). Possible tower or power loss: a signal for a person,
        not a conclusion.
      </p>
      {members.length ? (
        <ul className="mt-1 list-disc pl-5">
          {members.map((h) => (
            <li key={h.id}>
              {h.name} · {h.address ?? `${h.lat.toFixed(5)}, ${h.lng.toFixed(5)}`} · {h.language}
              {h.afn_flags.length ? ` · ${h.afn_flags.map((n) => NEED_LABEL[n]).join(", ")}` : ""}
              {h.synthetic ? " · synthetic" : " · real phone"}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The printable door-knock sheet: unreached and priority-3 rows plus silence clusters. On screen it is a
 * preview inside the QRT view; printed, it is the only thing on the page (see the print: classes).
 */
export function DoorKnockSheet({ printed }: { printed: boolean }) {
  const { snap, householdById } = useBoard();
  const rows = doorKnockRows(snap.registry);
  const clusters = silenceClusters(snap.clusters);

  return (
    <section
      aria-label="Door-knock sheet"
      className={printed ? "hidden text-[11pt] leading-snug text-black print:block" : "rounded-lg border border-slate-300 bg-white p-3 text-sm"}
    >
      <header className={printed ? "mb-3 border-b-2 border-black pb-2" : "mb-2"}>
        <h2 className={printed ? "text-[16pt] font-bold" : "text-xs font-bold uppercase tracking-wider text-slate-600"}>
          Door-knock sheet{printed ? ` · ${scenarioLabel(snap.meta.scenario)}` : ""}
        </h2>
        <p className={printed ? "" : "text-xs text-slate-500"}>
          {rows.length} {rows.length === 1 ? "person" : "people"} unreached or to check later · {clusters.length} silence{" "}
          {clusters.length === 1 ? "cluster" : "clusters"}
          {printed ? ` · printed ${fmtTime(snap.now)} · DEMO: residents are synthetic except the volunteer phones` : ""}
        </p>
      </header>

      {rows.length ? (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-400">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Who</th>
              <th className="py-1 pr-2">Where last seen</th>
              <th className="py-1 pr-2">Needs</th>
              {printed ? <th className="py-1">Outcome</th> : <th className="py-1">Status</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="break-inside-avoid border-b border-slate-200 align-top">
                <td className="py-1 pr-2">{i + 1}</td>
                <td className="py-1 pr-2">
                  <b>{r.name ?? "Name not given"}</b>
                  <br />
                  {r.phone ?? "no phone"} · {r.language ?? "language unknown"} · {r.zone_id ?? "no zone"}
                </td>
                <td className="py-1 pr-2">{where(r)}</td>
                <td className="py-1 pr-2">
                  {r.needs.length ? r.needs.map((n) => NEED_LABEL[n]).join(", ") : "—"}
                  {r.people ? ` · ${r.people} people` : ""}
                </td>
                <td className="py-1">
                  {printed ? (
                    <>
                      {OUTCOMES.map((o) => (
                        <Tick key={o} label={o} />
                      ))}
                      <div className="mt-2 border-b border-dotted border-black">Notes:</div>
                    </>
                  ) : (
                    HELP_STATUS_LABEL[r.status]
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-slate-500">Nobody is unreached or waiting for a check right now.</p>
      )}

      {clusters.length ? (
        <div className="mt-3 space-y-2">
          {clusters.map((c) => (
            <ClusterBlock key={c.id} cluster={c} households={householdById} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
