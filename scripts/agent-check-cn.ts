// Twist 2 proof: a live Claude call in Mandarin on the Chongqing scenario (real API calls, a few cents).
// Run: npx tsx --conditions=react-server scripts/agent-check-cn.ts   (uses its own data file)
import { config } from "dotenv";

config({ path: ".env.local" });
config();
process.env.SECONDKEY_DATA_FILE ??= ".data/agent-check-cn.json";
process.env.STORAGE = "local";

async function main() {
  const { db } = await import("../lib/db");
  const { resetScenario } = await import("../lib/engine/reset");
  const { runTick } = await import("../lib/engine/tick");
  const { approveZone } = await import("../lib/engine/zones");
  const { phoneAction, phoneState } = await import("../lib/engine/phone");
  const { hid } = await import("../lib/scenarios/common");

  await resetScenario("chongqing");
  await approveZone("CQ-TS", { state: "warning", approved_by: "北碚区值班领导 (check)", reason: "toy model envelope" });
  const household = hid(2); // 王建国: wife uses a wheelchair, no car
  for (let i = 0; i < 60; i++) {
    await phoneState(household);
    await runTick();
    if ((await phoneState(household)).call?.state === "ringing") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const st = await phoneState(household);
  if (!st.call) throw new Error("no call rang");
  let r = await phoneAction(household, { action: "answer", call_id: st.call.id });
  console.log(`AGENT: ${r.reply}`);
  for (const line of ["我老伴坐轮椅，我们家没有车，走不了。", "对，我们现在在天生街道家里，可以把位置告诉救援人员。", "她现在喘不上气了。"]) {
    if (r.ended) break;
    console.log(`PERSON: ${line}`);
    r = await phoneAction(household, { action: "say", call_id: st.call.id, text: line });
    console.log(`AGENT: ${r.reply}${r.ended ? "  [ended]" : ""}`);
  }
  const help = await db().where("help_requests", { household_id: household });
  console.log(`\nRegistry: ${help.map((h) => `P${h.priority} ${h.reason}`).join("; ") || "none"}`);
  const ledger = (await db().all("ledger")).filter((l) => l.actor === "agent").map((l) => l.action);
  console.log(`Agent ledger: ${ledger.join("; ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
