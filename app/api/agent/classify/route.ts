import { z } from "zod";
import { classifyTranscript } from "@/lib/agent/postcall";
import { body, handle, json } from "@/lib/http";

const Body = z.object({
  transcript: z.string().min(1).max(20_000),
  language: z.string().default("English"),
  purpose: z.string().default("resident"),
});

/** POST /api/agent/classify — the post-call intent classifier on its own (used by the gold-set runner). */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req, Body);
    return json(await classifyTranscript(b.transcript, b.language, b.purpose));
  });
}
