"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { askBoard } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";

interface Asked {
  question: string;
  answer: string | null;
  error: string | null;
}

/** **bold** spans as <strong>; everything else stays plain text. */
function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) => (part.length > 4 && part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part));
}

/** The answer may use light Markdown (bold, bullet lines). Render just that, without HTML injection. */
function AnswerText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    const items = bullets;
    blocks.push(
      <ul key={blocks.length} className="list-disc space-y-0.5 pl-5">
        {items.map((b, i) => (
          <li key={i}>{inline(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  for (const line of text.split("\n")) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flush();
    if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-1">{blocks}</div>;
}

/** "Ask the board" (PRD backlog 17): a read-only question about the live board, answered in a few sentences. */
export function AskBoard() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<Asked | null>(null);
  const latest = useRef(0);
  const busy = asked !== null && asked.answer === null && asked.error === null;

  async function ask(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 3 || busy) return;
    const id = ++latest.current;
    setAsked({ question: q, answer: null, error: null });
    try {
      const { answer } = await askBoard(q);
      if (id === latest.current) setAsked({ question: q, answer, error: null });
    } catch (err) {
      if (id === latest.current) setAsked({ question: q, answer: null, error: err instanceof Error ? err.message : String(err) });
    }
  }

  function dismiss() {
    latest.current++; // a late answer to a dismissed question is dropped
    setAsked(null);
  }

  return (
    <section data-tour="ask" aria-label="Ask the board" className="shrink-0">
      <form onSubmit={ask} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="Ask the board… e.g. who in Culver City still needs a person?"
          aria-label="Ask the board"
          className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/25"
        />
        <Button type="submit" disabled={busy || question.trim().length < 3}>
          {busy ? "Thinking…" : "Ask"}
        </Button>
      </form>
      {asked ? (
        <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-900">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 font-semibold">{asked.question}</p>
            <button type="button" onClick={dismiss} aria-label="Dismiss the answer" className="text-lg leading-none text-slate-400 hover:text-slate-900">
              ×
            </button>
          </div>
          {asked.error ? (
            <p className="mt-1 text-amber-900">Could not answer: {asked.error}</p>
          ) : asked.answer === null ? (
            <p className="mt-1 animate-pulse text-slate-600">Thinking… reading the live board.</p>
          ) : (
            <div className="mt-1 max-h-40 overflow-y-auto leading-relaxed">
              <AnswerText text={asked.answer} />
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Read-only: Claude reads a summary of the board and cannot change anything.</p>
        </div>
      ) : null}
    </section>
  );
}
