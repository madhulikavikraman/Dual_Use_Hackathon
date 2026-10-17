// Live check of the Claude voice agent on the browser transport (real API calls, a few cents).
// Run: npx tsx --conditions=react-server scripts/agent-check.ts
// Uses its own data file, so the dev server is untouched.
import { config } from "dotenv";

config({ path: ".env.local" });
config();
process.env.SECONDKEY_DATA_FILE ??= ".data/agent-check.json";
process.env.STORAGE = "local";

async function main() {
  const { db } = await import("../lib/db");
  const { resetScenario } = await import("../lib/engine/reset");
  const { runTick } = await import("../lib/engine/tick");
  const { approveZone } = await import("../lib/engine/zones");
  const { phoneAction, phoneState } = await import("../lib/engine/phone");
  const { runPostCall } = await import("../lib/agent/postcall");
  const { hid } = await import("../lib/scenarios/common");

  await resetScenario("westside");
  const res = await approveZone("LA-CC", { state: "warning", directive_text: "", move_text: "", evac_point: "Westchester Recreation Center, 7000 West Manchester Avenue", approved_by: "Agent Check", reason: "test" });

  const talk = async (household: string, lines: string[]) => {
    for (let i = 0; i < 40; i++) {
      await phoneState(household); // presence heartbeat
      await runTick();
      const st = await phoneState(household);
      if (st.call?.state === "ringing") break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    const st = await phoneState(household);
    if (!st.call) throw new Error(`no call rang for ${household}`);
    const callId = st.call.id;
    let t = Date.now();
    let r = await phoneAction(household, { action: "answer", call_id: callId });
    console.log(`\n[${st.household.name}, ${st.household.language}]  (${Date.now() - t} ms)\n  AGENT: ${r.reply}`);
    for (const line of lines) {
      if (r.ended) break;
      console.log(`  PERSON: ${line}`);
      t = Date.now();
      r = await phoneAction(household, { action: "say", call_id: callId, text: line });
      console.log(`  AGENT (${Date.now() - t} ms): ${r.reply}${r.ended ? "  [ended]" : ""}`);
    }
    if (!r.ended) await phoneAction(household, { action: "hangup", call_id: callId });
    const reconciled = await runPostCall(callId);
    console.log(`  POST-CALL: ${reconciled?.primary_intent} (review ${reconciled?.review_needed}) — ${reconciled?.summary}`);
    return callId;
  };

  await talk(hid(1), [
    "Sí, me voy ahora con mis dos hijos.",
    "Vamos al centro de Westchester.",
    "Al Centro Recreativo de Westchester, antes de las cuatro y media.",
  ]);
  await talk(hid(2), [
    "My husband uses a wheelchair and we don't have a car.",
    "Yes, that's right. We're at Venice and Sepulveda right now, you can share that.",
    "How long until the fire gets here? Is it safe to stay a bit longer?",
    "Okay. Thank you.",
  ]);

  const help = await db().where("help_requests", { household_id: hid(2) });
  console.log(`\nRegistry for Phone 2: ${help.map((h) => `P${h.priority} ${h.reason} @ ${h.last_stated_text ?? h.last_source}`).join("; ") || "none"}`);
  const refusals = (await db().all("ledger")).filter((l) => l.kind === "refusal");
  console.log(`Refusals logged: ${refusals.map((l) => l.action).join("; ") || "none"}`);
  void res;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
