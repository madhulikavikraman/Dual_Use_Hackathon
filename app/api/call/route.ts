import { z } from "zod";
import { startBrowserInbound } from "@/lib/engine/calls";
import { body, handle, json } from "@/lib/http";
import { LANGUAGES } from "@/lib/languages";

const Body = z.object({ lang_code: z.string().refine((c) => LANGUAGES.some((l) => l.code === c), "unsupported language").default("en-US") });

/** POST /api/call {lang_code} — the public line in the browser: returns a phone that is already ringing. */
export async function POST(req: Request) {
  return handle(async () => {
    const { lang_code } = await body(req, Body);
    return json(await startBrowserInbound(lang_code));
  });
}
