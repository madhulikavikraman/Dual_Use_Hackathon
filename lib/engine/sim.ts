import "server-only";
import { db, nowIso } from "@/lib/db";
import { metersBetween, pointInPolygon } from "@/lib/geo";
import type { Call, Household, Meta, SimPlan, SimProfile } from "@/lib/types";
import { toolsForPurpose } from "@/lib/agent/tools";
import { answerCall, appendTranscript, endCall, executeTool, failCall } from "./calls";
import { activeShareFor } from "./locate";

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
  if (call.purpose === "sentinel") return meta.sim_preset === "dark_zone" ? "silent" : h.sim_profile ?? "silent";
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
  if (profile === "no_answer" || profile === "silent") return { profile, answer_at: null, done_at: at(14_000 + r * 3000), applied: false };
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

/**
 * Heat check-in line: what a synthetic older resident says to "Can you stay cool right now? Do you need water, a ride
 * to a cooling center, or someone to check on you?", in every language the simulator speaks. needs_help_now uses
 * CDC heat-stroke warning signs (dizziness, confusion, headache); linked is a linked contact who has not heard from
 * them; eta is Phone 2 asking when the ride comes (the agent never gives an ETA).
 */
type HeatLine = "leaving" | "already_left" | "staying" | "needs_help_leaving" | "needs_help_now" | "wants_check_in" | "unclear" | "linked" | "eta";
export const HEAT_SAY: Record<string, Record<HeatLine, string>> = {
  "en-US": {
    leaving: "Yes. My son is driving me to the cooling center now.",
    already_left: "I'm home and the air conditioning works. It's cool in here.",
    staying: "I'll stay home. I have a fan and water.",
    needs_help_leaving: "I don't drive anymore. I need a ride to the cooling center.",
    needs_help_now: "I feel dizzy and confused, and my head hurts.",
    wants_check_in: "I live alone. Could someone come and check on me?",
    unclear: "Sorry, who is this?",
    linked: "No, I haven't heard from them today. Can someone knock on their door?",
    eta: "When will the ride get here?",
  },
  "es-US": {
    leaving: "Sí. Mi hijo me lleva ahora al centro de enfriamiento.",
    already_left: "Estoy en casa, el aire acondicionado funciona y aquí está fresco.",
    staying: "Me quedo en casa. Tengo un ventilador y agua.",
    needs_help_leaving: "Ya no manejo. Necesito que alguien me lleve al centro de enfriamiento.",
    needs_help_now: "Tengo mareos y confusión, y me duele la cabeza.",
    wants_check_in: "Vivo sin compañía. ¿Puede venir alguien a ver cómo estoy?",
    unclear: "¿Perdón? ¿Quién habla?",
    linked: "No, hoy no he sabido nada. ¿Puede alguien ir a tocar a su puerta?",
    eta: "¿A qué hora llega el transporte?",
  },
  "ko-KR": {
    leaving: "네, 아들이 지금 무더위 쉼터로 데려다줘요.",
    already_left: "집에 있어요. 에어컨이 잘 돼서 시원해요.",
    staying: "집에 있을게요. 선풍기랑 물이 있어요.",
    needs_help_leaving: "이제 운전을 못 해요. 쉼터까지 태워 줄 사람이 필요해요.",
    needs_help_now: "어지럽고 정신이 혼미하고 머리가 아파요.",
    wants_check_in: "혼자 살아요. 누가 와서 좀 봐 줄 수 있을까요?",
    unclear: "네? 누구세요?",
    linked: "아니요, 오늘은 연락이 없었어요. 누가 문을 두드려 봐 줄 수 있나요?",
    eta: "차는 언제 와요?",
  },
  "zh-CN": {
    leaving: "好的，我儿子现在送我去降温中心。",
    already_left: "我在家，空调好用，屋里很凉快。",
    staying: "我待在家里，有风扇也有水。",
    needs_help_leaving: "我不开车了，需要有人送我去降温中心。",
    needs_help_now: "我头晕，有点糊涂，头也很痛。",
    wants_check_in: "我一个人住，能不能有人来看看我？",
    unclear: "什么？你是谁？",
    linked: "没有，今天一直没联系上。能不能派人去敲敲门？",
    eta: "车什么时候到？",
  },
  "hi-IN": {
    leaving: "हाँ, मेरा बेटा मुझे अभी कूलिंग सेंटर ले जा रहा है।",
    already_left: "मैं घर पर हूँ, एसी चल रहा है, यहाँ ठंडक है।",
    staying: "मैं घर पर ही रहूँगा। मेरे पास पंखा और पानी है।",
    needs_help_leaving: "मैं अब गाड़ी नहीं चलाता। मुझे कूलिंग सेंटर तक ले जाने के लिए कोई चाहिए।",
    needs_help_now: "मुझे चक्कर आ रहे हैं, उलझन हो रही है और सिर में दर्द है।",
    wants_check_in: "मैं अकेला रहता हूँ। क्या कोई आकर मुझे देख सकता है?",
    unclear: "क्या? आप कौन बोल रहे हैं?",
    linked: "नहीं, आज उनसे कोई बात नहीं हुई। क्या कोई उनका दरवाज़ा खटखटा सकता है?",
    eta: "गाड़ी कब आएगी?",
  },
  "fr-FR": {
    leaving: "Oui, mon fils m'emmène au centre de rafraîchissement maintenant.",
    already_left: "Je suis chez moi, la climatisation marche, il fait frais.",
    staying: "Je reste chez moi. J'ai un ventilateur et de l'eau.",
    needs_help_leaving: "Je ne conduis plus. Il me faut quelqu'un pour m'emmener au centre de rafraîchissement.",
    needs_help_now: "J'ai des vertiges, je me sens confus et j'ai mal à la tête.",
    wants_check_in: "Je vis seul. Quelqu'un pourrait venir voir comment je vais ?",
    unclear: "Pardon ? Qui est à l'appareil ?",
    linked: "Non, pas de nouvelles aujourd'hui. Quelqu'un peut aller frapper à sa porte ?",
    eta: "Quand est-ce que la voiture arrive ?",
  },
  "hy-AM": {
    leaving: "Այո, տղաս հիմա ինձ տանում է զովացման կենտրոն:",
    already_left: "Տանն եմ, օդորակիչը աշխատում է, զով է:",
    staying: "Տանը կմնամ: Օդափոխիչ ու ջուր ունեմ:",
    needs_help_leaving: "Այլևս մեքենա չեմ վարում: Պետք է, որ մեկն ինձ տանի զովացման կենտրոն:",
    needs_help_now: "Գլուխս պտտվում է, շփոթված եմ, ու գլուխս ցավում է:",
    wants_check_in: "Մենակ եմ ապրում: Կարո՞ղ է մեկը գալ ու ինձ տեսնել:",
    unclear: "Ի՞նչ: Ո՞վ է:",
    linked: "Ոչ, այսօր լուր չունեմ: Կարո՞ղ է մեկը գնալ ու դուռը թակել:",
    eta: "Մեքենան ե՞րբ կգա:",
  },
  "fil-PH": {
    leaving: "Oo, ihahatid ako ng anak ko sa cooling center ngayon.",
    already_left: "Nasa bahay ako, gumagana ang aircon, malamig dito.",
    staying: "Dito lang ako sa bahay. May bentilador at tubig ako.",
    needs_help_leaving: "Hindi na ako nagmamaneho. Kailangan ko ng masasakyan papunta sa cooling center.",
    needs_help_now: "Nahihilo ako, nalilito, at masakit ang ulo ko.",
    wants_check_in: "Mag-isa lang ako rito. Puwede bang may pumunta para silipin ako?",
    unclear: "Ano po? Sino ito?",
    linked: "Hindi, wala pa akong balita ngayong araw. Puwede bang may kumatok sa pinto?",
    eta: "Kailan darating ang sasakyan?",
  },
};

const heatLine = (h: Household, k: HeatLine) => HEAT_SAY[h.lang_code]?.[k] ?? HEAT_SAY["en-US"][k];

/** Heat check-in line: a resident (or a linked contact) call, played through the same tools as a real call. */
async function heatOutcome(call: Call, h: Household, plan: SimPlan, agentOpen: string) {
  const v = call.vars;
  const subject = call.subject_household_id ? await db().get("households", call.subject_household_id) : h;
  if (call.purpose === "linked_contact") {
    // Someone who lives alone did not answer twice: their linked contact has not heard from them, so a door knock.
    await appendTranscript(call.id, [
      { role: "agent", text: `${agentOpen} We're calling because ${v.subject_name} did not answer our heat check-in twice. Have you heard from them today, and can someone check on them in person soon?` },
      { role: "person", text: heatLine(h, "linked") },
    ]);
    await executeTool(call.id, "request_human", { reason: "distress", urgency: "soon", note: "door knock: lives alone, no answer twice; linked contact has not heard from them today" });
    return;
  }
  const p = plan.profile;
  const said = p === "leaving" || p === "already_left" || p === "staying" || p === "needs_help_leaving" || p === "needs_help_now" || p === "wants_check_in"
    ? heatLine(h, p)
    : heatLine(h, "unclear");
  await appendTranscript(call.id, [
    { role: "agent", text: `${agentOpen} ${v.directive_text} ${v.move_text} Can you stay cool right now? Do you need water, a ride to a cooling center, or someone to check on you?` },
    { role: "person", text: said },
  ]);
  const base = { understood: null, destination: null, people: 1, needs: [], device_battery_hours: null, animals: null, location_text: null,
    location_consent: true, can_leave: true, refusal_reason: null, memory_note: null };
  if (p === "leaving") {
    await executeTool(call.id, "record_status", { ...base, status: "leaving", destination: "a cooling center", understood: hash(call.id + "u") < 0.85 });
  } else if (p === "already_left") {
    await executeTool(call.id, "record_status", { ...base, status: "already_left", destination: "home, with air conditioning" });
  } else if (p === "staying") {
    await executeTool(call.id, "record_status", { ...base, status: "staying", refusal_reason: "prefers to stay home with a fan and water" });
  } else if (p === "needs_help_leaving") {
    // Needs a ride to a cooling center: registry priority 2, on a pickup run.
    const needs = [...new Set([...(subject?.afn_flags ?? []), "no_car"])];
    await executeTool(call.id, "record_status", { ...base, status: "needs_help_leaving", needs, can_leave: false, destination: "a cooling center" });
    await simLinkConsent(call, h);
    if (h.has_device && v.stage === "1") {
      await appendTranscript(call.id, [
        { role: "person", text: heatLine(h, "eta") },
        { role: "agent", text: "I can't answer that; a person will call you back." },
      ]);
      await executeTool(call.id, "request_human", { reason: "asked_unapproved", urgency: "soon", note: "asked when the ride will arrive (an ETA)" });
    }
  } else if (p === "needs_help_now") {
    // CDC heat-stroke warning signs: hang up and call 911 now comes first; a person is flagged (priority 1).
    await appendTranscript(call.id, [{ role: "agent", text: `Hang up and call ${v.emergency_number || "911"} now. A person from the response team is flagged.` }]);
    await executeTool(call.id, "record_status", { ...base, status: "needs_help_now", needs: subject?.afn_flags ?? [], can_leave: false });
    await executeTool(call.id, "request_human", { reason: "medical_emergency", urgency: "now", note: "heat-stroke warning signs: dizziness, confusion, headache" });
    await simLinkConsent(call, h);
  } else if (p === "wants_check_in") {
    // At home and wants a visit: a check-in visit is a helper (registry priority 3).
    await executeTool(call.id, "record_status", { ...base, status: "staying", refusal_reason: null });
    await executeTool(call.id, "request_human", { reason: "distress", urgency: "later", note: "wants a check-in visit" });
  } else {
    await executeTool(call.id, "record_status", { ...base, status: "unclear", can_leave: null, location_consent: null });
  }
}

/** Play out an answered simulated call through the shared tools, then end it. */
async function applyOutcome(call: Call, h: Household, plan: SimPlan, meta: Meta) {
  const v = call.vars;
  const heat = meta.mode === "heat";
  const agentOpen = heat
    ? `This is the heat check-in line, an automated AI voice, verification phrase ${v.verification_phrase}. Simulated call.`
    : `This is the city emergency information line, verification phrase ${v.verification_phrase}. Simulated call.`;
  const hazard = heat ? "Yes. It's very hot here; people are looking for shade." : meta.usgs_event ? "Yes, strong shaking. A wall is down on Pico." : "Yes. Smoke and a glow to the west.";
  switch (plan.profile) {
    case "sentinel_yes":
    case "sentinel_no":
    case "sentinel_unsure": {
      const sees = plan.profile === "sentinel_yes" ? "yes" : plan.profile === "sentinel_no" ? "no" : "unsure";
      const what = sees === "yes" ? hazard.replace(/^Yes\.?\s*/, "") : sees === "no" ? (heat ? "mild here" : "nothing here, all quiet") : heat ? "warm, hard to say" : "hard to tell, some haze";
      await appendTranscript(call.id, [
        { role: "agent", text: `${agentOpen} ${v.alert_text} Does this match what you see?` },
        { role: "person", text: sees === "yes" ? hazard : sees === "no" ? (heat ? "No. It's mild here." : "No. Nothing here.") : heat ? "Hard to say. It's warm." : "Not sure, there's some haze." },
      ]);
      await executeTool(call.id, "read_observation", { sees, what, direction: sees === "yes" && !heat ? "west" : null });
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
      if (heat) {
        await heatOutcome(call, h, plan, agentOpen);
        break;
      }
      const subject = call.subject_household_id ? await db().get("households", call.subject_household_id) : h;
      // Autopilot plays the demo's device beats too: Phone 2 asks for an ETA in Stage 1 (a refusal in the
      // ledger) and says "we can't leave" when the Order is relayed in Stage 3 (priority 1).
      const cantLeave = h.has_device && plan.profile === "needs_help_leaving" && v.stage === "3";
      const asksEta = h.has_device && plan.profile === "needs_help_leaving" && v.stage === "1";
      const p: SimProfile = cantLeave ? "needs_help_now" : plan.profile;
      const agentAsk = call.purpose === "linked_contact"
        ? `${agentOpen} We're calling because ${v.subject_name} did not answer. Have you heard from them?`
        : `${agentOpen} ${v.directive_text} ${v.move_text} Are you leaving, staying, or already gone?`;
      const said = call.purpose === "linked_contact" ? `Yes, ${v.subject_name} is leaving with me.`
        : cantLeave ? "We can't leave. We have no car and my husband uses a wheelchair."
        : line(h, p);
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
        await simLinkConsent(call, h);
        if (asksEta) {
          await appendTranscript(call.id, [
            { role: "person", text: "How long until the fire gets here?" },
            { role: "agent", text: "I can't answer that; a person will call you back." },
          ]);
          await executeTool(call.id, "request_human", { reason: "asked_unapproved", urgency: "soon", note: "asked how long until the fire arrives (an ETA)" });
        }
      } else if (p === "needs_help_now") {
        await executeTool(call.id, "record_status", { ...base, status: "needs_help_now", needs, can_leave: false, people: 2 });
        await executeTool(call.id, "request_human", { reason: "medical_emergency", urgency: "now", note: cantLeave ? "cannot leave: wheelchair, no car" : "trouble breathing" });
        await appendTranscript(call.id, [{ role: "agent", text: `Hang up and call ${v.emergency_number || "911"} now. A person from the response team is flagged.` }]);
        await simLinkConsent(call, h);
      } else {
        await executeTool(call.id, "record_status", { ...base, status: "unclear", can_leave: null, location_consent: null });
      }
      // Collections line: at Warning (Stage 1) only, someone with a collection on file asks for help moving it.
      const collection = call.purpose === "resident" && v.stage === "1" ? subject?.collection_note : null;
      if (collection && (p === "leaving" || p === "already_left" || p === "needs_help_leaving")) {
        await appendTranscript(call.id, [
          { role: "agent", text: "Do you need help moving the items on your list while there is still time?" },
          { role: "person", text: SALVAGE_LINE[h.lang_code] ?? SALVAGE_LINE["en-US"] },
        ]);
        await executeTool(call.id, "request_human", { reason: "salvage", urgency: "soon", note: collection });
      }
    }
  }
  await endCall(call.id, "completed");
}

const LINK_ASK = "Can I text you a link that shares your phone's live location with the response team? It stays on only until help reaches you.";

/** What a synthetic person says to the live-location question: a yes (their words become the consent quote) or a no. */
const LINK_ANSWER: Record<string, { yes: string; no: string }> = {
  "en-US": { yes: "Yes, send it.", no: "No, I'd rather not." },
  "es-US": { yes: "Sí, mándelo.", no: "No, prefiero que no." },
  "ko-KR": { yes: "네, 보내 주세요.", no: "아니요, 괜찮아요." },
  "zh-CN": { yes: "好的，发给我吧。", no: "不用了，谢谢。" },
  "hi-IN": { yes: "हाँ, भेज दीजिए।", no: "नहीं, रहने दीजिए।" },
  "fr-FR": { yes: "Oui, envoyez-le.", no: "Non, je préfère pas." },
  "hy-AM": { yes: "Այո, ուղարկեք:", no: "Ոչ, պետք չէ:" },
  "fil-PH": { yes: "Oo, ipadala mo.", no: "Huwag na po." },
};

/**
 * The live-location question, played through the same tool as a real call. Devices on autopilot that need help
 * (Phone 2: wheelchair, no car) say yes, so the demo shows a live pin; synthetic people say yes about 60% of the time.
 * Their pings are simulated by lib/engine/locate.ts (labeled synthetic).
 */
async function simLinkConsent(call: Call, h: Household) {
  if (!toolsForPurpose(call.purpose).includes("share_live_location")) return;
  if (await activeShareFor(h.id)) return; // asked once: a link is already on
  const yes = h.has_device ? true : hash(h.id + "gps") < 0.6;
  const words = LINK_ANSWER[h.lang_code] ?? LINK_ANSWER["en-US"];
  await appendTranscript(call.id, [{ role: "agent", text: LINK_ASK }, { role: "person", text: yes ? words.yes : words.no }]);
  if (yes) await executeTool(call.id, "share_live_location", { consent_quote: words.yes });
}

/** Collections line: what a synthetic collector says when asked about their grab list (Warning only). */
const SALVAGE_LINE: Record<string, string> = {
  "en-US": "Yes, please. The boxes on my list are by the front door.",
  "es-US": "Sí, por favor. Las cajas de mi lista están junto a la puerta.",
  "zh-CN": "需要，谢谢。清单上的两箱书放在书房门口。",
  "hi-IN": "हाँ, कृपया। सूची वाले डिब्बे दरवाज़े के पास रखे हैं।",
  "fr-FR": "Oui, s'il vous plaît. Les cartons de ma liste sont près de la porte.",
  "ko-KR": "네, 부탁드려요. 목록에 있는 상자는 현관 옆에 있어요.",
};

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
