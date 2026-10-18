// West Altadena (the Project Document's original roster), kept for the Eaton-fire framing and as a
// one-zone fallback. Synthetic, except the six device households.
import { DEMO_POLYGON, SEED_HOUSEHOLDS } from "@/lib/seedData";
import type { Household, SimProfile } from "@/lib/types";
import { assignZones, hid, inset, mkZones, person, type MovePresets, type ZoneSeed } from "./common";
import type { ScenarioBuild } from "./westside";

const PCC: [number, number] = [-118.1445, 34.1438];
const PCC_NAME = "Pasadena Convention Center, 300 East Green Street";

export const ALTADENA_PRESETS: MovePresets = {
  "ALT-W": {
    warning: { move_text: "If you leave, head south on Lincoln Avenue toward the Pasadena Convention Center.", evac_point: PCC_NAME, evac: PCC },
    order: { move_text: "Leave now. Head south on Lincoln Avenue toward the Pasadena Convention Center.", evac_point: PCC_NAME, evac: PCC },
  },
};

const ring = DEMO_POLYGON.coordinates[0].slice(0, -1).map((c) => [c[0], c[1]] as [number, number]);

const ZONES: ZoneSeed[] = [
  { id: "ALT-W", name: "West Altadena", coords: ring, state: "watch",
    directive_text: "Be aware. No action is required right now. We will call again if that changes.",
    move_text: null, evac_point: null, evac: null,
    fact_sheet: `${PCC_NAME} accepts pets in carriers. Demo scenario for a hackathon.`,
    population_est: 14_000, hazard_origin: [-118.135, 34.205] },
];

const PROFILES: SimProfile[] = ["leaving", "leaving", "already_left", "no_answer", "leaving", "needs_help_leaving", "staying", "leaving", "unclear", "leaving"];

export function buildAltadena(at: string, devicePhones: (string | null)[] = []): ScenarioBuild {
  const zones = mkZones("altadena", ZONES, "Duty officer (seed)", at);
  const households: Household[] = SEED_HOUSEHOLDS.map((h, i) => {
    const device = h.has_device;
    const n = Number(h.id.slice(-12));
    return {
      ...h,
      scenario: "altadena" as const,
      synthetic: !device,
      device_label: device ? `Phone ${n}` : null,
      phone_e164: device ? devicePhones[n - 1] ?? null : null,
      sim_profile: device ? "leaving" : h.afn_flags.length ? "needs_help_leaving" : PROFILES[i % PROFILES.length],
    };
  });
  const z = zones[0];
  const posts: Household[] = [0, 1, 2, 3].map((v) => {
    const [lng, lat] = inset(z.geom, v, 0.12);
    return person("altadena", { id: hid(100 + v), name: `Altadena post ${v + 1} (sentinel)`, lng, lat, role: "sentinel", on_post: true,
      sim_profile: v === 3 ? "silent" : "sentinel_yes" });
  });
  // Collections line (synthetic): a painter's studio archive inside the zone.
  const [sLng, sLat] = inset(z.geom, 0, 0.55);
  posts.push(person("altadena", { id: hid(95), name: "Altadena painter's studio (demo)", address: "West Altadena (demo)", lng: sLng, lat: sLat,
    sim_profile: "leaving", collection_note: "Forty years of canvases and sketchbooks; grab list: the flat files in the garage studio" }));
  posts.push(person("altadena", { id: hid(110), name: "Pasadena (canary)", lng: -118.1445, lat: 34.1478, role: "canary", sim_profile: "canary_no" }));
  return { zones, households: assignZones([...households, ...posts], zones), proposals: [], presets: ALTADENA_PRESETS };
}
