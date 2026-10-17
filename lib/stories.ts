// Real incidents behind VoiceFlare (collections stories: Hyperallergic, The Art Newspaper, ADN, Classic FM, Dainik Prabhat;
// no report was found that names a Pimpri-Chinchwad library losing historic books in July 2026, so none is claimed).
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

// The top three fires of 2025-2026 for VoiceFlare's story (user, Oct 17: "just the top 3"). Facts from the
// Governor-commissioned UL FSRI incident analysis (Oct 2, 2026), LA County's after-action review (McChrystal Group),
// LAFD's after-action report, CAL FIRE incident pages, and press as linked.
export const FIRES: FireStory[] = [
  {
    id: "eaton",
    name: "Eaton fire: the west side was told last",
    when: "January 7-8, 2025",
    where: "Altadena, Los Angeles County",
    damage: "14,021 acres; 9,419 structures destroyed; 19 deaths (CAL FIRE)",
    what_went_wrong: [
      "East Altadena got evacuation orders at 7:26 PM; west of Lake Avenue the first orders came at 3:25 AM, about 8 hours later. 18 of the 19 people who died lived west of Lake.",
      "Just after midnight a county paramedic squad saw embers falling \"like snow\" and houses burning west of Lake; it was not assigned to the incident, so no one in command heard it.",
      "A father who used a wheelchair and his son with cerebral palsy died at home after three 911 calls.",
    ],
    voiceflare: [
      { feature: "Sentinels", how: "People enrolled at the west edge are asked \"does this match what you see?\" before and during the night, so a sighting like the paramedics' reaches the person deciding within minutes." },
      { feature: "Edge-first + needs-first calls", how: "The first calls go to the households nearest the fire and to people who cannot leave alone, and each \"I can't leave\" becomes a P1 or P2 registry row with a location for the response team." },
      { feature: "Ledger", how: "Every order is logged with who decided, when and why; the county review found no reliable record of who ordered each alert." },
    ],
    limits: "VoiceFlare does not decide evacuations or add deputies; a named human still decides. It shortens the path from someone seeing fire to that person.",
    sources: [
      "https://file.lacounty.gov/SDSInter/lac/1192777_AAR_EatonFireSynopsisofFindingsandTimeline.pdf",
      "https://ulri.figshare.com/articles/report/Southern_California_Fires_Incident_Analysis_Report/31982232",
      "https://www.kqed.org/news/12048956/despite-three-911-calls-two-homebound-disabled-men-died-in-eaton-fire",
      "https://www.fire.ca.gov/incidents/2025/1/7/eaton-fire/",
    ],
  },
  {
    id: "palisades",
    name: "Palisades fire: alerts after the homes were burning",
    when: "January 7, 2025",
    where: "Pacific Palisades, Los Angeles",
    damage: "23,448 acres; 6,845 structures destroyed; 12 deaths (CAL FIRE)",
    what_went_wrong: [
      "Some residents nearest the ignition point got their first alert 40 to 90 minutes after homes had begun burning (FSRI).",
      "City staff drew evacuation zones by hand from street names read over the radio, and officials were cautious about over-warning.",
      "Late warnings meant everyone left at once: gridlock on Palisades Drive and Sunset, about 350 cars abandoned and pushed aside by a bulldozer, while cell networks were down or overloaded.",
    ],
    voiceflare: [
      { feature: "Dose preview + hold", how: "The supervisor sees exactly who an order wakes (a neighborhood, not a county), so a targeted order is safe to send fast; the hold never blocks it and sends on time." },
      { feature: "Edge-first + needs-first calls", how: "Calls ring out in rings from the fire's edge, so the people nearest the ignition hear first, by name and in their language." },
      { feature: "Dark zone", how: "When a block's phones go silent at once, the board flags a dark zone and moves those households to door-knock lists." },
    ],
    limits: "VoiceFlare cannot clear roads or direct traffic, and it needs a working phone network or a door knock to reach people.",
    sources: [
      "https://ulri.figshare.com/articles/report/Southern_California_Fires_Incident_Analysis_Report/31982232",
      "https://lafd.org/sites/default/files/pdf_files/Palisades_AARR_10_08_2025_final.pdf",
      "https://lafd.org/sites/default/files/pdf_files/AARR_Fact_Sheet.pdf",
      "https://www.fire.ca.gov/incidents/2025/1/7/palisades-fire/",
    ],
  },
  {
    id: "norte",
    name: "Norte fire: an Order with no warning first",
    when: "October 16, 2026 (burning on demo weekend)",
    where: "San Clemente, Orange County",
    damage: "570 acres, 5% contained as of Oct 17, 9:47 AM; about 16,000 residents under evacuation orders (CAL FIRE, OCFA)",
    what_went_wrong: [
      "The 911 call came at 11:33 AM; Orders for five zones went out at 12:54 PM, with no Warning step before them.",
      "A mother and her 6-year-old were still at their door with the fire about 300 feet away; a passer-by who had seen a phone alert knocked and got them out.",
      "The county's written order notice came about four hours later, as an English-only scanned image.",
    ],
    voiceflare: [
      { feature: "Sentinels", how: "Edge sentinels and the fire model propose a Warning early, so people who need time get a head start before an Order." },
      { feature: "Silence rules", how: "A household that does not answer gets a retry, then its named neighbor, then a door-knock row: no one depends on a passer-by." },
      { feature: "Verbatim relay", how: "Each call reads the approved order in the person's language, with the route and shelter, minutes after it is approved." },
    ],
    limits: "VoiceFlare does not fight the fire or decide the order; the order is still OCFA's and the county's.",
    sources: [
      "https://www.fire.ca.gov/incidents/2026/10/16/norte-fire/",
      "https://www.nbclosangeles.com/news/local/norte-fire-good-samaritan-helps-family-evacuate/3957518/",
      "https://www.sanclemente.gov/DocumentCenter/View/5158/02-Press-Release-Norte-Fire-10-16-26--1650",
      "https://www.ocsheriff.gov/nortefire",
    ],
  },
];

export const STATS: Stat[] = [
  { value: "10 million", label: "phones got a Jan 9, 2025 evacuation warning meant for one fire area; the target polygon was never saved to the wireless channel", source: "https://robertgarcia.house.gov/sites/evo-subsites/robertgarcia.house.gov/files/evo-media-document/false-alerts-final-report-5.10.pdf" },
  { value: "18 of 19", label: "Eaton fire deaths were west of Lake Avenue, where orders came about 8 hours after the east side", source: "https://file.lacounty.gov/SDSInter/lac/1192777_AAR_EatonFireSynopsisofFindingsandTimeline.pdf" },
  { value: "40-90 min", label: "after homes began burning, some Palisades residents nearest the ignition got their first alert", source: "https://ulri.figshare.com/articles/report/Southern_California_Fires_Incident_Analysis_Report/31982232" },
  { value: "2 of 66", label: "notified survey respondents in the Eaton and Palisades fires were told by a phone call (convenience sample)", source: "https://ulri.figshare.com/articles/report/Southern_California_Fires_Incident_Analysis_Report/31982232" },
];


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
  stories: [
    {
      id: "warning-at-3am",
      title: "A 3 AM warning, three works saved",
      where: "Altadena (Eaton fire)",
      when: "January 8, 2025",
      what_happened: "Collectors Joy Silverman and George Bermudez had a warning, not an order: an alert woke them at 3 AM and they packed three artworks. The house and the rest of the collection burned.",
      what_voiceflare_changes: "At Warning, the call reads the approved warning, then asks once whether they need help moving their grab list; a heritage team gets the request while roads are open, ranked below every person.",
      source_url: "https://hyperallergic.com/983707/the-unfathomable-loss-of-artistic-heritage-in-altadena/",
    },
    {
      id: "yellow-not-red",
      title: "Art handlers could help only before a zone turned red",
      where: "Los Angeles",
      when: "January 2025",
      what_happened: "Fine-art shippers pulled work out of yellow (prepare to leave) zones but would not enter red ones; one storage firm had 5 to 10 times its normal requests in the first week.",
      what_voiceflare_changes: "The salvage window is the Warning stage, so the request goes out then, with the zone, the address and the grab list, not after the order.",
      source_url: "https://www.theartnewspaper.com/2025/02/14/los-angeles-wildfires-art-storage-handling-logistics",
    },
    {
      id: "judgment-call",
      title: "An alert at 10:45 AM, a collection gone by afternoon",
      where: "Pacific Palisades",
      when: "January 7, 2025",
      what_happened: "Collector Ron Rivlin got his first alert at 10:45 AM, judged the fire would not cross Sunset, and left with three Warhol prints; hundreds of works, about 30 of them Warhols, burned.",
      what_voiceflare_changes: "A call that reads the approved warning and asks a direct question (\"do you need help moving your list?\") turns a judgment call into a plan while there is still time.",
      source_url: "https://www.adn.com/nation-world/2025/03/24/extreme-weather-is-testing-the-notoriously-secretive-art-world",
    },
    {
      id: "never-go-back",
      title: "Why the agent never says \"go back\"",
      where: "Altadena (Eaton fire)",
      when: "January 2025",
      what_happened: "Artists Adam and Caitlin Ross went back into the flames once to pull 11 paintings, then watched their studio burn; about 5,000 works were lost.",
      what_voiceflare_changes: "The agent never tells anyone to stay or go back for objects. Under an Order the only instruction is to leave; a request for help is logged for after the fire.",
      source_url: "https://www.theartnewspaper.com/2026/02/25/los-angeles-artists-wildfires-anniversary",
    },
    {
      id: "backup-on-site",
      title: "The backup burned with the archive",
      where: "Pacific Palisades",
      when: "January 2025",
      what_happened: "More than 100,000 Arnold Schoenberg scores and parts at Belmont Music Publishers burned, and so did the digital backup kept on site; the originals in Vienna were safe.",
      what_voiceflare_changes: "Enrollment on an ordinary Tuesday is when a holder writes the grab list and says what cannot be replaced; VoiceFlare keeps it with the household, so the warning call can act on it.",
      source_url: "https://www.classicfm.com/music-news/arnold-schoenberg-scores-destroyed-la-fires/",
    },
    {
      id: "pimpri-chinchwad-2026",
      title: "A week of rain in Pimpri-Chinchwad",
      where: "Pimpri-Chinchwad, Pune, India",
      when: "June 29 to July 8, 2026",
      what_happened: "After a week of continuous rain (268 mm in 24 hours at Chinchwad), water reached first floors in Tanajinagar, Keshavnagar and Laxminagar and more than 1,500 people were trapped. In India's 2018 Kerala floods, more than 225 public libraries were hit.",
      what_voiceflare_changes: "River levels and dam releases give hours of notice: riverside homes, libraries and collectors get a call at Warning in their language, with the collections question asked while the water is still rising.",
      source_url: "https://www.dainikprabhat.com/pimpri-chinchwad-rain-pimpri-chinchwads-mess-municipal-corporations-drain-cleaning-is-open-citizens-plight-as-water-enters-houses",
    },
  ],
  flow: [
    { stage: "Ordinary Tuesday", what_happens: "Institutions and collectors enroll, keep a short grab list of priority items, and answer a monthly test call.", rule: "The list is theirs; it is shared only with the response team." },
    { stage: "Warning", what_happens: "The call reads the approved warning first, then asks whether they need help moving priority items while there is time.", rule: "Salvage requests rank below every life-safety request." },
    { stage: "Order", what_happens: "The call reads the order and says leave now. A request for help after the fire can be logged.", rule: "Never offer salvage under an order; never tell anyone to stay for objects." },
    { stage: "After", what_happens: "Salvage requests go to heritage responders while there is still time to save wet or smoke-damaged items.", rule: "The agent never promises that anyone will come." },
  ],
};
