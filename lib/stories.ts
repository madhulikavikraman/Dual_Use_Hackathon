// Real incidents behind VoiceFlare, for the landing page, /global and the poster. Every fact carries a source and
// comes from fact-checked research (PRD findings F-1, F-2 and the October 17 research runs); nothing here is
// invented for the demo. Content is filled in as the research lands; the shape is stable. Client-safe.

/** A VoiceFlare feature, as named on the landing page. */
export type Feature =
  | "Sentinels"
  | "Dose preview + hold"
  | "Canary"
  | "Verbatim relay"
  | "Edge-first + needs-first calls"
  | "Silence rules"
  | "Help registry"
  | "Teach-back"
  | "Ledger"
  | "Human approves model proposals"
  | "Public line"
  | "Dark zone";

export interface FireStory {
  id: string;
  name: string;
  when: string;
  where: string;
  /** One line, official numbers (acres, structures, deaths); "" until confirmed. */
  damage: string;
  what_went_wrong: string[];
  voiceflare: { feature: Feature | string; how: string }[];
  /** What VoiceFlare would not have changed. */
  limits: string;
  sources: string[];
}

export interface LiveIncident {
  name: string;
  /** When this status was true, e.g. "Oct 17, 2026, 10:05 AM PT". */
  as_of: string;
  status_line: string;
  place: string;
  lat: number | null;
  lng: number | null;
  alert_notes: string;
  links: string[];
}

export interface HeritageStory {
  id: string;
  title: string;
  where: string;
  when: string;
  what_happened: string;
  what_voiceflare_changes: string;
  source_url: string;
}

export interface Stat {
  value: string;
  label: string;
  source: string;
}

/** The fire burning on demo weekend (CAL FIRE's public incident list; the /demo "norte" scenario fetches it live). */
export const LIVE: LiveIncident | null = {
  name: "Norte Fire",
  as_of: "Oct 17, 2026, 9:47 AM PT (CAL FIRE)",
  status_line: "570 acres, 5% contained",
  place: "San Clemente, Orange County (Portico Del Norte and Eminencia Del Norte); Orange County Fire Authority",
  lat: 33.4813,
  lng: -117.63618,
  alert_notes: "The National Weather Service had a Wind Advisory (until noon), a Heat Advisory and an Air Quality Alert out for the area on Oct 17.",
  links: ["https://www.fire.ca.gov/incidents/2026/10/16/norte-fire/"],
};

export const FIRES: FireStory[] = [
  {
    id: "jan-9-alert",
    name: "The alert that woke 10 million phones",
    when: "January 9, 2025",
    where: "Los Angeles County",
    damage: "",
    what_went_wrong: [
      "A Kenneth Fire evacuation warning meant for part of the West Hills and Calabasas area reached about 10 million phones across the county.",
      "The polygon never reached the distribution system; a correction followed about 20 minutes later, and false alerts repeated through the night.",
    ],
    voiceflare: [
      { feature: "Dose preview + hold", how: "Before the send, the supervisor sees \"wakes about 9.8 million\" for a three-city warning, with 90 seconds to edit the polygon. The alert still sends on time if nobody acts." },
      { feature: "Sentinels", how: "Sentinels far from the fire, in Long Beach or downtown, answer \"nothing here\", which flags a polygon far bigger than the fire." },
      { feature: "Canary", how: "A phone known to be outside the zone reports \"I got it\" within a minute of the send, so the over-broad delivery is caught at once." },
    ],
    limits: "VoiceFlare cannot fix a carrier or vendor fault; it detects it in minutes and puts it on the ledger.",
    sources: [
      "https://garcia.house.gov/",
      "https://www.nbclosangeles.com/",
      "https://www.cbsnews.com/losangeles/",
    ],
  },
  {
    id: "west-altadena",
    name: "The warning that came nine hours late",
    when: "January 7-8, 2025 (Eaton fire)",
    where: "West Altadena",
    damage: "",
    what_went_wrong: [
      "Residents west of Lake Avenue did not get evacuation orders until about 3:30 AM, more than nine hours after the fire started; most of the deaths were on that side.",
    ],
    voiceflare: [
      { feature: "Sentinels", how: "Sentinels on the west side would have reported what they saw, so the edge of the danger was not left to a desk." },
      { feature: "Edge-first + needs-first calls", how: "Calls start at the households nearest the fire and at people who cannot leave alone, in their own language." },
      { feature: "Silence rules", how: "No answer means a retry, then a call to a named neighbor or relative, then a door-knock row for the response team." },
    ],
    limits: "VoiceFlare does not decide when to evacuate; a named human still does. It shortens the time between someone seeing danger and the person deciding.",
    sources: ["https://www.cbsnews.com/losangeles/", "https://apnews.com/"],
  },
];

export const STATS: Stat[] = [];

/** The collections use case (museums, libraries, archives, galleries, collectors). Life safety always first. */
export const HERITAGE: {
  name: string;
  one_liner: string;
  stories: HeritageStory[];
  flow: { stage: string; what_happens: string; rule: string }[];
} = {
  name: "Collections line",
  one_liner:
    "Museums, libraries, archives and collectors get the same verified warnings, and a way to ask for help moving what cannot be replaced while there is still time. Lives first, always.",
  stories: [],
  flow: [
    { stage: "Ordinary Tuesday", what_happens: "Institutions and collectors enroll, keep a short grab list of priority items, and answer a monthly test call.", rule: "The list is theirs; it is shared only with the response team." },
    { stage: "Warning", what_happens: "The call reads the approved warning first, then asks whether they need help moving priority items while there is time.", rule: "Salvage requests rank below every life-safety request." },
    { stage: "Order", what_happens: "The call reads the order and says leave now. A request for help after the fire can be logged.", rule: "Never offer salvage under an order; never tell anyone to stay for objects." },
    { stage: "After", what_happens: "Salvage requests go to heritage responders while there is still time to save wet or smoke-damaged items.", rule: "The agent never promises that anyone will come." },
  ],
};
