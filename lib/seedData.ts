// SYNTHETIC households for the demo: west Altadena, CA (around 34.19, -118.155).
// None of these people or addresses are real residents. Pure module: used by
// scripts/seed.ts and by the demo reset endpoint.
import type { Household, Need } from "./types";

type Lang = { language: string; lang_code: string };
const EN: Lang = { language: "English", lang_code: "en-US" };
const ES: Lang = { language: "Spanish", lang_code: "es-US" };
const HY: Lang = { language: "Armenian", lang_code: "hy-AM" };
const ZH: Lang = { language: "Chinese (Mandarin)", lang_code: "zh-CN" };
const KO: Lang = { language: "Korean", lang_code: "ko-KR" };
const TL: Lang = { language: "Tagalog", lang_code: "fil-PH" };

/** Stable ids: device QR codes keep working across re-seeds. */
export const hid = (n: number) => `00000000-0000-4000-a000-${n.toString().padStart(12, "0")}`;

// Mulberry32: deterministic so every seed produces the same map.
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const base = (over: Partial<Household> & Pick<Household, "id" | "name" | "lat" | "lng">): Household => ({
  address: null,
  has_device: false,
  device_label: null,
  synthetic: true,
  ...EN,
  afn_flags: [],
  memory_note: null,
  linked_contact_household_id: null,
  linked_contact_name: null,
  can_drive_neighbors: false,
  seats: 0,
  phone_e164: null,
  role: "resident",
  channel: "voice",
  zone_id: null,
  on_post: false,
  reliability: 0.9,
  last_heard: null,
  presence_at: null,
  scenario: "altadena",
  sim_profile: "leaving",
  ...over,
});

// Volunteer device households (a team member's real phone plays this resident).
const devices: Household[] = [
  base({ id: hid(1), name: "Dana Whitfield", address: "2214 Lincoln Ave", lat: 34.1903, lng: -118.1592, has_device: true, ...EN,
    can_drive_neighbors: true, seats: 3, memory_note: "Drives a minivan. Checks on her neighbor Maria Delgado." }),
  base({ id: hid(2), name: "María Delgado", address: "2230 Lincoln Ave", lat: 34.1907, lng: -118.1589, has_device: true, ...ES,
    afn_flags: ["oxygen", "no_car"], memory_note: "Uses a home oxygen concentrator. Lives alone with a small dog named Chispa.",
    linked_contact_household_id: hid(1), linked_contact_name: "Dana Whitfield (neighbor)" }),
  base({ id: hid(3), name: "Jiwoo Park", address: "1985 Mariposa St", lat: 34.1876, lng: -118.1540, has_device: true, ...KO,
    afn_flags: ["hearing"], memory_note: "Hard of hearing; prefers text." }),
  base({ id: hid(4), name: "Wei Zhang", address: "2101 Highview Ave", lat: 34.1921, lng: -118.1528, has_device: true, ...ZH,
    memory_note: "Has two cats." }),
  base({ id: hid(5), name: "Armen Petrosyan", address: "1940 Glenrose Ave", lat: 34.1864, lng: -118.1611, has_device: true, ...HY,
    afn_flags: ["wheelchair"], memory_note: "Uses a wheelchair; needs an accessible van." }),
  base({ id: hid(6), name: "Rosario Santos", address: "2055 Calaveras St", lat: 34.1889, lng: -118.1503, has_device: true, ...TL,
    afn_flags: ["no_car"] }),
];

// Ventura St block: the tower_down preset knocks out this tight cluster.
export const TOWER_BLOCK_IDS = Array.from({ length: 10 }, (_, i) => hid(7 + i));

const NAMES: Record<string, string[]> = {
  "en-US": ["James Porter", "Linda Okafor", "Michael Brooks", "Susan Hale", "David Kim-Lewis", "Karen Moore", "Thomas Reed",
    "Nancy Ellis", "Brian Foster", "Gloria Washington", "Kevin Shaw", "Patricia Lane", "Marcus Bell", "Ruth Coleman",
    "Steven Grant", "Denise Harper", "Paul Navarro"],
  "es-US": ["José Ramírez", "Guadalupe Torres", "Luis Hernández", "Carmen Flores", "Miguel Ortega", "Rosa Medina",
    "Francisco Vargas", "Elena Castillo", "Jorge Mendoza", "Teresa Aguilar", "Ricardo Salinas"],
  "hy-AM": ["Anahit Sargsyan", "Hovik Grigoryan"],
  "zh-CN": ["Li Na", "Chen Hao"],
  "ko-KR": ["Kim Soo-ah"],
  "fil-PH": ["Maricel Reyes"],
};
const LANG_BY_CODE: Record<string, Lang> = { "en-US": EN, "es-US": ES, "hy-AM": HY, "zh-CN": ZH, "ko-KR": KO, "fil-PH": TL };
const STREETS = ["Lincoln Ave", "Mariposa St", "Highview Ave", "Glenrose Ave", "Calaveras St", "Palm St", "Woodbury Rd", "Altadena Dr", "Pine St"];

// AFN, drivers, linked contacts and memory notes assigned to specific synthetic households (by index into the 34).
const EXTRAS: Record<number, Partial<Household>> = {
  0: { afn_flags: ["wheelchair"], memory_note: "Power wheelchair; ramp at side door." },
  3: { afn_flags: ["walker", "no_car"], linked_contact_name: "Son, Andre Hale" },
  5: { afn_flags: ["bedbound"], memory_note: "Bedbound; home health aide weekdays 9 to 1.", linked_contact_name: "Aide, Joy Perez" },
  12: { afn_flags: ["dialysis"], memory_note: "Dialysis Tuesday, Thursday, Saturday at the Pasadena clinic." },
  18: { afn_flags: ["powered_medical_device"], memory_note: "CPAP and a powered lift chair." },
  22: { afn_flags: ["no_car", "children_alone"], memory_note: "Kids often home alone after 3 pm.", linked_contact_name: "Grandmother, Rosa Ibarra" },
  2: { can_drive_neighbors: true, seats: 4 },
  8: { can_drive_neighbors: true, seats: 2, memory_note: "Has a horse trailer; keeps two horses." },
  14: { can_drive_neighbors: true, seats: 3 },
  20: { can_drive_neighbors: true, seats: 2 },
  27: { can_drive_neighbors: true, seats: 5 },
  10: { memory_note: "Has three dogs." },
  25: { memory_note: "Prefers calls after 9 am; works nights." },
  30: { linked_contact_name: "Daughter, Mei Zhang" },
};

function synthetic(): Household[] {
  const r = rng(20250107);
  const pool = Object.entries(NAMES).flatMap(([code, names]) => names.map((name) => ({ name, lang: LANG_BY_CODE[code] })));
  // Shuffle so languages are mixed across the map.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.map((p, i) => {
    const n = 7 + i;
    const inTowerBlock = n < 7 + TOWER_BLOCK_IDS.length;
    // Tower block: ~150 m stretch of Ventura St. Everyone else: scattered over the zone.
    const lat = inTowerBlock ? 34.1958 + (r() - 0.5) * 0.0012 : 34.183 + r() * 0.0135;
    const lng = inTowerBlock ? -118.1604 + (r() - 0.5) * 0.0022 : -118.1655 + r() * 0.0175;
    const street = inTowerBlock ? "Ventura St" : STREETS[Math.floor(r() * STREETS.length)];
    const num = inTowerBlock ? 1901 + i * 9 : 1800 + Math.floor(r() * 700);
    const extra = EXTRAS[i] ?? {};
    return base({ id: hid(n), name: p.name, address: `${num} ${street}`, lat: +lat.toFixed(6), lng: +lng.toFixed(6), ...p.lang, ...extra,
      afn_flags: (extra.afn_flags ?? []) as Need[] });
  });
}

export const SEED_HOUSEHOLDS: Household[] = [...devices, ...synthetic()];

/** Demo polygon covering the seeded zone (GeoJSON [lng, lat]). Labeled "DEMO POLYGON" in the UI. */
export const DEMO_POLYGON: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [[
    [-118.1675, 34.1815], [-118.1465, 34.1815], [-118.1465, 34.1980], [-118.1675, 34.1980], [-118.1675, 34.1815],
  ]],
};
