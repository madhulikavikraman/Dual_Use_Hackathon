import { connection } from "next/server";
import { z } from "zod";
import { db, nowIso, uid } from "@/lib/db";
import { body, handle, json } from "@/lib/http";
import type { TwistEntry } from "@/lib/types";

// The twist log (PRD 17, backlog item 20, D-24): each twist's text, what changed in the build, why, proof and
// commits. Reset never wipes this table. POST upserts by twist_no (fields left out keep their value).

const COMMIT_RE = /^[0-9a-f]{6,40}$/i;

/** Accept a bare SHA or a GitHub commit URL; return the SHA, or null when it is neither. */
function toSha(s: string): string | null {
  const t = s.trim();
  const fromUrl = t.match(/\/commit\/([0-9a-f]{6,40})/i)?.[1];
  const sha = fromUrl ?? t;
  return COMMIT_RE.test(sha) ? sha.toLowerCase() : null;
}

const optText = (max: number) => z.string().max(max).optional();

const Body = z.object({
  twist_no: z.number().int().min(1).max(20),
  title: z.string().trim().min(1).max(200),
  twist_text: optText(5000),
  what_changed: z.string().trim().min(1).max(8000),
  why: optText(5000),
  proof: optText(5000),
  commits: z
    .array(z.string().max(200))
    .max(50)
    .optional()
    .transform((list, ctx) => {
      if (!list) return undefined;
      const out: string[] = [];
      for (const raw of list.filter((x) => x.trim())) {
        const sha = toSha(raw);
        if (!sha) {
          ctx.addIssue({ code: "custom", message: `not a commit SHA or GitHub commit URL: ${raw.slice(0, 60)}` });
          return z.NEVER;
        }
        if (!out.includes(sha)) out.push(sha);
      }
      return out;
    }),
});

const bySortKey = (a: TwistEntry, b: TwistEntry) => a.twist_no - b.twist_no || (a.created_at < b.created_at ? -1 : 1);

/** GET /api/twists — the twist log, sorted by twist number. */
export async function GET() {
  await connection();
  return handle(async () => json({ twists: (await db().all("twist_log")).sort(bySortKey) }));
}

/** POST /api/twists — add or update one twist (TwistBody), upserted by twist_no. */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req, Body);
    const existing = (await db().where("twist_log", { twist_no: b.twist_no })).sort(bySortKey)[0];
    const keep = <K extends keyof TwistEntry>(k: K, v: TwistEntry[K] | undefined, fallback: TwistEntry[K]) =>
      v !== undefined ? v : existing ? existing[k] : fallback;
    const clean = (v: string | undefined) => (v === undefined ? undefined : v.trim() || null);
    const row: TwistEntry = {
      id: existing?.id ?? uid(),
      twist_no: b.twist_no,
      title: b.title,
      twist_text: keep("twist_text", clean(b.twist_text), null),
      what_changed: b.what_changed,
      why: keep("why", clean(b.why), null),
      proof: keep("proof", clean(b.proof), null),
      commits: keep("commits", b.commits, []),
      created_at: existing?.created_at ?? nowIso(),
    };
    await db().upsert("twist_log", row);
    return json({ twist: row, created: !existing }, existing ? 200 : 201);
  });
}
