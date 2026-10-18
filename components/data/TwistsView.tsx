"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import type { TwistEntry } from "@/lib/types";
import { Button, Linkify, DemoBadge, clock } from "./ui";

const REPO = "https://github.com/madhulikavikraman/Dual_Use_Hackathon";
const SCHEDULE: Record<number, string> = { 1: "Fri 11:30 PM", 2: "Sat 4:30 AM", 3: "Sat 7:00 AM" };

interface Draft {
  twist_no: string;
  title: string;
  twist_text: string;
  what_changed: string;
  why: string;
  proof: string;
  commits: string;
}

const EMPTY: Draft = { twist_no: "", title: "", twist_text: "", what_changed: "", why: "", proof: "", commits: "" };

function toDraft(t: TwistEntry): Draft {
  return {
    twist_no: String(t.twist_no),
    title: t.title,
    twist_text: t.twist_text ?? "",
    what_changed: t.what_changed,
    why: t.why ?? "",
    proof: t.proof ?? "",
    commits: t.commits.join(", "),
  };
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-neutral-500">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  "rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-sky-600";

function TwistCard({ t, onEdit }: { t: TwistEntry; onEdit: () => void }) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 print:break-inside-avoid print:shadow-none">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          <span className="mr-2 font-mono text-sm text-neutral-500">Twist {t.twist_no}</span>
          {t.title}
        </h2>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          {SCHEDULE[t.twist_no] ? <span>Dropped {SCHEDULE[t.twist_no]}</span> : null}
          <span>Filed {new Date(t.created_at).toLocaleString()}</span>
          <Button tone="quiet" onClick={onEdit} className="!px-2 !py-0.5 text-xs">
            Edit
          </Button>
        </div>
      </div>
      {t.twist_text ? (
        <blockquote className="mt-3 border-l-4 border-neutral-300 pl-3 text-sm text-neutral-700 italic dark:border-neutral-700 dark:text-neutral-300">
          {t.twist_text}
        </blockquote>
      ) : null}
      <dl className="mt-3 grid gap-3 text-sm md:grid-cols-[10rem_1fr]">
        <dt className="font-semibold text-neutral-500">What changed in the build</dt>
        <dd className="whitespace-pre-line">
          <Linkify text={t.what_changed} />
        </dd>
        {t.why ? (
          <>
            <dt className="font-semibold text-neutral-500">Why</dt>
            <dd className="whitespace-pre-line">
              <Linkify text={t.why} />
            </dd>
          </>
        ) : null}
        {t.proof ? (
          <>
            <dt className="font-semibold text-neutral-500">Proof</dt>
            <dd className="whitespace-pre-line">
              <Linkify text={t.proof} />
            </dd>
          </>
        ) : null}
        <dt className="font-semibold text-neutral-500">Commits</dt>
        <dd className="flex flex-wrap gap-2">
          {t.commits.length ? (
            t.commits.map((sha) => (
              <a
                key={sha}
                href={`${REPO}/commit/${sha}`}
                target="_blank"
                rel="noreferrer"
                className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-sky-800 underline dark:bg-neutral-800 dark:text-sky-300"
              >
                {sha.slice(0, 7)}
              </a>
            ))
          ) : (
            <span className="text-neutral-500">none yet</span>
          )}
        </dd>
      </dl>
    </article>
  );
}

export default function TwistsView() {
  const [twists, setTwists] = useState<TwistEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/twists", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setTwists(body.twists as TwistEntry[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const set = (k: keyof Draft) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  const nextNo = (twists?.reduce((m, t) => Math.max(m, t.twist_no), 0) ?? 0) + 1;

  async function save() {
    setSaving(true);
    setSaved(null);
    setError(null);
    try {
      const payload = {
        twist_no: Number(draft.twist_no || nextNo),
        title: draft.title,
        twist_text: draft.twist_text,
        what_changed: draft.what_changed,
        why: draft.why,
        proof: draft.proof,
        commits: draft.commits.split(/[\s,]+/).filter(Boolean),
      };
      const res = await fetch("/api/twists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setSaved(`Twist ${payload.twist_no} ${body.created ? "added" : "updated"} at ${clock(new Date().toISOString())}.`);
      setDraft(EMPTY);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const editing = twists?.some((t) => String(t.twist_no) === draft.twist_no);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <DemoBadge />
          <span>VoiceFlare · Best Shift Adapter</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Twist log</h1>
        <p className="mt-1 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
          For each twist: the text as it dropped, what changed in the build (with commits), why, and the proof that it works. Twists
          drop Fri 11:30 PM, Sat 4:30 AM and Sat 7:00 AM, with six hours to respond to each.
        </p>
        <nav className="mt-2 flex flex-wrap gap-3 text-sm text-sky-700 dark:text-sky-400 print:hidden">
          <Link href="/evidence" className="underline">
            Twist 1 proof: /evidence
          </Link>
          <Link href="/demo" className="underline">
            /demo
          </Link>
          <a href={`${REPO}/commits`} target="_blank" rel="noreferrer" className="underline">
            Repo commits
          </a>
        </nav>
      </header>

      {error ? (
        <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="mt-5 flex flex-col gap-4">
        {twists === null ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : twists.length === 0 ? (
          <p className="text-sm text-neutral-500">No twists filed yet. Reset the demo once to file Twist 1, or add it below.</p>
        ) : (
          twists.map((t) => (
            <TwistCard
              key={t.id}
              t={t}
              onEdit={() => {
                setDraft(toDraft(t));
                document.getElementById("twist-form")?.scrollIntoView({ behavior: "smooth" });
              }}
            />
          ))
        )}
      </section>

      <section id="twist-form" className="mt-8 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 print:hidden">
        <h2 className="text-lg font-semibold">{editing ? `Update twist ${draft.twist_no}` : "Add or update a twist"}</h2>
        <p className="text-sm text-neutral-500">Saving with an existing twist number replaces that entry.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr]">
          <Field label="Twist no.">
            <input className={inputCls} type="number" min={1} max={20} placeholder={String(nextNo)} value={draft.twist_no} onChange={set("twist_no")} />
          </Field>
          <Field label="Title">
            <input className={inputCls} value={draft.title} onChange={set("title")} placeholder="e.g. Network down at 3 AM" />
          </Field>
        </div>
        <div className="mt-3 grid gap-3">
          <Field label="Twist text (verbatim)">
            <textarea className={inputCls} rows={3} value={draft.twist_text} onChange={set("twist_text")} />
          </Field>
          <Field label="What changed in the build">
            <textarea className={inputCls} rows={4} value={draft.what_changed} onChange={set("what_changed")} />
          </Field>
          <Field label="Why">
            <textarea className={inputCls} rows={2} value={draft.why} onChange={set("why")} />
          </Field>
          <Field label="Proof (20 seconds: what to open or watch; links are fine)">
            <textarea className={inputCls} rows={2} value={draft.proof} onChange={set("proof")} />
          </Field>
          <Field label="Commits" hint="SHAs or GitHub commit URLs, separated by commas or spaces.">
            <input className={`${inputCls} font-mono`} value={draft.commits} onChange={set("commits")} placeholder="f3b21f9, 1a2b3c4" />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button tone="primary" onClick={save} disabled={saving || !draft.title.trim() || !draft.what_changed.trim()}>
            {saving ? "Saving…" : editing ? "Update twist" : "Save twist"}
          </Button>
          <Button tone="quiet" onClick={() => setDraft(EMPTY)}>
            Clear
          </Button>
          {saved ? <span className="text-sm text-emerald-700 dark:text-emerald-400">{saved}</span> : null}
        </div>
      </section>
    </main>
  );
}
