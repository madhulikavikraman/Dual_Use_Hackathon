"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { Signed } from "@/lib/client/api";
import { setOperatorName, useOperator, useOperatorName } from "@/lib/client/supervisor";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, inputClass } from "@/components/ui/Field";

/**
 * Every human action on the board goes through this dialog: a name and a short reason are required,
 * because each one lands in the ledger. Extra fields for the action are passed as children.
 */
export function DecisionDialog({
  title,
  subtitle,
  description,
  confirmLabel,
  danger = false,
  size = "md",
  reasonPlaceholder = "Why? One short line for the ledger",
  reasonSuggestions = [],
  canSubmit = true,
  children,
  onConfirm,
  onClose,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  size?: "sm" | "md" | "lg";
  reasonPlaceholder?: string;
  /** One-click starting points; the human still picks and can edit. */
  reasonSuggestions?: string[];
  /** Extra validation from the children's fields. */
  canSubmit?: boolean;
  children?: ReactNode;
  onConfirm: (signed: Signed) => Promise<unknown>;
  onClose: () => void;
}) {
  const operator = useOperator();
  const saved = useOperatorName(operator);
  // Pre-filled once, when the dialog opens: a name typed later in another tab must not slip into a
  // decision this person is about to sign.
  const [name, setName] = useState(saved);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim().length >= 2 && reason.trim().length >= 3 && canSubmit;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    const actor = name.trim();
    setBusy(true);
    setError(null);
    if (actor !== saved) setOperatorName(operator, actor);
    try {
      await onConfirm({ actor, reason: reason.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <Dialog title={title} subtitle={subtitle} onClose={onClose} size={size}>
      <form onSubmit={submit} className="space-y-4 px-5 py-4">
        {description ? <div className="text-[15px] leading-relaxed text-slate-700">{description}</div> : null}
        {children}
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 border-t border-slate-200 pt-4">
          <Field label="Your name" required>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Supervisor name"
              autoComplete="name"
            />
          </Field>
          <Field label="Reason" required hint="Logged with your name and the time.">
            <input
              className={inputClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              autoFocus={name.trim().length >= 2}
            />
          </Field>
        </div>
        {reasonSuggestions.length ? (
          <div className="-mt-1 flex flex-wrap gap-1.5">
            {reasonSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setReason(s)}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-200"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} disabled={!ready || busy}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
