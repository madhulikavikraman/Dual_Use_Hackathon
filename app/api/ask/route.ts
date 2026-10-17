import { z } from "zod";
import { askBoard } from "@/lib/agent/ask";
import { body, handle, json } from "@/lib/http";

const Body = z.object({ question: z.string().trim().min(3).max(500) });

/** POST /api/ask {question} — "Ask the board": a read-only answer from the live board (Claude Sonnet). */
export async function POST(req: Request) {
  return handle(async () => {
    const { question } = await body(req, Body);
    return json({ answer: await askBoard(question) });
  });
}
