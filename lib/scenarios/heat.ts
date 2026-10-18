// Heat wave: senior check-ins (the ordinary Tuesday, PRD section 16). Six demo zones in the San Fernando Valley with
// approximate boundaries; older residents who opted in to a heat check-in line; the six volunteer phones. At reset the
// live reading per zone comes from Open-Meteo and NWS (lib/engine/weather.ts). When live conditions are below the
// thresholds, a clearly labeled SIMULATED heat wave (below) drives the demo; simulated temperatures are never shown
// as real. All residents, cooling centers and population figures here are demo values.
import type { AgeBand, Household, Need, SimProfile, ZoneWeather } from "@/lib/types";
import {
  EN, ES, HY, KO, TL, ZH, assignZones, hid, inset, mkZones, person, pointsIn, rng,
  type Lang, type MovePresets, type ZoneSeed,
} from "./common";
import { heatLevelFor, SOURCES } from "./heatLadder";
import type { ScenarioBuild } from "./westside";

/** The demo's simulated heat wave per zone (°F): used only when live readings are below the thresholds. */
export const SIMULATED_HEAT: Record<string, { high_f: number; feels_like_high_f: number }> = {
  "SFV-WH": { high_f: 112, feels_like_high_f: 110 }, // proposes Extreme Heat Warning
  "SFV-CP": { high_f: 107, feels_like_high_f: 105 }, // Heat Advisory
  "SFV-RS": { high_f: 104, feels_like_high_f: 103 }, // Heat Advisory (the six phones are here)
  "SFV-SY": { high_f: 101, feels_like_high_f: 99 }, // heat watch
  "SFV-VN": { high_f: 99, feels_like_high_f: 97 }, // heat watch
  "SFV-NH": { high_f: 92, feels_like_high_f: 89 }, // below the thresholds: no proposal
};

const center = (zone: string) => `${zone} cooling center (demo)`;
const ride = (zone: string) => `${center(zone)} is open. If you need a ride there, say so on this call.`;

/** Approved route text per zone and level: the cooling center (simulated, labeled demo) and the offer of a ride. */
function presets(name: string) {
  return {
    warning: { move_text: ride(name), evac_point: null, evac: null },
    order: { move_text: ride(name), evac_point: null, evac: null },
    shelter_in_place: { move_text: "", evac_point: null, evac: null },
  };
}

const NAMES: Record<string, string> = {
  "SFV-WH": "Woodland Hills", "SFV-CP": "Canoga Park", "SFV-RS": "Reseda", "SFV-VN": "Van Nuys", "SFV-NH": "North Hollywood", "SFV-SY": "Sylmar",
};

export const HEAT_PRESETS: MovePresets = Object.fromEntries(Object.entries(NAMES).map(([id, name]) => [id, presets(name)]));

const FACT =
  "Demo zone with an approximate boundary. The population figure is a round demo estimate, not a census count. Cooling centers named here are demo choices. Call 211 for the nearest real cooling center (LA County, lacounty.gov/heat).";

const ZONE = (id: string, coords: [number, number][], population_est: number): ZoneSeed => ({
  id, name: NAMES[id], coords, state: "monitor", directive_text: null, move_text: null, evac_point: null, evac: null,
  fact_sheet: FACT, population_est, hazard_origin: null,
});

const ZONES: ZoneSeed[] = [
  ZONE("SFV-WH", [[-118.64, 34.15], [-118.575, 34.15], [-118.575, 34.188], [-118.64, 34.188]], 30_000),
  ZONE("SFV-CP", [[-118.625, 34.193], [-118.57, 34.193], [-118.57, 34.228], [-118.625, 34.228]], 32_000),
  ZONE("SFV-RS", [[-118.56, 34.172], [-118.515, 34.172], [-118.515, 34.222], [-118.56, 34.222]], 38_000),
  ZONE("SFV-VN", [[-118.475, 34.165], [-118.425, 34.165], [-118.425, 34.215], [-118.475, 34.215]], 60_000),
  ZONE("SFV-NH", [[-118.4, 34.15], [-118.36, 34.15], [-118.36, 34.2], [-118.4, 34.2]], 40_000),
  ZONE("SFV-SY", [[-118.48, 34.29], [-118.41, 34.29], [-118.41, 34.325], [-118.48, 34.325]], 45_000),
];

/** The simulated reading for a zone, as a ZoneWeather (the offline default; reset replaces it with the live check). */
export function simulatedWeather(zoneId: string, at: string, liveError: string | null = "not checked yet"): ZoneWeather {
  const s = SIMULATED_HEAT[zoneId] ?? { high_f: 95, feels_like_high_f: 93 };
  return {
    live: null, live_error: liveError, source: SOURCES.open_meteo.label, source_url: SOURCES.open_meteo.url,
    nws: [], nws_checked: false, simulated: s, basis: "simulated", feels_like_high_f: s.feels_like_high_f,
    proposed: heatLevelFor(s.feels_like_high_f), checked_at: at,
  };
}

interface Senior {
  name: string;
  lang: Lang;
  age: AgeBand;
  alone: boolean;
  noac: boolean;
  afn?: Need[];
  profile: SimProfile;
  note?: string;
  link?: { id: string; name: string };
}

const note = (s: Senior) =>
  s.note ?? [s.alone ? "Lives alone." : "Lives with family.", s.noac ? "No air conditioning." : null].filter(Boolean).join(" ");

// Ruth Klein's neighbor is a resident too (a fixed id so the link survives re-seeds).
const OHANIAN = hid(60);

const ROSTER: Record<string, Senior[]> = {
  "SFV-RS": [
    { name: "Carmen Morales", lang: ES, age: "85+", alone: true, noac: true, profile: "no_answer",
      note: "Lives alone. No air conditioning. Her daughter Ana checks on her most evenings.", link: { id: hid(1), name: "Ana Morales (daughter)" } },
    { name: "Rosario Santos", lang: TL, age: "85+", alone: true, noac: true, profile: "needs_help_now" },
    { name: "Kim Young-ja", lang: KO, age: "75-84", alone: false, noac: true, profile: "leaving" },
    { name: "Hovik Grigoryan", lang: HY, age: "65-74", alone: false, noac: false, profile: "already_left" },
    { name: "Gloria Washington", lang: EN, age: "75-84", alone: true, noac: false, afn: ["powered_medical_device"], profile: "wants_check_in",
      note: "Lives alone. Uses a powered lift chair." },
    { name: "Luis Hernández", lang: ES, age: "75-84", alone: true, noac: true, afn: ["no_car"], profile: "needs_help_leaving" },
    { name: "Maricel Reyes", lang: TL, age: "65-74", alone: false, noac: true, profile: "leaving" },
    { name: "Park Ji-hoon", lang: KO, age: "85+", alone: true, noac: false, afn: ["hearing"], profile: "already_left",
      note: "Lives alone. Hard of hearing: speak slowly." },
    { name: "Nina Avetisyan", lang: HY, age: "75-84", alone: true, noac: true, afn: ["walker"], profile: "staying" },
    { name: "Thomas Reed", lang: EN, age: "65-74", alone: false, noac: false, profile: "leaving" },
    { name: "Mei Lin", lang: ZH, age: "75-84", alone: true, noac: true, profile: "unclear" },
    { name: "Rosa Medina", lang: ES, age: "65-74", alone: false, noac: false, profile: "already_left" },
  ],
  "SFV-WH": [
    { name: "Ruth Klein", lang: EN, age: "85+", alone: true, noac: true, afn: ["walker"], profile: "no_answer",
      note: "Lives alone. Uses a walker. No air conditioning.", link: { id: OHANIAN, name: "David Ohanian (neighbor)" } },
    { name: "Patricia Lane", lang: EN, age: "75-84", alone: true, noac: false, afn: ["oxygen"], profile: "wants_check_in",
      note: "Lives alone. Home oxygen." },
    { name: "Francisco Vargas", lang: ES, age: "85+", alone: false, noac: true, afn: ["wheelchair", "no_car"], profile: "needs_help_leaving",
      note: "Uses a wheelchair. No car. No air conditioning." },
    { name: "Lee Min-jung", lang: KO, age: "75-84", alone: true, noac: true, profile: "leaving" },
    { name: "Joy Perez", lang: TL, age: "65-74", alone: false, noac: false, profile: "already_left" },
    { name: "Arturo Ruiz", lang: ES, age: "75-84", alone: true, noac: true, profile: "staying" },
  ],
  "SFV-CP": [
    { name: "Wang Fang", lang: ZH, age: "75-84", alone: true, noac: true, profile: "leaving" },
    { name: "Grace Yoon", lang: KO, age: "85+", alone: true, noac: false, afn: ["walker"], profile: "wants_check_in" },
    { name: "Jorge Mendoza", lang: ES, age: "75-84", alone: false, noac: true, afn: ["no_car"], profile: "needs_help_leaving" },
    { name: "Nancy Ellis", lang: EN, age: "65-74", alone: true, noac: false, profile: "already_left" },
    { name: "Armen Petrosyan", lang: HY, age: "85+", alone: true, noac: true, profile: "no_answer" },
  ],
  "SFV-VN": [
    { name: "Guadalupe Torres", lang: ES, age: "85+", alone: true, noac: true, profile: "leaving" },
    { name: "Steven Grant", lang: EN, age: "75-84", alone: true, noac: false, afn: ["vision"], profile: "already_left" },
    { name: "Chen Hao", lang: ZH, age: "65-74", alone: false, noac: true, profile: "leaving" },
    { name: "Imelda Cruz", lang: TL, age: "75-84", alone: true, noac: true, profile: "wants_check_in" },
    { name: "Kevin Shaw", lang: EN, age: "65-74", alone: false, noac: false, profile: "already_left" },
  ],
  "SFV-SY": [
    { name: "Teresa Aguilar", lang: ES, age: "75-84", alone: true, noac: true, afn: ["no_car"], profile: "needs_help_leaving" },
    { name: "Ashot Hakobyan", lang: HY, age: "85+", alone: true, noac: false, profile: "already_left" },
    { name: "Jung Mi-ok", lang: KO, age: "65-74", alone: false, noac: true, profile: "leaving" },
    { name: "Denise Harper", lang: EN, age: "75-84", alone: true, noac: true, profile: "staying" },
    { name: "Carlos Ibarra", lang: ES, age: "65-74", alone: false, noac: false, profile: "leaving" },
  ],
  "SFV-NH": [
    { name: "Brian Foster", lang: EN, age: "75-84", alone: true, noac: true, profile: "leaving" },
    { name: "Lilit Hovhannisyan", lang: HY, age: "65-74", alone: true, noac: false, profile: "already_left" },
    { name: "Ramon Castillo", lang: ES, age: "85+", alone: true, noac: true, afn: ["walker"], profile: "wants_check_in" },
    { name: "Susan Park", lang: EN, age: "65-74", alone: false, noac: false, profile: "already_left" },
  ],
};

export function buildHeat(at: string, devicePhones: (string | null)[] = []): ScenarioBuild {
  const r = rng(20261019);
  const zones = mkZones("heat", ZONES, "Heat desk supervisor (seed)", at).map((z) => ({ ...z, weather: simulatedWeather(z.id, at) }));
  const z = (id: string) => zones.find((x) => x.id === id)!;
  const phone = (i: number) => devicePhones[i - 1] ?? null;
  const H = (over: Partial<Household> & Pick<Household, "id" | "name" | "lat" | "lng">) => person("heat", over);

  // The six volunteer phones. Phone 1 is a daughter outside the zones (a linked contact, never on a call list);
  // Phone 2 is an older man in Reseda who needs a ride; 3 and 4 are staff at Reseda's edges; 5 is on the coast; 6 a canary.
  const devices: Household[] = [
    H({ id: hid(1), name: "Ana Morales", address: "Northridge (demo)", lng: -118.536, lat: 34.245, ...ES,
      has_device: true, device_label: "Phone 1", synthetic: false, phone_e164: phone(1), sim_profile: "leaving",
      memory_note: "Daughter of Carmen Morales; checks on her mother most evenings." }),
    H({ id: hid(2), name: "Harold Jensen", address: "Reseda (demo)", lng: -118.5395, lat: 34.2005, ...EN,
      has_device: true, device_label: "Phone 2", synthetic: false, phone_e164: phone(2), sim_profile: "needs_help_leaving",
      afn_flags: ["walker", "no_car"], memory_note: "Lives alone. Uses a walker. No car. No air conditioning.",
      heat_profile: { age_band: "85+", lives_alone: true, no_ac: true } }),
    H({ id: hid(3), name: "Reseda senior center desk", address: "Reseda, north edge (demo)", lng: -118.5525, lat: 34.2185, ...EN,
      has_device: true, device_label: "Phone 3", synthetic: false, phone_e164: phone(3), role: "sentinel", on_post: true,
      sim_profile: "sentinel_yes", memory_note: "Front desk staff; enrolled sentinel." }),
    H({ id: hid(4), name: "Reseda library desk", address: "Reseda, south edge (demo)", lng: -118.5215, lat: 34.1755, ...EN,
      has_device: true, device_label: "Phone 4", synthetic: false, phone_e164: phone(4), role: "sentinel", on_post: true,
      sim_profile: "sentinel_yes", memory_note: "Library staff; enrolled sentinel." }),
    H({ id: hid(5), name: "Santa Monica pier sentinel", address: "Santa Monica (demo)", lng: -118.4973, lat: 34.0094, ...EN,
      has_device: true, device_label: "Phone 5 (judge)", synthetic: false, phone_e164: phone(5), role: "sentinel", on_post: true,
      sim_profile: "sentinel_no", memory_note: "Enrolled sentinel on the coast." }),
    H({ id: hid(6), name: "Encino canary", address: "Encino (demo)", lng: -118.5, lat: 34.16, ...EN,
      has_device: true, device_label: "Phone 6 (canary)", synthetic: false, phone_e164: phone(6), role: "canary",
      sim_profile: "canary_no", memory_note: "Enrolled canary between the zones." }),
  ];

  const synth: Household[] = [];
  let n = 7;
  for (const [zoneId, seniors] of Object.entries(ROSTER)) {
    const pts = pointsIn(z(zoneId).geom, seniors.length + 1, r);
    seniors.forEach((s, i) => {
      const [lng, lat] = pts[i];
      synth.push(H({
        id: hid(n++), name: s.name, ...s.lang, address: `${NAMES[zoneId]} (demo)`, lng, lat, sim_profile: s.profile,
        afn_flags: s.afn ?? [], memory_note: note(s), heat_profile: { age_band: s.age, lives_alone: s.alone, no_ac: s.noac },
        linked_contact_household_id: s.link?.id ?? null, linked_contact_name: s.link?.name ?? null,
      }));
    });
    if (zoneId === "SFV-WH") {
      const [lng, lat] = pts[seniors.length];
      synth.push(H({ id: OHANIAN, name: "David Ohanian", ...HY, address: "Woodland Hills (demo)", lng, lat, sim_profile: "already_left",
        memory_note: "Ruth Klein's neighbor; has her spare key.", heat_profile: { age_band: "65-74", lives_alone: false, no_ac: false } }));
    }
  }

  // Enrolled sentinels: staff at community places near each zone's corners, plus far points for the wrong-polygon demo.
  let s = 100;
  const sentinel = (zoneId: string, vertex: number, profile: SimProfile, label: string) => {
    const [lng, lat] = inset(z(zoneId).geom, vertex, 0.2);
    synth.push(H({ id: hid(s++), name: `${label} (sentinel)`, address: `${NAMES[zoneId]} (demo)`, lng, lat, role: "sentinel", on_post: true, sim_profile: profile }));
  };
  sentinel("SFV-RS", 0, "sentinel_yes", "Reseda pharmacy counter");
  sentinel("SFV-RS", 2, "silent", "Reseda park staff");
  sentinel("SFV-WH", 0, "sentinel_yes", "Woodland Hills senior center desk");
  sentinel("SFV-WH", 1, "sentinel_yes", "Woodland Hills library desk");
  sentinel("SFV-WH", 3, "sentinel_unsure", "Warner Center park staff");
  sentinel("SFV-CP", 1, "sentinel_yes", "Canoga Park library desk");
  sentinel("SFV-CP", 3, "sentinel_yes", "Canoga Park senior center desk");
  sentinel("SFV-VN", 0, "sentinel_yes", "Van Nuys library desk");
  sentinel("SFV-VN", 2, "silent", "Van Nuys park staff");
  sentinel("SFV-SY", 1, "sentinel_yes", "Sylmar library desk");
  sentinel("SFV-SY", 3, "sentinel_yes", "Sylmar park staff");
  sentinel("SFV-NH", 0, "sentinel_no", "North Hollywood library desk");
  sentinel("SFV-NH", 2, "silent", "North Hollywood park staff");
  synth.push(H({ id: hid(s++), name: "Long Beach (sentinel)", lng: -118.1937, lat: 33.7701, role: "sentinel", on_post: true, sim_profile: "sentinel_no" }));
  synth.push(H({ id: hid(s++), name: "Malibu (sentinel)", lng: -118.7798, lat: 34.0259, role: "sentinel", on_post: true, sim_profile: "silent" }));
  synth.push(H({ id: hid(s++), name: "Burbank (canary)", lng: -118.3089, lat: 34.1808, role: "canary", sim_profile: "canary_no" }));

  return { zones, households: assignZones([...devices, ...synth], zones), proposals: [], presets: HEAT_PRESETS };
}
