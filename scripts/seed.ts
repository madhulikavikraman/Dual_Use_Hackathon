// Seed 40 SYNTHETIC households. Usage: npm run seed
// Wipes campaigns (calls/status/alerts cascade) and households, then inserts fresh rows.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { SEED_HOUSEHOLDS } from "../lib/seedData";

config({ path: ".env.local" });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (put them in .env.local)");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const never = "00000000-0000-0000-0000-000000000000";
  for (const table of ["campaigns", "households"]) {
    const { error } = await db.from(table).delete().neq("id", never);
    if (error) throw new Error(`clear ${table}: ${error.message}`);
  }
  const { error } = await db.from("households").insert(SEED_HOUSEHOLDS);
  if (error) throw new Error(`insert households: ${error.message}`);

  const byLang = SEED_HOUSEHOLDS.reduce<Record<string, number>>((acc, h) => ((acc[h.language] = (acc[h.language] ?? 0) + 1), acc), {});
  console.log(`Seeded ${SEED_HOUSEHOLDS.length} synthetic households`);
  console.log("  languages:", byLang);
  console.log("  with AFN flags:", SEED_HOUSEHOLDS.filter((h) => h.afn_flags.length).length);
  console.log("  drivers:", SEED_HOUSEHOLDS.filter((h) => h.can_drive_neighbors).length);
  console.log("  linked contacts:", SEED_HOUSEHOLDS.filter((h) => h.linked_contact_name).length);
  console.log("  memory notes:", SEED_HOUSEHOLDS.filter((h) => h.memory_note).length);
  console.log("  devices:", SEED_HOUSEHOLDS.filter((h) => h.has_device).map((h) => `${h.name} (${h.lang_code})`).join(", "));
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
