// Load a scenario into the running app (local store or Supabase, whichever the server uses).
// Usage: npm run seed [westside|heat|altadena|norte|chongqing]   (the dev server must be running)
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const scenario = process.argv[2] ?? "westside";
const base = process.env.SEED_BASE_URL ?? "http://localhost:3000";

async function main() {
  const res = await fetch(`${base}/api/demo/reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenario }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  console.log(`Loaded ${data.scenario}: ${data.zones} zones, ${data.households} people (${data.devices} volunteer devices), ${data.proposals} model proposals`);
}

main().catch((e) => {
  console.error(`Seed failed: ${e.message ?? e}. Is the dev server running at ${base}?`);
  process.exit(1);
});
