// Westside Fire (synthetic), PRD section 5. 3:40 AM: a wind-driven fire in Santa Monica pushed east
// along the I-10 corridor. Geography is stylized for the demo; shelters and routes are demo choices.
import { directiveFor } from "@/lib/directives";
import type { Household, Need, Proposal, SimProfile, Zone } from "@/lib/types";
import {
  EN, ES, FR, HI, HY, KO, TL, ZH, assignZones, hid, inset, mkZones, person, pointsIn, poly, rng,
  type Lang, type MovePresets, type ZoneSeed,
} from "./common";

const WESTCHESTER: [number, number] = [-118.418, 33.9597];
const JESSE_OWENS: [number, number] = [-118.3086, 33.9471];
const EXPO_PARK: [number, number] = [-118.2878, 34.0161];
const WRC = "Westchester Recreation Center, 7000 West Manchester Avenue";
const JOP = "Jesse Owens Community Regional Park, 9651 South Western Avenue";
const EXP = "Exposition Park, 700 Exposition Park Drive";

const DEMO_NOTE = "This is a simulated scenario for a hackathon demonstration; shelters and routes are demo choices.";

export const WESTSIDE_PRESETS: MovePresets = {
  "LA-SM": {
    warning: { move_text: "If you need extra time or have pets, leave now. Move south on Lincoln Boulevard toward Westchester.", evac_point: WRC, evac: WESTCHESTER },
    order: { move_text: "Leave now. Move south on Lincoln Boulevard toward Playa Vista. Avoid the 10 Freeway eastbound.", evac_point: WRC, evac: WESTCHESTER },
  },
  "LA-VN": {
    warning: { move_text: "If you need extra time or have pets, leave now. Head south toward Westchester.", evac_point: WRC, evac: WESTCHESTER },
    order: { move_text: "Leave now. Head south on Lincoln Boulevard toward Westchester.", evac_point: WRC, evac: WESTCHESTER },
  },
  "LA-WL": {
    warning: { move_text: "If you leave, take Sepulveda Boulevard south, then go east toward Jesse Owens Community Regional Park.", evac_point: JOP, evac: JESSE_OWENS },
    order: { move_text: "Leave now. Take Sepulveda Boulevard south, then go east toward Jesse Owens Community Regional Park.", evac_point: JOP, evac: JESSE_OWENS },
  },
  "LA-CC": {
    warning: { move_text: "If you leave, head south on Sepulveda Boulevard or La Cienega Boulevard toward the evacuation point at Westchester Recreation Center.", evac_point: WRC, evac: WESTCHESTER },
    order: { move_text: "Leave now. Head south on Sepulveda Boulevard or La Cienega Boulevard toward Westchester Recreation Center.", evac_point: WRC, evac: WESTCHESTER },
  },
  "LA-MC": {
    warning: { move_text: "If you leave, head south on Crenshaw Boulevard toward Jesse Owens Community Regional Park.", evac_point: JOP, evac: JESSE_OWENS },
    order: { move_text: "Leave now. Head south on Crenshaw Boulevard toward Jesse Owens Community Regional Park.", evac_point: JOP, evac: JESSE_OWENS },
    shelter_in_place: { move_text: "Stay where you are unless your building is damaged. If it is damaged, go to an open area away from buildings.", evac_point: null, evac: null },
  },
  "LA-KT": {
    warning: { move_text: "If you leave, head south on Vermont Avenue toward Exposition Park.", evac_point: EXP, evac: EXPO_PARK },
    order: { move_text: "Leave now. Head south on Vermont Avenue toward Exposition Park.", evac_point: EXP, evac: EXPO_PARK },
    shelter_in_place: { move_text: "Stay where you are unless your building is damaged. If it is damaged, go to an open area away from buildings.", evac_point: null, evac: null },
  },
  "LA-DT": {
    warning: { move_text: "If you leave, head south on Figueroa Street toward Exposition Park.", evac_point: EXP, evac: EXPO_PARK },
    order: { move_text: "Leave now. Head south on Figueroa Street toward Exposition Park.", evac_point: EXP, evac: EXPO_PARK },
    shelter_in_place: { move_text: "Stay where you are unless your building is damaged.", evac_point: null, evac: null },
  },
};

const fact = (shelter: string | null) =>
  `${shelter ? `${shelter} accepts small pets in carriers; for large animals, ask for a call back. ` : ""}No road closures have been announced. ${DEMO_NOTE}`;

const ZONES: ZoneSeed[] = [
  {
    id: "LA-SM", name: "Santa Monica",
    coords: [[-118.516, 34.037], [-118.496, 34.052], [-118.472, 34.049], [-118.444, 34.033], [-118.454, 34.0125], [-118.46, 34.0], [-118.483, 33.999], [-118.4925, 34.006], [-118.504, 34.02]],
    state: "order", directive_text: directiveFor("order", "civilian", "Santa Monica"),
    move_text: WESTSIDE_PRESETS["LA-SM"].order!.move_text, evac_point: WRC, evac: WESTCHESTER,
    fact_sheet: fact(WRC), population_est: 93_000, hazard_origin: [-118.505, 34.065],
  },
  {
    id: "LA-VN", name: "Venice and Mar Vista",
    coords: [[-118.483, 33.999], [-118.46, 34.0], [-118.454, 34.0125], [-118.444, 34.011], [-118.426, 34.015], [-118.418, 33.993], [-118.444, 33.978], [-118.47, 33.98], [-118.48, 33.986]],
    state: "warning", directive_text: directiveFor("warning", "civilian", "Venice and Mar Vista"),
    move_text: WESTSIDE_PRESETS["LA-VN"].warning!.move_text, evac_point: WRC, evac: WESTCHESTER,
    fact_sheet: fact(WRC), population_est: 75_000, hazard_origin: [-118.49, 34.02],
  },
  {
    id: "LA-WL", name: "West LA and Sawtelle",
    coords: [[-118.444, 34.033], [-118.45, 34.056], [-118.428, 34.06], [-118.406, 34.045], [-118.408, 34.029], [-118.426, 34.015], [-118.444, 34.011], [-118.454, 34.0125]],
    state: "watch", directive_text: directiveFor("watch", "civilian", "West LA and Sawtelle"),
    move_text: null, evac_point: null, evac: null,
    fact_sheet: fact(JOP), population_est: 62_000, hazard_origin: [-118.47, 34.035],
  },
  {
    id: "LA-CC", name: "Culver City and Palms",
    coords: [[-118.426, 34.015], [-118.408, 34.029], [-118.388, 34.035], [-118.369, 34.027], [-118.372, 34.005], [-118.388, 33.983], [-118.405, 33.98], [-118.418, 33.993]],
    state: "watch", directive_text: directiveFor("watch", "civilian", "Culver City and Palms"),
    move_text: null, evac_point: null, evac: null,
    fact_sheet: fact(WRC), population_est: 41_000, hazard_origin: [-118.44, 34.03],
  },
  {
    id: "LA-MC", name: "Mid-City and West Adams",
    coords: [[-118.388, 34.035], [-118.376, 34.048], [-118.34, 34.062], [-118.308, 34.049], [-118.31, 34.023], [-118.35, 34.018], [-118.369, 34.027]],
    state: "watch", directive_text: directiveFor("watch", "civilian", "Mid-City and West Adams"),
    move_text: null, evac_point: null, evac: null,
    fact_sheet: fact(JOP), population_est: 118_000, hazard_origin: [-118.4, 34.035],
  },
  {
    id: "LA-KT", name: "Koreatown and Pico-Union",
    coords: [[-118.308, 34.049], [-118.309, 34.076], [-118.285, 34.077], [-118.27, 34.062], [-118.268, 34.045], [-118.283, 34.04], [-118.31, 34.042]],
    state: "watch", directive_text: directiveFor("watch", "civilian", "Koreatown and Pico-Union"),
    move_text: null, evac_point: null, evac: null,
    fact_sheet: fact(EXP), population_est: 165_000, hazard_origin: [-118.33, 34.055],
  },
  {
    id: "LA-DT", name: "Downtown Los Angeles",
    coords: [[-118.268, 34.045], [-118.27, 34.062], [-118.245, 34.068], [-118.23, 34.056], [-118.235, 34.033], [-118.26, 34.03], [-118.27, 34.038]],
    state: "monitor", directive_text: null, move_text: null, evac_point: null, evac: null,
    fact_sheet: fact(EXP), population_est: 87_000, hazard_origin: [-118.29, 34.05],
  },
];

/** A deliberately wrong, countywide polygon (the January 9 failure), for the hold demo. */
export const COUNTYWIDE_POLYGON: GeoJSON.Polygon = poly([
  [-118.95, 34.82], [-117.65, 34.82], [-117.65, 34.1], [-117.8, 33.95], [-118.1, 33.75], [-118.3, 33.7],
  [-118.42, 33.77], [-118.52, 33.98], [-118.52, 34.03], [-118.8, 34.0], [-118.95, 34.05],
]);
export const COUNTYWIDE_POPULATION = 9_800_000; // estimate, Los Angeles County

const NAMES: { name: string; lang: Lang }[] = [
  ["James Porter", EN], ["Guadalupe Torres", ES], ["Priya Raman", HI], ["Luis Hernández", ES], ["Kim Soo-ah", KO],
  ["Michael Brooks", EN], ["Camille Laurent", FR], ["Li Na", ZH], ["Susan Park", EN], ["Miguel Ortega", ES],
  ["Anahit Sargsyan", HY], ["Rajesh Kumar", HI], ["Rosa Medina", ES], ["Chen Hao", ZH], ["Thomas Reed", EN],
  ["Francisco Vargas", ES], ["Maricel Reyes", TL], ["Nancy Ellis", EN], ["Élodie Martin", FR], ["Brian Foster", EN],
  ["Jorge Mendoza", ES], ["Gloria Washington", EN], ["Park Ji-hoon", KO], ["Anjali Sharma", HI], ["Kevin Shaw", EN],
  ["Hovik Grigoryan", HY], ["Patricia Lane", EN], ["Ricardo Salinas", ES], ["Jean-Pierre Dubois", FR], ["Wang Fang", ZH],
  ["Steven Grant", EN], ["Denise Harper", EN], ["Paul Navarro", ES], ["Sunita Patel", HI], ["David Kim-Lewis", EN],
  ["Lee Min-jung", KO], ["Arturo Ruiz", ES], ["Mei Lin", ZH], ["Joy Perez", TL], ["Amélie Girard", FR],
  ["Oscar Delgado", ES], ["Frank Liu", ZH], ["Vikram Singh", HI], ["Héctor Ramos", ES], ["Sarah Cohen", EN],
  ["Nina Avetisyan", HY], ["Tom Bradley Jr.", EN], ["Lourdes Peña", ES], ["Grace Yoon", KO], ["Victor Cruz", ES],
].map(([name, lang]) => ({ name: name as string, lang: lang as Lang }));

const MAIN_PROFILES: SimProfile[] = [
  "leaving", "leaving", "already_left", "leaving", "no_answer", "leaving", "staying", "leaving", "unclear", "leaving",
  "needs_help_leaving", "leaving", "already_left", "voicemail", "leaving", "leaving", "no_answer", "leaving", "staying", "leaving",
  "already_left", "leaving", "needs_help_leaving", "leaving", "no_answer", "leaving", "leaving", "needs_help_now", "leaving", "already_left",
];

const MAIN_EXTRAS: Record<number, Partial<Household>> = {
  10: { afn_flags: ["wheelchair"], memory_note: "Power wheelchair; ramp at the side door." },
  22: { afn_flags: ["oxygen", "no_car"], memory_note: "Home oxygen concentrator. Lives alone with a small dog." },
  27: { afn_flags: ["bedbound"], memory_note: "Bedbound; home health aide weekdays 9 to 1.", linked_contact_name: "Aide, Joy Perez" },
  3: { can_drive_neighbors: true, seats: 4 },
  14: { can_drive_neighbors: true, seats: 3, memory_note: "Has a minivan." },
  19: { can_drive_neighbors: true, seats: 2 },
  5: { memory_note: "Has three dogs." },
  25: { memory_note: "Works nights; prefers calls after 9 am." },
  12: { afn_flags: ["dialysis"], memory_note: "Dialysis Tuesday, Thursday, Saturday." },
};

export interface ScenarioBuild {
  zones: Zone[];
  households: Household[];
  proposals: Proposal[];
  presets: MovePresets;
}

export function buildWestside(at: string, devicePhones: (string | null)[] = []): ScenarioBuild {
  const r = rng(20261017);
  const zones = mkZones("westside", ZONES, "Duty officer (seed)", at);
  const z = (id: string) => zones.find((x) => x.id === id)!;
  const cc = z("LA-CC").geom;
  const phone = (i: number) => devicePhones[i - 1] ?? null;
  const W = (over: Partial<Household> & Pick<Household, "id" | "name" | "lat" | "lng">) => person("westside", over);

  // The six volunteer devices (real phones in the room play these people).
  const devices: Household[] = [
    W({ id: hid(1), name: "Lucía Romero", address: "3640 Motor Ave (demo)", lng: -118.411, lat: 34.0205, ...ES,
      has_device: true, device_label: "Phone 1", synthetic: false, phone_e164: phone(1), sim_profile: "leaving",
      can_drive_neighbors: true, seats: 2, memory_note: "Two kids, 8 and 11. Drives a sedan. Checks on her neighbor Walter Hale." }),
    W({ id: hid(2), name: "Janet Moore", address: "10850 Venice Blvd (demo)", lng: -118.4135, lat: 34.0125, ...EN,
      has_device: true, device_label: "Phone 2", synthetic: false, phone_e164: phone(2), sim_profile: "needs_help_leaving",
      afn_flags: ["wheelchair", "no_car"], memory_note: "Husband Frank uses a power wheelchair. No car since August." }),
    W({ id: hid(3), name: "Marcus Bell", address: "Culver City east edge (demo)", lng: -118.3745, lat: 34.02, ...EN,
      has_device: true, device_label: "Phone 3", synthetic: false, phone_e164: phone(3), role: "sentinel", on_post: true,
      sim_profile: "sentinel_yes", memory_note: "Building manager; enrolled sentinel." }),
    W({ id: hid(4), name: "Priya Shah", address: "Culver City south edge (demo)", lng: -118.396, lat: 33.987, ...EN,
      has_device: true, device_label: "Phone 4", synthetic: false, phone_e164: phone(4), role: "sentinel", on_post: true,
      sim_profile: "sentinel_yes", memory_note: "Night nurse; enrolled sentinel." }),
    W({ id: hid(5), name: "Long Beach sentinel", address: "Long Beach (demo)", lng: -118.1937, lat: 33.7701, ...EN,
      has_device: true, device_label: "Phone 5 (judge)", synthetic: false, phone_e164: phone(5), role: "sentinel", on_post: true,
      sim_profile: "sentinel_no", memory_note: "Enrolled sentinel in Long Beach." }),
    W({ id: hid(6), name: "Sam Ortiz", address: "Westchester (demo)", lng: -118.4004, lat: 33.9594, ...EN,
      has_device: true, device_label: "Phone 6 (canary)", synthetic: false, phone_e164: phone(6), role: "canary",
      sim_profile: "canary_no", memory_note: "Enrolled canary just outside the zones." }),
  ];

  const synth: Household[] = [];
  // Walter Hale: does not answer; his linked contact is Phone 1 (demo beat at 1:15).
  synth.push(W({ id: hid(7), name: "Walter Hale", address: "3655 Motor Ave (demo)", lng: -118.41, lat: 34.0195, ...EN,
    afn_flags: ["walker", "no_car"], memory_note: "Lives alone. Uses a walker.", sim_profile: "no_answer",
    linked_contact_household_id: hid(1), linked_contact_name: "Lucía Romero (neighbor)" }));

  // Tower block in Palms: the tower_down preset silences this tight cluster.
  let n = 8;
  let nameIx = 0;
  for (let i = 0; i < 10; i++) {
    const p = NAMES[nameIx++ % NAMES.length];
    synth.push(W({ id: hid(n++), name: p.name, ...p.lang, address: `${3300 + i * 12} Overland Ave (demo)`,
      lng: +(-118.4045 + (r() - 0.5) * 0.0014).toFixed(6), lat: +(34.0272 + (r() - 0.5) * 0.0010).toFixed(6),
      sim_profile: i % 4 === 0 ? "already_left" : "leaving" }));
  }
  // Main roster across Culver City and Palms.
  const pts = pointsIn(cc, MAIN_PROFILES.length, r);
  pts.forEach(([lng, lat], i) => {
    const p = NAMES[nameIx++ % NAMES.length];
    const extra = MAIN_EXTRAS[i] ?? {};
    synth.push(W({ id: hid(n++), name: p.name, ...p.lang, address: `${10000 + Math.floor(r() * 900)} block (demo)`,
      lng, lat, sim_profile: MAIN_PROFILES[i], ...extra, afn_flags: (extra.afn_flags ?? []) as Need[] }));
  });
  // A few in Venice and Mar Vista, West LA, and Mid-City (earthquake beat).
  for (const [zoneId, count, profile] of [["LA-VN", 6, "leaving"], ["LA-WL", 4, "leaving"], ["LA-MC", 6, "leaving"]] as const) {
    for (const [lng, lat] of pointsIn(z(zoneId).geom, count, r)) {
      const p = NAMES[nameIx++ % NAMES.length];
      synth.push(W({ id: hid(n++), name: p.name, ...p.lang, address: "(demo)", lng, lat, sim_profile: profile as SimProfile }));
    }
  }

  // Collections line (synthetic): enrolled holders of things that cannot be replaced. Fixed points, so the seeded
  // layout of everyone else does not move.
  synth.push(W({ id: hid(95), name: "Marisol Vega", ...ES, address: "Palms (demo)", lng: -118.4, lat: 34.012, sim_profile: "leaving",
    collection_note: "Her late father's paintings (about 30 framed works) and two boxes of family letters and negatives; grab list by the front door" }));
  synth.push(W({ id: hid(96), name: "Palms neighborhood history archive (demo)", address: "Culver City (demo)", lng: -118.385, lat: 34.02, sim_profile: "leaving",
    collection_note: "Oral-history tapes, photographs and maps from the 1920s on; three archival boxes on the grab list, shelf A" }));

  // Synthetic enrolled sentinels near each zone's corners (independent reads).
  let s = 100;
  const sentinel = (zoneId: string, vertex: number, profile: SimProfile, label: string) => {
    const [lng, lat] = inset(z(zoneId).geom, vertex, 0.2);
    synth.push(W({ id: hid(s++), name: `${label} (sentinel)`, address: `${z(zoneId).name} (demo)`, lng, lat,
      role: "sentinel", on_post: true, sim_profile: profile }));
  };
  sentinel("LA-CC", 0, "sentinel_yes", "Palms RA desk");
  sentinel("LA-CC", 2, "sentinel_yes", "Culver City fire station 2");
  for (const v of [1, 3, 5, 7]) sentinel("LA-SM", v, "sentinel_yes", `Santa Monica post ${v}`);
  for (const v of [2, 5, 7]) sentinel("LA-VN", v, "sentinel_yes", `Venice post ${v}`);
  sentinel("LA-WL", 1, "sentinel_yes", "Sawtelle post");
  sentinel("LA-WL", 3, "silent", "West LA post");
  sentinel("LA-WL", 6, "sentinel_unsure", "Mar Vista border post");
  sentinel("LA-MC", 1, "sentinel_yes", "Mid-City post north");
  sentinel("LA-MC", 3, "sentinel_yes", "West Adams post");
  sentinel("LA-MC", 5, "sentinel_yes", "Pico Blvd post");
  sentinel("LA-KT", 1, "sentinel_no", "Koreatown post");
  sentinel("LA-KT", 3, "silent", "Pico-Union post");
  sentinel("LA-DT", 1, "sentinel_no", "Downtown post");
  sentinel("LA-DT", 4, "silent", "Arts District post");
  // Countywide extremes (only matter when a wrong, countywide polygon is composed).
  synth.push(W({ id: hid(s++), name: "Lancaster (sentinel)", lng: -118.1542, lat: 34.6868, role: "sentinel", on_post: true, sim_profile: "sentinel_no" }));
  synth.push(W({ id: hid(s++), name: "Malibu (sentinel)", lng: -118.7798, lat: 34.0259, role: "sentinel", on_post: true, sim_profile: "silent" }));
  synth.push(W({ id: hid(s++), name: "Pomona (sentinel)", lng: -117.75, lat: 34.0551, role: "sentinel", on_post: true, sim_profile: "sentinel_no" }));
  // A second canary outside the zones.
  synth.push(W({ id: hid(s++), name: "Inglewood (canary)", lng: -118.3531, lat: 33.9617, role: "canary", sim_profile: "canary_no" }));

  const households = assignZones([...devices, ...synth], zones);

  const proposal = (zone_id: string, reason: string, score: number): Proposal => ({
    id: crypto.randomUUID(), zone_id, proposed_state: "warning", model: "fire_envelope", reason, score,
    envelope: null, status: "open", decided_by: null, decided_at: null, decision_reason: null, created_at: at,
  });
  const proposals = [
    proposal("LA-CC", "Toy fire model: the 3-hour envelope (offshore wind from the west-northwest, about 20 mph) reaches the north-west edge of Culver City and Palms.", 0.74),
    proposal("LA-WL", "Toy fire model: the 3-hour envelope crosses Centinela Avenue into West LA and Sawtelle.", 0.68),
  ];
  return { zones, households, proposals, presets: WESTSIDE_PRESETS };
}
