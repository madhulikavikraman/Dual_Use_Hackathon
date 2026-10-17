import { connection } from "next/server";
import { checkEnv, retellEnabled, serverEnv } from "@/lib/env";
import { db as dataStore } from "@/lib/db";
import { anthropic } from "@/lib/anthropic";

type Check = { ok: boolean; detail?: string };

async function timed<T>(p: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms))]);
}

export async function GET() {
  await connection(); // always run at request time (Cache Components would otherwise prerender)
  const envProblems = checkEnv();
  const checks: Record<string, Check> = {
    env: envProblems.length ? { ok: false, detail: envProblems.join("; ") } : { ok: true },
  };

  if (envProblems.length === 0) {
    const env = serverEnv();
    const [db, agent, analysis] = await Promise.allSettled([
      timed(
        (async () => {
          const store = dataStore();
          const households = await store.all("households");
          return `${store.backend} store, ${households.length} households`;
        })(),
      ),
      // models.retrieve confirms the configured model IDs exist for this key (no tokens spent).
      timed(anthropic().models.retrieve(env.AGENT_MODEL).then((m) => m.id)),
      timed(anthropic().models.retrieve(env.ANALYSIS_MODEL).then((m) => m.id)),
    ]);
    const toCheck = (r: PromiseSettledResult<string>): Check =>
      r.status === "fulfilled" ? { ok: true, detail: r.value } : { ok: false, detail: String(r.reason?.message ?? r.reason) };
    checks.database = toCheck(db);
    checks.agent_model = toCheck(agent);
    checks.analysis_model = toCheck(analysis);
    // Optional: without Retell the browser phone carries the calls (D-05).
    checks.retell = { ok: true, detail: retellEnabled() ? "phone network enabled" : "not configured; browser phone transport" };
  }

  const ok = Object.values(checks).every((c) => c.ok);
  return Response.json({ ok, service: "voiceflare", time: new Date().toISOString(), checks }, { status: ok ? 200 : 503 });
}
