"use client";

// /call — the public line in the browser: pick a language, POST /api/call {lang_code}, and go to the
// caller's phone page, which answers by itself (?autoanswer=1). The language tap also unlocks sound
// for that page (same document, client-side navigation).

import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { LANGUAGES } from "@/lib/languages";
import { unlockAudio } from "./audio";

export default function PublicLine() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Activity keeps this page alive when hidden: coming back must not show a stuck "Calling…".
  useLayoutEffect(
    () => () => {
      setBusy(null);
    },
    [],
  );

  const call = async (code: string) => {
    if (busy) return;
    unlockAudio();
    setBusy(code);
    setError(null);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang_code: code }),
      });
      const data = (await res.json().catch(() => null)) as { household_id?: string; error?: string } | null;
      if (!res.ok || !data?.household_id) throw new Error(data?.error || `HTTP ${res.status}`);
      router.push(`/phone/${data.household_id}?autoanswer=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-slate-950 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-slate-50">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">VoiceFlare</p>
        <h1 className="mt-1 text-3xl font-semibold">Emergency information line</h1>
        <p className="mt-2 text-slate-300">
          Choose your language · Elija su idioma · 언어를 선택하세요 · 选择语言 · अपनी भाषा चुनें · Choisissez votre langue
        </p>
        <span className="mt-3 w-fit rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/40">
          Demo call for a hackathon
        </span>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {LANGUAGES.map((l) => {
            const prefix = l.code.split("-")[0];
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => void call(l.code)}
                disabled={busy !== null}
                className={`flex min-h-24 flex-col items-center justify-center rounded-2xl px-3 py-4 text-center ring-1 transition active:scale-[0.98] disabled:opacity-60 ${
                  busy === l.code ? "bg-emerald-500 text-emerald-950 ring-emerald-400" : "bg-slate-900 ring-slate-700 hover:bg-slate-800"
                }`}
              >
                <span lang={prefix} className="text-2xl font-semibold">
                  {l.native}
                </span>
                <span className="mt-1 text-sm opacity-75">{busy === l.code ? "Calling…" : l.name}</span>
                {l.voice === "thin" && busy !== l.code && <span className="mt-1 text-[11px] text-amber-300">text may be needed</span>}
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/40">
            The line could not connect: {error}. Try again.
          </p>
        )}

        <div className="mt-auto space-y-2 pt-8 text-sm text-slate-400">
          <p>The agent reads only the instructions a person approved for your area, and can hand you to a person.</p>
          <p>Deaf or hard of hearing, or in a loud place? You can type instead of talking on the next screen.</p>
          <p className="font-semibold text-slate-200">In a life-threatening emergency, call 911.</p>
        </div>
      </div>
    </main>
  );
}
