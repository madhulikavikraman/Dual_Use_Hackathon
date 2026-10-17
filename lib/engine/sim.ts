import "server-only";
import { db, nowIso } from "@/lib/db";
import { metersBetween, pointInPolygon } from "@/lib/geo";
import type { Call, Household, Meta, SimPlan, SimProfile } from "@/lib/types";
import { answerCall, appendTranscript, endCall, executeTool, failCall } from "./calls";

// The simulator plays synthetic people (and, in rehearsal, the six devices) through the same tool path as
// real calls, so the board, the registry and the evidence page see exactly what a real run produces.
// Every simulated row is labeled; metrics count real phones only (D-20).

const TOWER: [number, number] = [-118.4045, 34.0272];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export function inTowerBlock(h: Household): boolean {
  return h.scenario === "westside" && metersBetween([h.lng, h.lat], TOWER) < 160;
}

async function profileFor(call: Call, h: Household, meta: Meta): Promise<SimProfile> {
  if (call.purpose === "canary") {
    // A canary "receives" the alert only if it sits inside the polygon that was actually sent.
    const hold = call.hold_id ? await db().get("holds", call.hold_id) : null;
    return hold && pointInPolygon(h.lng, h.lat, hold.polygon) ? "canary_yes" : "canary_no";
  }
  if (call.purpose === "test") return h.sim_profile === "silent" ? "silent" : "canary_yes";
  if (call.purpose === "linked_contact") return "leaving";
  if (call.purpose === "sentinel") return h.sim_profile ?? "silent";
  if (meta.sim_preset === "tower_down" && inTowerBlock(h)) return "no_answer";
  if (meta.sim_preset === "mass_no_answer" && h.role === "resident" && hash(h.id) < 0.7) return "no_answer";
  if (call.purpose === "qrt_callback") return h.sim_profile === "needs_help_now" ? "needs_help_now" : "needs_help_leaving";
  return h.sim_profile ?? "leaving";
}

/** Decide when a simulated person answers and when the call finishes. */
export async function planSim(call: Call, h: Household, meta: Meta): Promise<SimPlan> {
  const profile = await profileFor(call, h, meta);
  const r = hash(call.id);
  const now = Date.now();
  const at = (ms: number) => new Date(now + ms).toISOString();
  if (profile === "no_answer" || profile === "silent") return { profile, answer_at: null, done_at: at(18_000 + r * 4000), applied: false };
  if (profile === "voicemail") return { profile, answer_at: null, done_at: at(14_000), applied: false };
  if (call.purpose === "sentinel") {
    // Near-edge sentinels see it first; far ones take longer. Devices on autopilot answer mid-hold.
    const answer = h.has_device ? 14_000 + r * 6000 : 8_000 + r * 25_000;
    return { profile, answer_at: at(answer), done_at: at(answer + 7_000), applied: false };
  }
  const answer = 3_000 + r * 6_000;
  return { profile, answer_at: at(answer), done_at: at(answer + 7_000 + r * 6_000), applied: false };
}

const SAY: Record<string, Partial<Record<SimProfile, string>>> = {
  "en-US": { leaving: "Yes, we're leaving now.", already_left: "We already left, we're at my sister's.", staying: "I'm staying to watch the house.", needs_help_leaving: "We can't leave on our own, we need help.", needs_help_now: "My father can't breathe, please help.", unclear: "Sorry, what? Who is this?" },
  "es-US": { leaving: "Sí, ya nos vamos.", already_left: "Ya salimos, estamos con mi hermana.", staying: "Me quedo a cuidar la casa.", needs_help_leaving: "No podemos salir solos, necesitamos ayuda.", needs_help_now: "Mi papá no puede respirar, ayuda por favor.", unclear: "¿Perdón? ¿Quién habla?" },
  "ko-KR": { leaving: "네, 지금 떠나요.", already_left: "이미 나왔어요.", staying: "저는 집에 남을게요.", needs_help_leaving: "혼자서는 못 나가요, 도와주세요.", needs_help_now: "아버지가 숨을 못 쉬세요.", unclear: "네? 누구세요?" },
  "zh-CN": { leaving: "好的，我们现在就走。", already_left: "我们已经离开了。", staying: "我要留下来看家。", needs_help_leaving: "我们自己走不了，需要帮助。", needs_help_now: "我父亲喘不过气来。", unclear: "什么？你是谁？" },
  "hi-IN": { leaving: "हाँ, हम अभी निकल रहे हैं।", already_left: "हम पहले ही निकल चुके हैं।", staying: "मैं घर पर ही रहूँगा।", needs_help_leaving: "हम खुद नहीं निकल सकते, मदद चाहिए।", needs_help_now: "मेरे पिता साँस नहीं ले पा रहे हैं।", unclear: "क्या? आप कौन बोल रहे हैं?" },
  "fr-FR": { leaving: "Oui, nous partons maintenant.", already_left: "Nous sommes déjà partis.", staying: "Je reste pour surveiller la maison.", needs_help_leaving: "Nous ne pouvons pas partir seuls, il nous faut de l'aide.", needs_help_now: "Mon père n'arrive plus à respirer.", unclear: "Pardon ? Qui est à l'appareil ?" },
  "hy-AM": { leaving: "Այո, հիմա գնում ենք:", already_left: "Արդեն գնացել ենք:", staying: "Ես մնում եմ տանը:", needs_help_leaving: "Մենք ինքնուրույն չենք կարող գնալ:", needs_help_now: "Հայրս չի կարողանում շնչել:", unclear: "Ի՞նչ: Ո՞վ է:" },
  "fil-PH": { leaving: "Oo, aalis na kami ngayon.", already_left: "Nakaalis na kami.", staying: "Dito lang ako sa bahay.", needs_help_leaving: "Hindi kami makakaalis nang mag-isa.", needs_help_now: "Hindi makahinga ang tatay ko.", unclear: "Ano po? Sino ito?" },
};

function line(h: Household, p: SimProfile): string {
  return SAY[h.lang_code]?.[p] ?? SAY["en-US"][p] ?? "";
}

/** Play out an answered simulated call through the shared tools, then end it. */
async function applyOutcome(call: Call, h: Household, plan: SimPlan, meta: Meta) {
  const v = call.vars;
  const agentOpen = `This is the ${meta.mode === "campus" ? "campus" : "city"} emergency information line, verification phrase ${v.verification_phrase}. Simulated call.`;
  const hazard = meta.usgs_event ? "Yes, strong shaking. A wall is down on Pico." : "Yes. Smoke and a glow to the west.";
  switch (plan.profile) {
    case "sentinel_yes":
    case "sentinel_no":
    case "sentinel_unsure": {
      const sees = plan.profile === "sentinel_yes" ? "yes" : plan.profile === "sentinel_no" ? "no" : "unsure";
      const what = sees === "yes" ? hazard.replace(/^Yes\.?\s*/, "") : sees === "no" ? "nothing here, all quiet" : "hard to tell, some haze";
      await appendTranscript(call.id, [
        { role: "agent", text: `${agentOpen} ${v.alert_text} Does this match what you see?` },
        { role: "person", text: sees === "yes" ? hazard : sees === "no" ? "No. Nothing here." : "Not sure, there's some haze." },
      ]);
      await executeTool(call.id, "read_observation", { sees, what, direction: sees === "yes" ? "west" : null });
      break;
    }
    case "canary_yes":
    case "canary_no": {
      const received = plan.profile === "canary_yes" ? "yes" : "no";
      await appendTranscript(call.id, [
        { role: "agent", text: `${agentOpen} Did you receive an emergency alert on your phone in the last minute?` },
        { role: "person", text: call.purpose === "test" ? "Yes, I can hear you." : received === "yes" ? "Yes, my phone just went off." : "No, nothing." },
      ]);
      await executeTool(call.id, "received_alert", { received });
      break;
    }
    default: {
      const subject = call.subject_household_id ? await db().get("households", call.subject_household_id) : h;
      const p = plan.profile;
      const agentAsk = call.purpose === "linked_contact"
        ? `${agentOpen} We're calling because ${v.subject_name} did not answer. Have you heard from them?`
        : `${agentOpen} ${v.directive_text} ${v.move_text} Are you leaving, staying, or already gone?`;
      const said = call.purpose === "linked_contact" ? `Yes, ${v.subject_name} is leaving with me.` : line(h, p);
      await appendTranscript(call.id, [{ role: "agent", text: agentAsk }, { role: "person", text: said }]);
      const needs = subject?.afn_flags.length ? subject.afn_flags : ["no_car"];
      const base = { understood: null, destination: null, people: 1 + Math.floor(hash(call.id + "p") * 3), needs: [], device_battery_hours: null,
        animals: null, location_text: null, location_consent: true, can_leave: true, refusal_reason: null, memory_note: null };
      if (call.purpose === "linked_contact" || p === "leaving") {
        await executeTool(call.id, "record_status", { ...base, status: "leaving", destination: v.evac_point || "a relative's home", understood: hash(call.id + "u") < 0.85 });
      } else if (p === "already_left") {
        await executeTool(call.id, "record_status", { ...base, status: "already_left", destination: "a relative's home outside the zone" });
      } else if (p === "staying") {
        await executeTool(call.id, "record_status", { ...base, status: "staying", refusal_reason: "wants to stay with the house" });
      } else if (p === "needs_help_leaving") {
        await executeTool(call.id, "record_status", { ...base, status: "needs_help_leaving", needs, can_leave: false, people: 2 });
      } else if (p === "needs_help_now") {
        await executeTool(call.id, "record_status", { ...base, status: "needs_help_now", needs, can_leave: false, people: 2 });
        await executeTool(call.id, "request_human", { reason: "medical_emergency", urgency: "now", note: "trouble breathing" });
        await appendTranscript(call.id, [{ role: "agent", text: "Hang up and call 911 now. A person from the response team is flagged." }]);
      } else {
        await executeTool(call.id, "record_status", { ...base, status: "unclear", can_leave: null, location_consent: null });
      }
    }
  }
  await endCall(call.id, "completed");
}

/** Advance simulated calls: answer, play out, or ring out. */
export async function simTick(now: string, meta: Meta): Promise<number> {
  let n = 0;
  const calls = (await db().where("calls", { transport: "sim" })).filter((c) => (c.state === "ringing" || c.state === "active") && c.sim);
  for (const call of calls) {
    const plan = call.sim!;
    if (call.state === "ringing") {
      if (plan.answer_at && plan.answer_at <= now) {
        await answerCall(call.id);
        n++;
      } else if (!plan.answer_at && plan.done_at <= now) {
        await failCall(call.id, plan.profile === "voicemail" ? "voicemail" : "no_answer");
        n++;
      }
    } else if (call.state === "active" && plan.done_at <= now && !plan.applied) {
      await db().update("calls", call.id, { sim: { ...plan, applied: true } });
      const h = call.household_id ? await db().get("households", call.household_id) : null;
      if (h) {
        try {
          await applyOutcome({ ...call, state: "active" }, h, plan, meta);
        } catch (e) {
          console.error("[sim]", e);
          await endCall(call.id, "completed");
        }
      } else await endCall(call.id, "completed");
      n++;
    }
  }
  return n;
}

/** Tower down (PRD demo 2:55): the Palms block goes silent at once; pattern watch sees the silence cluster. */
export async function towerDown(): Promise<number> {
  const block = (await db().where("households", { scenario: "westside" })).filter(inTowerBlock);
  const { newCall, buildVars, inboundCampaign } = await import("./campaigns");
  const { getMeta } = await import("./log");
  const meta = await getMeta();
  const campaign = (await db().where("campaigns", { zone_id: "LA-CC", status: "running" }))[0] ?? (await inboundCampaign());
  const zone = await db().get("zones", "LA-CC");
  for (const h of block) {
    const live = (await db().where("calls", { household_id: h.id })).filter((c) => ["queued", "ringing", "active"].includes(c.state));
    for (const c of live) await failCall(c.id, "unreachable");
    if (!live.length) {
      const c = newCall({ campaign_id: campaign.id, household: h, purpose: "resident", attempt: 2,
        vars: buildVars({ zone, household: h, purpose: "resident", stage: "1", meta }) });
      c.state = "ringing";
      c.started_at = nowIso();
      await db().insert("calls", c);
      await failCall(c.id, "unreachable");
    }
  }
  return block.length;
}
