// USC DPS mode (the ordinary Tuesday, PRD section 16): campus buildings as zones, RAs and officers
// on post as sentinels, the campus vocabulary. All people are synthetic except the six devices.
import type { Household, SimProfile } from "@/lib/types";
import {
  EN, ES, FR, HI, KO, ZH, assignZones, hid, inset, mkZones, person, pointsIn, rng,
  type Lang, type MovePresets, type ZoneSeed,
} from "./common";
import type { ScenarioBuild } from "./westside";

const TOMMY: [number, number] = [-118.2854, 34.0206];
const TT = "Tommy Trojan assembly point, Trousdale Parkway";

export const USC_PRESETS: MovePresets = {
  "USC-LVL": {
    warning: { move_text: "Use routes that keep you away from Leavey Library.", evac_point: null, evac: null },
    order: { move_text: "Use the north exit to Trousdale Parkway and walk to the Tommy Trojan assembly point.", evac_point: TT, evac: TOMMY },
    shelter_in_place: { move_text: "Stay in a lockable room until DPS gives the all clear.", evac_point: null, evac: null },
  },
  "USC-DOH": {
    warning: { move_text: "Use routes that keep you away from Doheny Library.", evac_point: null, evac: null },
    order: { move_text: "Leave by the Trousdale Parkway doors and walk to the Tommy Trojan assembly point.", evac_point: TT, evac: TOMMY },
    shelter_in_place: { move_text: "Stay in a lockable room until DPS gives the all clear.", evac_point: null, evac: null },
  },
  "USC-VIL": {
    warning: { move_text: "Use Jefferson Boulevard crossings away from USC Village.", evac_point: null, evac: null },
    order: { move_text: "Leave USC Village by the Hoover Street side and walk to the Tommy Trojan assembly point.", evac_point: TT, evac: TOMMY },
    shelter_in_place: { move_text: "Stay in your room with the door locked until DPS gives the all clear.", evac_point: null, evac: null },
  },
  "USC-RW": {
    warning: { move_text: "Use routes that keep you away from Residential West.", evac_point: null, evac: null },
    order: { move_text: "Leave by the Exposition Boulevard side and walk to the Tommy Trojan assembly point.", evac_point: TT, evac: TOMMY },
    shelter_in_place: { move_text: "Stay in your room with the door locked until DPS gives the all clear.", evac_point: null, evac: null },
  },
  "USC-CORE": {
    warning: { move_text: "Avoid the University Park campus until further notice.", evac_point: null, evac: null },
    shelter_in_place: { move_text: "Stay in the nearest lockable room until DPS gives the all clear.", evac_point: null, evac: null },
  },
};

const NOTE = "Simulated campus scenario for a hackathon demonstration. DPS non-emergency line is the callback number.";

const ZONES: ZoneSeed[] = [
  { id: "USC-CORE", name: "University Park campus", coords: [[-118.2915, 34.0175], [-118.281, 34.0175], [-118.281, 34.0245], [-118.2915, 34.0245]],
    state: "monitor", directive_text: null, move_text: null, evac_point: null, evac: null, fact_sheet: NOTE, population_est: 8_000, hazard_origin: null },
  { id: "USC-LVL", name: "Leavey Library", coords: [[-118.2836, 34.0213], [-118.2822, 34.0213], [-118.2822, 34.0223], [-118.2836, 34.0223]],
    state: "monitor", directive_text: null, move_text: null, evac_point: null, evac: null, fact_sheet: NOTE, population_est: 600, hazard_origin: null },
  { id: "USC-DOH", name: "Doheny Library", coords: [[-118.2845, 34.0196], [-118.283, 34.0196], [-118.283, 34.0206], [-118.2845, 34.0206]],
    state: "monitor", directive_text: null, move_text: null, evac_point: null, evac: null, fact_sheet: NOTE, population_est: 300, hazard_origin: null },
  { id: "USC-VIL", name: "USC Village", coords: [[-118.288, 34.0248], [-118.283, 34.0248], [-118.283, 34.0272], [-118.288, 34.0272]],
    state: "monitor", directive_text: null, move_text: null, evac_point: null, evac: null, fact_sheet: NOTE, population_est: 2_700, hazard_origin: null },
  { id: "USC-RW", name: "Residential West", coords: [[-118.2925, 34.0172], [-118.2888, 34.0172], [-118.2888, 34.0203], [-118.2925, 34.0203]],
    state: "monitor", directive_text: null, move_text: null, evac_point: null, evac: null, fact_sheet: NOTE, population_est: 1_800, hazard_origin: null },
];

const NAMES: { name: string; lang: Lang }[] = [
  ["Ava Chen", ZH], ["Mateo Garcia", ES], ["Olivia Park", KO], ["Noah Williams", EN], ["Aarav Mehta", HI],
  ["Chloé Bernard", FR], ["Liam Johnson", EN], ["Isabella Rivera", ES], ["Ethan Zhou", ZH], ["Mia Thompson", EN],
  ["Diya Iyer", HI], ["Lucas Moreau", FR], ["Emma Davis", EN], ["Santiago Lopez", ES], ["Jisoo Han", KO],
  ["Harper Lee", EN], ["Arjun Nair", HI], ["Zoe Martin", EN], ["Camila Torres", ES], ["Ryan Wu", ZH],
  ["Grace Kim", KO], ["Leo Fontaine", FR], ["Ella Wright", EN], ["Diego Cruz", ES], ["Ananya Rao", HI],
].map(([name, lang]) => ({ name: name as string, lang: lang as Lang }));

const PROFILES: SimProfile[] = ["leaving", "already_left", "leaving", "no_answer", "leaving", "staying", "leaving", "unclear", "leaving", "leaving"];

export function buildUsc(at: string, devicePhones: (string | null)[] = []): ScenarioBuild {
  const r = rng(20261018);
  const zones = mkZones("usc", ZONES, "DPS watch commander (seed)", at);
  const z = (id: string) => zones.find((x) => x.id === id)!;
  const phone = (i: number) => devicePhones[i - 1] ?? null;
  const U = (over: Partial<Household> & Pick<Household, "id" | "name" | "lat" | "lng">) => person("usc", over);

  const devices: Household[] = [
    U({ id: hid(1), name: "Sofía Álvarez", address: "Leavey Library, 2nd floor (demo)", lng: -118.2831, lat: 34.0217, ...ES,
      has_device: true, device_label: "Phone 1", synthetic: false, phone_e164: phone(1), sim_profile: "leaving" }),
    U({ id: hid(2), name: "Ethan Brooks", address: "Residential West (demo)", lng: -118.2905, lat: 34.0188, ...EN,
      has_device: true, device_label: "Phone 2", synthetic: false, phone_e164: phone(2), sim_profile: "needs_help_leaving",
      afn_flags: ["walker"], memory_note: "On crutches after knee surgery." }),
    U({ id: hid(3), name: "Daniel Kim (RA)", address: "Leavey Library north desk (demo)", lng: -118.2824, lat: 34.0221, ...EN,
      has_device: true, device_label: "Phone 3", synthetic: false, phone_e164: phone(3), role: "sentinel", on_post: true, sim_profile: "sentinel_yes" }),
    U({ id: hid(4), name: "Officer Reyes (DPS)", address: "Leavey Library south entrance (demo)", lng: -118.2834, lat: 34.0214, ...EN,
      has_device: true, device_label: "Phone 4", synthetic: false, phone_e164: phone(4), role: "sentinel", on_post: true, sim_profile: "sentinel_yes" }),
    U({ id: hid(5), name: "Exposition Park sentinel", address: "Exposition Park (demo)", lng: -118.2878, lat: 34.0161, ...EN,
      has_device: true, device_label: "Phone 5 (judge)", synthetic: false, phone_e164: phone(5), role: "sentinel", on_post: true, sim_profile: "sentinel_no" }),
    U({ id: hid(6), name: "Figueroa canary", address: "Figueroa Corridor (demo)", lng: -118.275, lat: 34.03, ...EN,
      has_device: true, device_label: "Phone 6 (canary)", synthetic: false, phone_e164: phone(6), role: "canary", sim_profile: "canary_no" }),
  ];

  const synth: Household[] = [];
  let n = 7;
  let ix = 0;
  for (const [zoneId, count] of [["USC-LVL", 6], ["USC-DOH", 4], ["USC-VIL", 8], ["USC-RW", 7]] as const) {
    for (const [lng, lat] of pointsIn(z(zoneId).geom, count, r)) {
      const p = NAMES[ix % NAMES.length];
      synth.push(U({ id: hid(n++), name: p.name, ...p.lang, address: `${z(zoneId).name} (demo)`, lng, lat,
        sim_profile: PROFILES[ix % PROFILES.length] }));
      ix++;
    }
  }
  let s = 100;
  const post = (zoneId: string, vertex: number, label: string, profile: SimProfile) => {
    const [lng, lat] = inset(z(zoneId).geom, vertex, 0.15);
    synth.push(U({ id: hid(s++), name: label, address: `${z(zoneId).name} (demo)`, lng, lat, role: "sentinel", on_post: true, sim_profile: profile }));
  };
  post("USC-LVL", 2, "Leavey night desk (staff)", "sentinel_yes");
  post("USC-DOH", 0, "Doheny RA", "sentinel_yes");
  post("USC-DOH", 2, "Doheny security desk", "silent");
  post("USC-VIL", 0, "Village RA west", "sentinel_yes");
  post("USC-VIL", 2, "Village RA east", "sentinel_yes");
  post("USC-RW", 1, "Parkside RA", "sentinel_yes");
  post("USC-RW", 3, "Residential West front desk", "silent");
  for (const v of [0, 1, 2, 3]) post("USC-CORE", v, `DPS officer, post ${v + 1}`, "sentinel_no");

  return { zones, households: assignZones([...devices, ...synth], zones), proposals: [], presets: USC_PRESETS };
}
