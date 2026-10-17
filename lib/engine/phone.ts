import "server-only";
import { agentTurn } from "@/lib/agent/turn";
import type { PhoneActionBody, PhoneState, PhoneTurnResult } from "@/lib/contracts";
import { db, nowIso } from "@/lib/db";
import { retellEnabled } from "@/lib/env";
import { HttpError } from "@/lib/http";
import type { Call } from "@/lib/types";
import { answerCall, endCall, failCall } from "./calls";

// The browser phone (/phone/[id]): its poll is also the presence heartbeat (PRD 13).

const RECENT_END_MS = 15_000;

type Line = NonNullable<PhoneState["call"]>["lines"][number];

function lines(call: Call): Line[] {
  const at = call.answered_at ?? call.started_at ?? call.created_at;
  return (call.transcript ?? "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const person = l.startsWith("Person:") || l.startsWith("User:");
      return { role: person ? ("person" as const) : ("agent" as const), text: l.replace(/^(Agent|Person|User):\s*/, ""), at };
    });
}

export async function phoneState(householdId: string): Promise<PhoneState> {
  const h = await db().get("households", householdId);
  if (!h) throw new HttpError(404, "phone not found");
  await db().update("households", h.id, { presence_at: nowIso() });
  const calls = (await db().where("calls", { household_id: h.id })).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  // Only browser-transport calls ring this page; a Retell call rings the real phone instead.
  const live = calls.find((c) => (c.state === "ringing" || c.state === "active") && c.transport === "browser");
  const recent = calls.find((c) => c.ended_at && Date.now() - Date.parse(c.ended_at) < RECENT_END_MS && c.transport === "browser");
  const call = live ?? recent ?? null;
  return {
    household: { id: h.id, name: h.name, language: h.language, lang_code: h.lang_code, device_label: h.device_label, role: h.role, zone_id: h.zone_id },
    call: call
      ? {
          id: call.id, state: call.state, purpose: call.purpose, started_at: call.started_at, answered_at: call.answered_at, ended_at: call.ended_at,
          lines: lines(call), lang_code: call.vars.lang_code || h.lang_code, zone_name: call.vars.zone_name,
        }
      : null,
    retell: retellEnabled(),
    simulated: true,
  };
}

export async function phoneAction(householdId: string, body: PhoneActionBody): Promise<PhoneTurnResult> {
  const call = await db().get("calls", body.call_id);
  if (!call || call.household_id !== householdId) throw new HttpError(404, "call not found for this phone");
  const lang_code = call.vars.lang_code;
  switch (body.action) {
    case "answer": {
      if (call.state === "ringing") await answerCall(call.id);
      else if (call.state !== "active") throw new HttpError(409, `call is ${call.state}`);
      const r = await agentTurn(call.id, null);
      return { ...r, lang_code };
    }
    case "say": {
      if (call.state !== "active") throw new HttpError(409, `call is ${call.state}`);
      const text = (body.text ?? "").trim();
      if (!text) return { reply: "", ended: false, lang_code };
      const r = await agentTurn(call.id, text.slice(0, 1000));
      return { ...r, lang_code };
    }
    case "decline":
      await failCall(call.id, "no_answer", "declined on the phone");
      return { reply: "", ended: true, lang_code };
    case "hangup":
      await endCall(call.id, "caller_hung_up");
      return { reply: "", ended: true, lang_code };
  }
}
