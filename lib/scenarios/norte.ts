// Norte Fire, San Clemente (Orange County), the fire burning on demo weekend. The ignition point and name are real
// (CAL FIRE incident list: "Portico Del Norte & Eminencia Del Norte, San Clemente", Orange County Fire Authority,
// started Oct 16, 2026, 11:33 AM PT); a reset pulls its live status and the NWS alerts into the feed (lib/engine/live.ts).
// Everything else is simulated: zone shapes are rough neighborhood outlines, zone states are NOT the real orders
// (check OCFA and Genasys Protect for those), and every resident is synthetic except the six volunteer phones.
import { directiveFor } from "@/lib/directives";
import type { Household, Proposal, SimProfile } from "@/lib/types";
import {
  EN, ES, KO, ZH, assignZones, hid, inset, mkZones, person, pointsIn, poly, rng,
  type Lang, type MovePresets, type ZoneSeed,
} from "./common";
import type { ScenarioBuild } from "./westside";

/** The real ignition point (CAL FIRE incident list). */
export const NORTE_ORIGIN: [number, number] = [-117.63618, 33.4813];
const SHELTER: [number, number] = [-117.6119, 33.4268];
const SHELTER_NAME = "San Clemente Community Center, 100 North Calle Seville (demo choice)";
const NOTE =
  "Demo scenario on the real Norte Fire location for a hackathon. Zone states, routes and residents are demo data; real orders come from OCFA and the county.";

export const NORTE_PRESETS: MovePresets = {
  "NOR-TA": {
    warning: { move_text: "If you leave, go south on Avenida Pico toward the coast, away from the hills to the north-west.", evac_point: SHELTER_NAME, evac: SHELTER },
    order: { move_text: "Leave now. Go south on Avenida Pico toward the coast. Do not drive toward Forster Ranch.", evac_point: SHELTER_NAME, evac: SHELTER },
  },
  "NOR-RS": {
    warning: { move_text: "If you leave, go south toward the coast on Avenida Pico.", evac_point: SHELTER_NAME, evac: SHELTER },
    order: { move_text: "Leave now. Go south toward the coast on Avenida Pico.", evac_point: SHELTER_NAME, evac: SHELTER },
  },
  "NOR-FR": {
    order: { move_text: "Leave now. Go south on Camino Vera Cruz, then Avenida Pico, toward the coast.", evac_point: SHELTER_NAME, evac: SHELTER },
  },
  "NOR-MS": {
    warning: { move_text: "If you leave, go south on El Camino Real toward the shelter.", evac_point: SHELTER_NAME, evac: SHELTER },
  },
};

const ZONES: ZoneSeed[] = [
  { id: "NOR-FR", name: "Forster Ranch (near the ignition point)",
    coords: [[-117.655, 33.495], [-117.625, 33.497], [-117.618, 33.475], [-117.632, 33.462], [-117.655, 33.468]],
    state: "order", directive_text: directiveFor("order", "civilian", "Forster Ranch"), move_text: NORTE_PRESETS["NOR-FR"].order!.move_text, evac_point: SHELTER_NAME, evac: SHELTER,
    fact_sheet: NOTE, population_est: 12_000, hazard_origin: NORTE_ORIGIN },
  { id: "NOR-TA", name: "Talega",
    coords: [[-117.625, 33.497], [-117.585, 33.505], [-117.575, 33.48], [-117.6, 33.468], [-117.618, 33.475]],
    state: "watch", directive_text: directiveFor("watch", "civilian", "Talega"), move_text: null, evac_point: null, evac: null,
    fact_sheet: NOTE, population_est: 9_000, hazard_origin: NORTE_ORIGIN },
  { id: "NOR-RS", name: "Rancho San Clemente",
    coords: [[-117.632, 33.462], [-117.618, 33.475], [-117.6, 33.468], [-117.595, 33.448], [-117.625, 33.445]],
    state: "watch", directive_text: directiveFor("watch", "civilian", "Rancho San Clemente"), move_text: null, evac_point: null, evac: null,
    fact_sheet: NOTE, population_est: 7_000, hazard_origin: NORTE_ORIGIN },
  { id: "NOR-MS", name: "Marblehead and Shorecliffs",
    coords: [[-117.68, 33.47], [-117.655, 33.468], [-117.632, 33.462], [-117.625, 33.445], [-117.645, 33.437], [-117.675, 33.452]],
    state: "watch", directive_text: directiveFor("watch", "civilian", "Marblehead and Shorecliffs"), move_text: null, evac_point: null, evac: null,
    fact_sheet: NOTE, population_est: 8_000, hazard_origin: NORTE_ORIGIN },
  { id: "NOR-RMV", name: "Rancho Mission Viejo",
    coords: [[-117.66, 33.535], [-117.6, 33.54], [-117.585, 33.505], [-117.625, 33.497], [-117.655, 33.495]],
    state: "monitor", directive_text: null, move_text: null, evac_point: null, evac: null,
    fact_sheet: NOTE, population_est: 15_000, hazard_origin: NORTE_ORIGIN },
];

/** The wrong polygon for this scenario: all of Orange County instead of a few San Clemente neighborhoods. */
export const ORANGE_COUNTY_POLYGON: GeoJSON.Polygon = poly([[-118.12, 33.95], [-117.41, 33.95], [-117.41, 33.38], [-118.12, 33.38]]);
export const ORANGE_COUNTY_POPULATION = 3_190_000; // about 3.19 million (2020 census), rounded

const NAMES: { name: string; lang: Lang }[] = [
  ["Megan Doyle", EN], ["Carlos Medina", ES], ["Brian Walsh", EN], ["Rosa Castillo", ES], ["Jennifer Park", KO],
  ["Tom Hughes", EN], ["Alejandra Ruiz", ES], ["Kevin Chen", ZH], ["Linda Foster", EN], ["Miguel Torres", ES],
  ["Sarah Collins", EN], ["Daniel Nguyen", EN], ["Patricia Gomez", ES], ["Steven Wright", EN], ["Emily Brooks", EN],
  ["Jorge Salazar", ES], ["Michelle Kang", KO], ["Ryan Murphy", EN], ["Lucia Herrera", ES], ["Gary Mitchell", EN],
].map(([name, lang]) => ({ name: name as string, lang: lang as Lang }));

const PROFILES: SimProfile[] = [
  "leaving", "leaving", "already_left", "leaving", "no_answer", "leaving", "staying", "leaving", "unclear", "leaving",
  "needs_help_leaving", "leaving", "already_left", "voicemail", "leaving", "leaving", "no_answer", "leaving", "needs_help_now", "leaving",
];

export function buildNorte(at: string, devicePhones: (string | null)[] = []): ScenarioBuild {
  const r = rng(20261016);
  const zones = mkZones("norte", ZONES, "Duty officer (seed)", at);
  const z = (id: string) => zones.find((x) => x.id === id)!;
  const phone = (i: number) => devicePhones[i - 1] ?? null;
  const N = (over: Partial<Household> & Pick<Household, "id" | "name" | "lat" | "lng">) => person("norte", over);

  const devices: Household[] = [
    N({ id: hid(1), name: "Ana Morales", address: "Talega (demo)", lng: -117.603, lat: 33.484, ...ES,
      has_device: true, device_label: "Phone 1", synthetic: false, phone_e164: phone(1), sim_profile: "leaving",
      can_drive_neighbors: true, seats: 2, memory_note: "Two children; one car. Checks on her neighbor Harold." }),
    N({ id: hid(2), name: "Robert Lee", address: "Talega (demo)", lng: -117.598, lat: 33.479, ...EN,
      has_device: true, device_label: "Phone 2", synthetic: false, phone_e164: phone(2), sim_profile: "needs_help_leaving",
      afn_flags: ["wheelchair", "no_car"], memory_note: "His wife uses a wheelchair; no car." }),
    N({ id: hid(3), name: "Talega north edge (CERT sentinel)", address: "Talega (demo)", lng: -117.6, lat: 33.499, ...EN,
      has_device: true, device_label: "Phone 3", synthetic: false, phone_e164: phone(3), role: "sentinel", on_post: true, sim_profile: "sentinel_yes" }),
    N({ id: hid(4), name: "Talega west edge (CERT sentinel)", address: "Talega (demo)", lng: -117.616, lat: 33.484, ...EN,
      has_device: true, device_label: "Phone 4", synthetic: false, phone_e164: phone(4), role: "sentinel", on_post: true, sim_profile: "sentinel_yes" }),
    N({ id: hid(5), name: "Irvine (judge's phone, sentinel)", address: "Irvine (demo)", lng: -117.8265, lat: 33.6846, ...EN,
      has_device: true, device_label: "Phone 5 (judge)", synthetic: false, phone_e164: phone(5), role: "sentinel", on_post: true, sim_profile: "sentinel_no" }),
    N({ id: hid(6), name: "Dana Point (canary)", address: "Dana Point (demo)", lng: -117.6981, lat: 33.4672, ...EN,
      has_device: true, device_label: "Phone 6 (canary)", synthetic: false, phone_e164: phone(6), role: "canary", sim_profile: "canary_no" }),
  ];

  const synth: Household[] = [];
  // Harold does not answer; Phone 1 is his linked contact.
  synth.push(N({ id: hid(7), name: "Harold Benson", address: "Talega (demo)", lng: -117.602, lat: 33.486, ...EN,
    afn_flags: ["walker", "no_car"], memory_note: "Lives alone; uses a walker.", sim_profile: "no_answer",
    linked_contact_household_id: hid(1), linked_contact_name: "Ana Morales" }));
  let n = 8;
  let ix = 0;
  for (const [lng, lat] of pointsIn(z("NOR-TA").geom, PROFILES.length, r)) {
    const p = NAMES[ix % NAMES.length];
    synth.push(N({ id: hid(n++), name: p.name, ...p.lang, address: "Talega (demo)", lng, lat, sim_profile: PROFILES[ix % PROFILES.length],
      afn_flags: ix === 10 ? ["wheelchair"] : ix === 18 ? ["oxygen"] : [] }));
    ix++;
  }
  for (const [zoneId, count] of [["NOR-RS", 6], ["NOR-MS", 6], ["NOR-FR", 4], ["NOR-RMV", 4]] as const) {
    for (const [lng, lat] of pointsIn(z(zoneId).geom, count, r)) {
      const p = NAMES[ix % NAMES.length];
      synth.push(N({ id: hid(n++), name: p.name, ...p.lang, address: "(demo)", lng, lat, sim_profile: "leaving" }));
      ix++;
    }
  }
  // Collections line (synthetic): a local history archive and a collector, at fixed points.
  synth.push(N({ id: hid(95), name: "Karen Holt", address: "Talega (demo)", lng: -117.594, lat: 33.49, sim_profile: "leaving",
    collection_note: "Her late husband's surfboard-shaping archive: templates, photographs and logbooks; two boxes and a portfolio on the grab list" }));
  synth.push(N({ id: hid(96), name: "Neighborhood history collection (demo)", address: "Rancho San Clemente (demo)", lng: -117.61, lat: 33.456, sim_profile: "leaving",
    collection_note: "Photographs and oral-history recordings of early San Clemente; three archival boxes on the grab list" }));

  let s = 100;
  const post = (zoneId: string, vertex: number, label: string, profile: SimProfile) => {
    const [lng, lat] = inset(z(zoneId).geom, vertex, 0.2);
    synth.push(N({ id: hid(s++), name: label, address: `${z(zoneId).name} (demo)`, lng, lat, role: "sentinel", on_post: true, sim_profile: profile }));
  };
  post("NOR-TA", 2, "Talega east (sentinel)", "sentinel_yes");
  post("NOR-RS", 3, "Rancho San Clemente south (sentinel)", "sentinel_unsure");
  post("NOR-MS", 0, "Marblehead west (sentinel)", "sentinel_yes");
  post("NOR-FR", 0, "Forster Ranch north-west (sentinel)", "sentinel_yes");
  post("NOR-RMV", 1, "Rancho Mission Viejo (sentinel)", "silent");
  // Far points of the county (only matter when the wrong, countywide polygon is composed).
  synth.push(N({ id: hid(s++), name: "Anaheim (sentinel)", lng: -117.9145, lat: 33.8366, role: "sentinel", on_post: true, sim_profile: "sentinel_no" }));
  synth.push(N({ id: hid(s++), name: "Huntington Beach (sentinel)", lng: -117.9992, lat: 33.6603, role: "sentinel", on_post: true, sim_profile: "sentinel_no" }));
  synth.push(N({ id: hid(s++), name: "Fullerton (sentinel)", lng: -117.9243, lat: 33.8704, role: "sentinel", on_post: true, sim_profile: "silent" }));
  synth.push(N({ id: hid(s++), name: "San Juan Capistrano (canary)", lng: -117.6625, lat: 33.5017, role: "canary", sim_profile: "canary_no" }));

  const proposals: Proposal[] = [{
    id: crypto.randomUUID(), zone_id: "NOR-TA", proposed_state: "warning", model: "fire_envelope",
    reason: "Toy fire model from the Norte Fire ignition point with the NWS wind: the 3-hour envelope reaches Talega's west edge. A Wind Advisory was in effect on Oct 17.",
    score: 0.74, envelope: null, status: "open", decided_by: null, decided_at: null, decision_reason: null, created_at: at,
  }];
  return { zones, households: assignZones([...devices, ...synth], zones), proposals, presets: NORTE_PRESETS };
}
