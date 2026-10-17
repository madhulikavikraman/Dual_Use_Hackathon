"use client";

import { Field, inputClass } from "@/components/ui/Field";
import type { ZoneTexts } from "./useZoneTexts";

/** The three texts the agent reads verbatim for a zone. All editable; the human approves them. */
export function ZoneTextFields({
  texts,
  fromServer,
  onEdit,
}: {
  texts: ZoneTexts | null;
  fromServer: boolean;
  onEdit: (patch: Partial<ZoneTexts>) => void;
}) {
  if (!texts) return <p className="rounded-md bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">Loading the approved texts…</p>;
  return (
    <div className="space-y-3">
      <Field label="Directive (read verbatim by the agent)">
        <textarea
          className={`${inputClass} min-h-[84px] leading-snug`}
          value={texts.directive_text}
          onChange={(e) => onEdit({ directive_text: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3">
        <Field label="Move text (route)">
          <textarea
            className={`${inputClass} min-h-[64px] leading-snug`}
            value={texts.move_text}
            onChange={(e) => onEdit({ move_text: e.target.value })}
            placeholder="e.g. Head south via Sepulveda Blvd"
          />
        </Field>
        <Field label="Evacuation point">
          <textarea
            className={`${inputClass} min-h-[64px] leading-snug`}
            value={texts.evac_point}
            onChange={(e) => onEdit({ evac_point: e.target.value })}
            placeholder="None"
          />
        </Field>
      </div>
      {fromServer ? null : (
        <p className="text-xs text-amber-800">
          Pre-filled from the standard vocabulary (the defaults service did not answer). Check the route and the evacuation point.
        </p>
      )}
    </div>
  );
}
