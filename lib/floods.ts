// Floods, in the six places VoiceFlare is profiled for (Twist 2: "make it global"). The anchor is the July 2026
// Pimpri-Chinchwad floods in Pune. Every fact carries the source it came from; the research packets behind this file
// (Oct 17, 2026) also listed what could not be confirmed, and none of that is used here. No report was found of a
// library losing historic books in Pimpri-Chinchwad, so none is claimed. Emergency numbers that the packets did not
// re-check come from the jurisdiction profiles in lib/jurisdictions.ts and are marked `fromProfile`.
// The ladder lines (`ladder`) are VoiceFlare's design for each place, built on those facts. Client-safe.
import { JURISDICTIONS, type JurisdictionCode } from "@/lib/jurisdictions";

export interface Source {
  claim: string;
  url: string;
}

/** A statement and the sources it comes from. */
export interface Sourced {
  text: string;
  src: Source[];
}

export type Swatch = "green" | "yellow" | "orange" | "red" | "blue";

/** An official term: the local wording (with its BCP-47 tag if it differs from the profile's) and plain English. */
export interface Term {
  local?: string;
  lang?: string;
  en: string;
  note?: string;
  /** For colour-coded levels: the colour the level is named after. */
  swatch?: Swatch;
}

/** One warning product. `levels` run from lowest to highest; empty when the product has no fixed levels. */
export interface WarningProduct {
  name: string;
  issuer: string;
  levels: Term[];
  note?: string;
  src: Source[];
}

export type OrderStep = "advisory" | "prepare" | "evacuate" | "shelter";

export const ORDER_STEPS: { key: OrderStep; label: string; emoji: string }[] = [
  { key: "advisory", label: "Stay alert", emoji: "👀" },
  { key: "prepare", label: "Get ready", emoji: "🎒" },
  { key: "evacuate", label: "Leave", emoji: "🏃" },
  { key: "shelter", label: "Go up or stay in", emoji: "🏢" },
];

export type FloodRungKey = "watch" | "ask" | "slow" | "hold" | "hand";

export interface FloodLesson {
  title: string;
  where: string;
  when: string;
  facts: Sourced[];
  lesson: Sourced;
  also?: { title: string; facts: Sourced[] };
}

export interface FloodProfile {
  code: JurisdictionCode;
  country: string;
  /** Where the flood example is, for the tab. */
  place: string;
  /** BCP-47 tag for local-script runs in this profile's text; null when the local terms are English. */
  lang: string | null;
  /** How this profile relates to the repo's jurisdiction adapter, when the flood example is somewhere else. */
  scope?: string;
  warnings: WarningProduct[];
  orders: { step: OrderStep; terms: Term[]; src: Source[] }[];
  orderNotes: Sourced[];
  decider: Sourced;
  channel: Sourced;
  /** Where VoiceFlare reads the dose (how many phones an order wakes). */
  dose: string;
  emergency: { call: string; others: string; note?: Sourced; src: Source[]; fromProfile?: boolean };
  sentinels: Sourced[];
  lesson: FloodLesson;
  /** VoiceFlare's flood ladder in this place (design, built on the facts above). */
  ladder: Record<FloodRungKey, string>;
  /** Every source this profile uses, for the Sources section. */
  sources: Source[];
}

/** "120 ambulance, 110 police": a profile's other numbers, for places whose numbers come from lib/jurisdictions.ts. */
function profileNumbers(code: JurisdictionCode): string {
  const j = JURISDICTIONS[code];
  const named: [string, string][] = [
    [j.emergency.fire, "fire"],
    [j.emergency.medical, "ambulance"],
    [j.emergency.police, "police"],
  ];
  return named
    .filter(([n]) => n && n !== j.call_now)
    .map(([n, what]) => `${n} ${what}`)
    .join(", ");
}

// ---------------------------------------------------------------------------------------------------------------
// India: Pune / Pimpri-Chinchwad (PCMC), Maharashtra
// ---------------------------------------------------------------------------------------------------------------

const IN_S = {
  rain268: {
    claim: "Chinchwad recorded 268.0 mm in the 24 hours ending 8:30 am IST on 7 July 2026 (IMD AWS/ARG data); other stations' totals; NDRF on high alert",
    url: "https://www.punekarnews.in/?p=239355",
  },
  rain206: {
    claim: "Second straight day above 200 mm at Chinchwad; 206 mm the day before",
    url: "https://www.thebridgechronicle.com/pune/pune-fourth-highest-24-hour-july-rainfall-since-1958-chinchwad-206-mm-rain-agn97",
  },
  stuck: {
    claim: "More than 1,500 residents stuck in their homes in Tanajinagar, Keshavnagar and Laxminagar; Pavana, Mula and Indrayani rose; Thergaon bridge submerged; roads disrupted (updated 7 July 2026)",
    url: "https://www.dainikprabhat.com/pimpri-chinchwad-rain-pimpri-chinchwads-mess-municipal-corporations-drain-cleaning-is-open-citizens-plight-as-water-enters-houses",
  },
  moved: {
    claim: "PCMC moved 1,880 residents by noon on 6 July 2026; relief shelters in the A, B, D and H wards; the Commissioner directed monitoring of river levels",
    url: "https://www.punekarnews.in/?p=239237",
  },
  redAlert: {
    claim: "IMD red alert for Pune district on 6 July 2026; areas evacuated; Commissioner Dr Vijay Suryawanshi directed advance warnings by public announcement systems",
    url: "https://www.freepressjournal.in/pune/pune-rains-flood-threat-grows-in-pimpri-chinchwad-1880-residents-shifted-to-temporary-shelters-watch-videos",
  },
  pavana: {
    claim: "24 July 2026: Pavana discharge raised from 5,600 to 7,000 cusecs, possibly 9,000; dam about 97% full; Pavana dam flood control cell; PCMC's words to riverbank residents; control room and fire helpline numbers",
    url: "https://www.punekarnews.in/pune-pcmc-asks-residents-along-pavana-indrayani-riverbanks-to-remain-alert-as-dam-discharge-rises/",
  },
  khadakwasla: {
    claim: "Khadakwasla release raised to 22,880 cusecs on 31 July 2026, possibly 30,000",
    url: "https://www.thebridgechronicle.com/amp/story/pune/pune-khadakwasla-dam-discharge-increased-22880-cusecs-heavy-rain-flood-alert-agn97",
  },
  dmAct: {
    claim: "Disaster Management Act 2005: s.25(2)(a) the Collector chairs the District Authority; s.34(c) movement control; s.24(e) the State Executive Committee directs evacuation",
    url: "https://prsindia.org/files/bills_acts/bills_parliament/2024/Disaster_Management_Act_2005.pdf",
  },
  cwc: {
    claim: "CWC flood categories: Above Normal (at or above Warning Level, below Danger Level), Severe (at or above Danger Level, below HFL), Extreme (HFL equalled or exceeded)",
    url: "https://cwc.gov.in/sites/default/files/cfcrcwcdfb06-09-2022_2.pdf",
  },
  cellBroadcast: {
    claim: "Cell Broadcast Alert System launched 2 May 2026 with a nationwide test; alerts go through SACHET; several Indian languages after testing",
    url: "https://ianslive.in/govt-launches-cell-broadcast-alert-system-for-real-time-disaster-warnings--20260502131531",
  },
  sachet: {
    claim: "SACHET is operational in all 36 states and union territories, sending geo-targeted SMS",
    url: "https://www.etvbharat.com/en/bharat/ndma-tests-cell-broadcast-message-to-alert-citizens-on-severe-disaster-enn26050201915",
  },
  ers112: {
    claim: "112 is India's single emergency number (ERSS)",
    url: "https://onmanorama.com/news/india/2019/02/20/emergency-helpline-number-112-comes-into-effect.html",
  },
  aapda: {
    claim: "Aapda Mitra: NDMA scheme since May 2016; began in 30 flood-prone districts, scaled to 350 districts and 100,000 volunteers; kits and insurance",
    url: "https://en.vikaspedia.in/viewcontent/social-welfare/disaster-management-1/aapda-mitra",
  },
  aapdaTraining: {
    claim: "Aapda Mitra volunteer training",
    url: "https://www.deccanherald.com/national/west/ndma-to-train-one-lakh-volunteers-in-disaster-management-by-march-end-931963.html",
  },
  imdColours: {
    claim: "IMD's colour-coded warnings: Green, Yellow, Orange, Red",
    url: "https://www.deccanherald.com/india/explained-how-imd-s-colour-coded-warning-system-works-988657.html",
  },
  floodLines: {
    claim: "Pune flood lines: blue line = 25-year flood, red line = 100-year flood (Water Resources Department)",
    url: "https://sandrp.in/2021/08/05/pune-river-front-development-project/",
  },
} satisfies Record<string, Source>;

const IN: FloodProfile = {
  code: "IN",
  country: "India",
  place: "Pune",
  lang: null,
  scope: "The flood example is Pimpri-Chinchwad, Pune. VoiceFlare's India profile on /global is Odisha (cyclones).",
  warnings: [
    {
      name: "District weather warnings",
      issuer: "India Meteorological Department (IMD)",
      levels: [
        { en: "Green", swatch: "green" },
        { en: "Yellow", swatch: "yellow" },
        { en: "Orange", swatch: "orange" },
        { en: "Red", swatch: "red" },
      ],
      note: "IMD issued a red alert for Pune district on 6 July 2026.",
      src: [IN_S.imdColours, IN_S.redAlert],
    },
    {
      name: "River flood forecasts",
      issuer: "Central Water Commission (CWC), at each river gauge",
      levels: [
        { en: "Above Normal Flood Situation", note: "at or above the Warning Level" },
        { en: "Severe Flood Situation", note: "at or above the Danger Level" },
        { en: "Extreme Flood Situation", note: "the Highest Flood Level equalled or exceeded" },
      ],
      src: [IN_S.cwc],
    },
    {
      name: "Dam release notices",
      issuer: "Maharashtra irrigation department and dam flood control cells",
      levels: [],
      note: "Discharge is announced in cusecs before each step up. On 24 July 2026 the Pavana release went from 5,600 to 7,000 cusecs at 8 pm, with up to 9,000 possible in phases.",
      src: [IN_S.pavana],
    },
    {
      name: "Flood lines along Pune's rivers",
      issuer: "Water Resources Department",
      levels: [
        { en: "Blue line", note: "the 25-year flood", swatch: "blue" },
        { en: "Red line", note: "the 100-year flood", swatch: "red" },
      ],
      src: [IN_S.floodLines],
    },
  ],
  orders: [
    { step: "advisory", terms: [{ en: "Remain alert", note: "PCMC to riverbank residents, 24 July 2026" }], src: [IN_S.pavana] },
    {
      step: "prepare",
      terms: [
        { en: "Avoid entering riverbeds" },
        { en: "Move pumps, materials and livestock", note: "to farmers" },
        { en: "Cooperate with authorities if evacuation becomes necessary" },
      ],
      src: [IN_S.pavana],
    },
    { step: "evacuate", terms: [{ en: "Evacuated to safer locations", note: "by civic emergency teams, 6 July 2026" }], src: [IN_S.moved, IN_S.redAlert] },
    { step: "shelter", terms: [{ en: "Relief shelters", note: "in PCMC's A, B, D and H wards, 6 July 2026" }], src: [IN_S.moved] },
  ],
  orderNotes: [
    { text: "No single national set of flood evacuation words was found. These are the words PCMC used in July 2026.", src: [IN_S.pavana, IN_S.moved] },
    {
      text: "The legal power: the District Authority may “control and restrict the entry of any person into, his movement within and departure from, a vulnerable or affected area” (Disaster Management Act 2005, s.34(c)).",
      src: [IN_S.dmAct],
    },
  ],
  decider: {
    text: "The District Disaster Management Authority, chaired by the Collector (Disaster Management Act 2005, s.25(2)(a)); for Pune district, the Pune Collector. Inside Pimpri-Chinchwad in July 2026, Municipal Commissioner Dr Vijay Suryawanshi directed the response and civic emergency teams moved people. The irrigation department decides dam releases.",
    src: [IN_S.dmAct, IN_S.redAlert, IN_S.moved, IN_S.pavana],
  },
  channel: {
    text: "SACHET, NDMA's alert system on the Common Alerting Protocol, sends geo-targeted SMS and runs in all 36 states and union territories. A Cell Broadcast Alert System was launched on 2 May 2026 with a nationwide test, to run in several Indian languages after testing. In Pimpri-Chinchwad on 6 July 2026, the commissioner directed warnings by public announcement systems in vulnerable areas.",
    src: [IN_S.sachet, IN_S.cellBroadcast, IN_S.redAlert],
  },
  dose: "The SACHET or cell-broadcast target area: the district, or only the riverside wards.",
  emergency: {
    call: "112",
    others: "PCMC control room 020-67331111 or 020-28331111; PCMC fire helpline 7030908991 (published 24 July 2026)",
    note: { text: "112 takes in police (100), fire (101) and health (108).", src: [IN_S.ers112] },
    src: [IN_S.ers112, IN_S.pavana],
  },
  sentinels: [
    {
      text: "Aapda Mitra volunteers, where trained: an NDMA scheme since May 2016 that trains community volunteers as first responders in flood-prone districts, from 30 districts toward 100,000 volunteers in 350.",
      src: [IN_S.aapda, IN_S.aapdaTraining],
    },
    { text: "The Pavana dam flood control cell, which knows about a release before the river does.", src: [IN_S.pavana] },
    { text: "PCMC ward offices, emergency teams and fire brigade.", src: [IN_S.moved, IN_S.pavana] },
    {
      text: "Machine sentinels: IMD weather stations and rain gauges (Chinchwad, Lohgaon, Pashan, Shivajinagar, NDA Khadakwasla and others) and CWC river gauges.",
      src: [IN_S.rain268, IN_S.cwc],
    },
  ],
  lesson: {
    title: "Pimpri-Chinchwad floods",
    where: "Pimpri-Chinchwad, Pune",
    when: "July 2026",
    facts: [
      {
        text: "Chinchwad recorded 268 mm of rain in the 24 hours to 8:30 am on 7 July 2026, its second straight day above 200 mm (206 mm the day before).",
        src: [IN_S.rain268, IN_S.rain206],
      },
      {
        text: "The Pavana, Mula and Indrayani rose fast. More than 1,500 residents were stuck in their homes in Tanajinagar, Keshavnagar and Laxminagar. The Thergaon bridge went under water.",
        src: [IN_S.stuck],
      },
      {
        text: "By noon on 6 July, under an IMD red alert, PCMC had moved 1,880 people out of Ambedkar Colony, Bhat Nagar, River Road, Phugewadi and Kasarwadi.",
        src: [IN_S.moved, IN_S.redAlert],
      },
      {
        text: "Later in July, dam releases rose in announced steps: Pavana from 5,600 to 7,000 cusecs on 24 July, with the dam about 97% full.",
        src: [IN_S.pavana],
      },
    ],
    lesson: {
      text: "The order to warn riverside areas by public announcement came on 6 July, during the flood. The reports we read describe no advance warning to each household in those pockets, though rain totals and dam releases are measured and announced hours ahead.",
      src: [IN_S.redAlert, IN_S.pavana],
    },
  },
  ladder: {
    watch: "IMD colour warnings for Pune district, rain-gauge totals (268 mm in 24 hours at Chinchwad), CWC gauges against the Warning and Danger Levels, and dam-release notices. Each announced release step is a trigger.",
    ask: "Ring the dam flood control cell, ward-office staff and Aapda Mitra volunteers where trained: “Is the water at the Thergaon bridge, or on River Road, where you are?”",
    slow: "Wave 1 is the pockets that flooded in July 2026, then the blue-line zone, then the red-line zone. Routes avoid the Thergaon bridge, Telco Road, Spine Road and the Dehu-Alandi road. Each wave has a named ward shelter.",
    hold: "The commissioner's control room, or the Collector as chair of the district authority, approves the words. VoiceFlare holds only its own calls, never an NDMA, SACHET or IMD message.",
    hand: "People who consented share live GPS with PCMC fire rescue teams, the control room and NDRF. A silent household gets a door knock from the ward office.",
  },
  sources: Object.values(IN_S),
};

// ---------------------------------------------------------------------------------------------------------------
// Japan
// ---------------------------------------------------------------------------------------------------------------

const JP_S = {
  start: {
    claim: "JMA's new system began 29 May 2026, with the alert level in each warning's name (e.g. レベル３大雨警報); Level 5 linked to the mayor's 緊急安全確保",
    url: "https://www.jma.go.jp/jma/kishou/know/bosai/keiho-update2026/index.html",
  },
  names: {
    claim: "Level names for river flood and heavy rain, Level 1 早期注意情報, and 警戒レベル4までに必ず避難; Level 3/4/5 = 高齢者等避難/避難指示/緊急安全確保 (JMA Tokyo Regional HQ)",
    url: "https://www.ktr.mlit.go.jp/ktr_content/content/000951546.pdf",
  },
  english: {
    claim: "Official English: 危険警報 = “Urgent Warning”; “Level N Emergency Warning / Urgent Warning / Warning / Advisory (Flood | Heavy rain)”",
    url: "https://www.jma.go.jp/jma/kishou/know/bosai/keiho-update2026/ppt/english_info2026.docx",
  },
  issuers: {
    claim: "Issuers: about 400 rivers by river office or prefecture with the 気象台; heavy rain by the 気象台; Level 5 氾濫特別警報 issued with 氾濫発生情報; the mayor decides 緊急安全確保",
    url: "https://www.jma.go.jp/jma/kishou/know/bosai/keiho-update2026/pdf/heavyrain_flood_info2026.pdf",
  },
  tenki: {
    claim: "Start on the afternoon of 28 May (legal 29 May) 2026; warnings are not evacuation orders; Level 3/4/5 mapped to evacuation information",
    url: "https://tenki.jp/suppl/m_seta/2026/05/15/32805.html",
  },
  amend2021: {
    claim: "May 2021 amendment merged 避難勧告 into 避難指示; mayors issue evacuation information; municipalities set criteria under the Act and Cabinet Office guidelines",
    url: "https://www.fdma.go.jp/publication/hakusho/r7/chapter1/section5/para2/69311.html",
  },
  jiji: {
    claim: "Evacuation recommendation and order integrated into one order (revised law)",
    url: "https://sp.m.jiji.com/english/show/11974",
  },
  supportList: {
    claim: "避難行動要支援者名簿 mandatory, 1,727 of 1,741 municipalities (99.2%) by 1 Oct 2020; 個別避難計画 a municipal effort obligation since May 2021",
    url: "https://www.fdma.go.jp/publication/hakusho/r3/chapter1/section5/para2/63869.html",
  },
  jalert: {
    claim: "J-ALERT carries missile, earthquake early warning and major tsunami information; starts municipal disaster radio automatically; reaches phones as 緊急速報メール",
    url: "https://www.fdma.go.jp/about/organization/post-18.html",
  },
  areaMail: {
    claim: "Carrier emergency alert mail reaches every compatible phone in the area with national and municipal evacuation information, unaffected by congestion; free for governments from 1 July 2011",
    url: "https://www.docomo.ne.jp/info/notice/tohoku/page/2011/111006_01.html",
  },
  level5: {
    claim: "Level 5 緊急安全確保 may not be issuable",
    url: "https://safetytips-web.rcsc.co.jp/useful_information/flowchart/evacuation/2?lang=en",
  },
  takasaki: {
    claim: "Level 4: everyone leaves dangerous places, by leaving (立ち退き避難) or staying somewhere safe indoors (屋内安全確保)",
    url: "https://www.ktr.mlit.go.jp/takasaki/takasaki00803.html",
  },
  suibo: {
    claim: "水防団 defined under Art. 6 of the Flood Fighting Act; 水防協力団体 designated under Art. 36",
    url: "https://www.mlit.go.jp/river/bousai/main/saigai/jouhou/jieisuibou/pdf/suiboukeikaku_tebiki_pref_2024.pdf",
  },
  shobodan: {
    claim: "消防団 members are non-regular special local public servants who keep other jobs and work with fire staff",
    url: "https://www.pref.kagoshima.jp/aj03/kurashi-kankyo/anzen/shoubou/syobodan/1ninmu.html",
  },
  chiba1: {
    claim: "Chiba, 13 Aug 2026: 6:55 pm call about a man floating on a flooded road in Ichikawa; Level 5 heavy-rain warnings at 7:30 pm; woman in cardiac arrest in a vehicle in Kashiwa",
    url: "https://english.adnkronos.com/2026/08/13/1-dead-1-with-no-sign-of-life-in-downpour-hit-chiba/",
  },
  chiba2: {
    claim: "Municipalities under the Level 5 warning; JMA's Takuya Hosomi: “It is highly likely that some sort of disaster has already occurred”",
    url: "https://english.adnkronos.com/2026/08/13/emergency-heavy-rain-warning-issued-in-chiba/",
  },
  civic: {
    claim: "At least six dead as of 1 pm on 14 Aug 2026; over 7,300 in shelters; about 7,000 stranded at Narita; Disaster Relief Act applied to 25 municipalities",
    url: "https://www.civic-force.org/english/info/news/20260814_eng.html",
  },
  numbers: {
    claim: "119 fire and ambulance, 110 police, 118 Coast Guard",
    url: "https://expatica.com/jp/health/healthcare/japan-emergency-number-79373",
  },
} satisfies Record<string, Source>;

const JP: FloodProfile = {
  code: "JP",
  country: "Japan",
  place: "Chiba",
  lang: "ja",
  scope: "National rules; the flood example is Chiba Prefecture. VoiceFlare's Japan profile on /global is Ōfunato (wildfire).",
  warnings: [
    {
      name: "River flood (河川氾濫)",
      issuer: "For about 400 flood-forecast rivers: the river office (河川事務所) or the prefecture, with the local meteorological observatory (気象台)",
      levels: [
        { local: "レベル2 氾濫注意報", en: "Level 2 Advisory (Flood)" },
        { local: "レベル3 氾濫警報", en: "Level 3 Warning (Flood)" },
        { local: "レベル4 氾濫危険警報", en: "Level 4 Urgent Warning (Flood)", note: "a new tier in 2026" },
        { local: "レベル5 氾濫特別警報", en: "Level 5 Emergency Warning (Flood)", note: "issued with 氾濫発生情報, flood occurring" },
      ],
      src: [JP_S.names, JP_S.english, JP_S.issuers],
    },
    {
      name: "Heavy rain (大雨)",
      issuer: "The local meteorological observatory (気象台); covers flooding from other rivers",
      levels: [
        { local: "レベル2 大雨注意報", en: "Level 2 Advisory (Heavy rain)" },
        { local: "レベル3 大雨警報", en: "Level 3 Warning (Heavy rain)" },
        { local: "レベル4 大雨危険警報", en: "Level 4 Urgent Warning (Heavy rain)" },
        { local: "レベル5 大雨特別警報", en: "Level 5 Emergency Warning (Heavy rain)" },
      ],
      note: "Since 29 May 2026 the alert level is part of each warning's name. Below them, Level 1 早期注意情報 gives early caution up to 5 days ahead.",
      src: [JP_S.start, JP_S.names, JP_S.english, JP_S.issuers, JP_S.tenki],
    },
  ],
  orders: [
    { step: "advisory", terms: [{ local: "早期注意情報・注意報", en: "Level 1 and 2 information" }], src: [JP_S.names] },
    {
      step: "prepare",
      terms: [{ local: "警戒レベル3 高齢者等避難", en: "Level 3: people who need time to evacuate leave now; others prepare" }],
      src: [JP_S.names, JP_S.tenki],
    },
    {
      step: "evacuate",
      terms: [
        { local: "警戒レベル4 避難指示", en: "Level 4: evacuation instruction" },
        { local: "危険な場所から全員避難", en: "everyone leaves dangerous places" },
        { local: "立ち退き避難・屋内安全確保", en: "leave, or stay on a safe upper floor when that is safer" },
      ],
      src: [JP_S.names, JP_S.takasaki],
    },
    {
      step: "shelter",
      terms: [
        { local: "警戒レベル5 緊急安全確保", en: "Level 5: emergency safety measures" },
        { local: "命の危険 直ちに安全確保", en: "danger to life: secure your safety now" },
      ],
      src: [JP_S.names, JP_S.level5],
    },
  ],
  orderNotes: [
    { text: "The core rule: 警戒レベル4までに必ず避難 (evacuate by Level 4, without fail).", src: [JP_S.names] },
    { text: "Level 5 means the disaster is occurring or close; the municipality may not be able to issue it.", src: [JP_S.level5, JP_S.names] },
    { text: "In 2021 the evacuation advisory (避難勧告) was abolished and merged into 避難指示.", src: [JP_S.amend2021, JP_S.jiji] },
  ],
  decider: {
    text: "The mayor (市町村長) issues evacuation information (高齢者等避難, 避難指示, 緊急安全確保) under the Disaster Countermeasures Basic Act. Each municipality sets its own criteria under the Act and Cabinet Office guidelines. JMA and river-office warnings inform the mayor; they are not evacuation orders.",
    src: [JP_S.amend2021, JP_S.tenki, JP_S.issuers],
  },
  channel: {
    text: "Carrier emergency alert mail (緊急速報メール) reaches every compatible phone in the area, unaffected by network congestion, and has been free for governments since 1 July 2011. Municipal disaster radio (防災行政無線) carries the same instructions. J-ALERT relays urgent national alerts (missiles, earthquake early warnings, major tsunami warnings) and starts disaster radio automatically.",
    src: [JP_S.areaMail, JP_S.jalert],
  },
  dose: "The municipality's broadcast area for 緊急速報メール.",
  emergency: {
    call: "119",
    others: "110 police; 118 Japan Coast Guard, at sea",
    note: { text: "119 is fire and ambulance.", src: [JP_S.numbers] },
    src: [JP_S.numbers],
  },
  sentinels: [
    {
      text: "消防団 (volunteer fire corps): local public servants who keep other jobs and work with fire staff on rescue and disaster duty.",
      src: [JP_S.shobodan],
    },
    {
      text: "水防団 (flood-fighting corps) under the Flood Fighting Act (Art. 6), who act at levees on weather and flood information; cooperating groups (水防協力団体) are designated under Art. 36.",
      src: [JP_S.suibo],
    },
    {
      text: "Support lists (避難行動要支援者名簿) of residents who need help to evacuate: 1,727 of 1,741 municipalities (99.2%) had one by 1 October 2020. Since 2021 they must try to write an individual plan (個別避難計画) for each: where to go, and who helps.",
      src: [JP_S.supportList],
    },
  ],
  lesson: {
    title: "Chiba heavy rain",
    where: "Chiba Prefecture",
    when: "13 August 2026",
    facts: [
      { text: "At about 6:55 pm, an emergency call reported a man floating on a flooded road in Ichikawa. He was later confirmed dead.", src: [JP_S.chiba1] },
      {
        text: "At 7:30 pm JMA issued Level 5 Emergency Warnings (Heavy rain) for municipalities including Chiba, Ichikawa, Funabashi, Matsudo, Kashiwa and Inzai.",
        src: [JP_S.chiba1, JP_S.chiba2],
      },
      { text: "A woman in her 70s was found in cardiac arrest in a vehicle on a flooded road in Kashiwa.", src: [JP_S.chiba1] },
      { text: "JMA's forecast chief said: “It is highly likely that some sort of disaster has already occurred.”", src: [JP_S.chiba2] },
      {
        text: "By 1 pm the next day, at least six people had died. More than 7,300 went to shelters and about 7,000 were stranded at Narita Airport.",
        src: [JP_S.civic],
      },
    ],
    lesson: {
      text: "Level 5 means the disaster is likely already under way, and people were in the water on roads before it came. Moving people has to happen at Level 3 and 4, and people in cars on flooded roads are at risk first.",
      src: [JP_S.chiba1, JP_S.chiba2, JP_S.names],
    },
  },
  ladder: {
    watch: "JMA Level 2 to 5 flood and heavy-rain warnings by municipality, river levels on flood-forecast rivers, and Level 1 早期注意情報 up to 5 days ahead as the cue to get ready.",
    ask: "Ring 消防団 and 水防団 members already on the levee or on patrol: “Is water over the road at the underpass?”",
    slow: "Level 3 calls go first to people on the support list, through the helper their plan names. Level 4 waves move block by block from the river inward; each block hears 立ち退き避難 (leave) or 屋内安全確保 (go upstairs). Routes avoid flooded roads and underpasses.",
    hold: "The mayor, or an official the mayor names, approves the exact words, such as 警戒レベル4 避難指示. VoiceFlare holds only its own calls, never J-ALERT, 緊急速報メール or a JMA warning.",
    hand: "At Level 5 the call stops telling people to travel and says to secure their safety now. Live GPS from people who consented goes to 119 and the 消防団; a silent resident on the support list gets a door knock from their helper.",
  },
  sources: Object.values(JP_S),
};

// ---------------------------------------------------------------------------------------------------------------
// China (national flood rules; the repo's China adapter is Chongqing)
// ---------------------------------------------------------------------------------------------------------------

const CN_S = {
  mwrYellow: {
    claim: "MWR Information Centre issued a 洪水黄色预警 on 20 Aug 2026 for nine provinces; advice 远离低洼空间，提前做好转移避险相关准备; MWR Ⅲ/Ⅳ级 flood defence responses",
    url: "https://www.news.cn/20260820/5496adcf74cc4c9db1f35e068944ae34/c.html",
  },
  torrent: {
    claim: "MWR mountain-torrent forecast, monitoring and on-site warnings; 准备转移 / 立即转移; slogan 蓝色多留意、黄色早准备、橙色有序转、红色马上撤; rolling 2-3 hour nowcasts with 叫应 to named responsible units and persons; vulnerable-group relocation lists",
    url: "https://m.gmw.cn/2026-07/27/content_1304538585.htm",
  },
  cmaSignals: {
    claim: "CMA rainstorm warning signals in four levels, blue/yellow/orange/red; orange and red are an instruction to take refuge",
    url: "https://m.gmw.cn/2026-07/24/content_1304537425.htm",
  },
  plan2022: {
    claim: "National Flood Control and Drought Relief Emergency Plan 2022 (国办函〔2022〕48号): response levels; relocation (4.6.2); mountain-torrent evacuation (4.6.3); 紧急防汛期 (4.6.1); village 信号发送员 (3.2.4); township flood staff (2.3); SMS and broadcast channels (5.1.4)",
    url: "https://www.gov.cn/zhengce/content/2022-07/06/content_5699501.htm",
  },
  channels: {
    claim: "The early-warning release system's channels: 12379 SMS and 16 others",
    url: "https://news.ifeng.com/c/7fcsljeKqcM",
  },
  center: {
    claim: "The National Early Warning Information Release Center sits under the CMA Public Meteorological Service Center and began operating in May 2015",
    url: "https://www.rmzxw.com.cn/yw/tx/2015/08/08/549768.shtml",
  },
  guangdong: {
    claim: "Guangdong, June 2025: 群测群防, grid workers, 临灾预警叫应, the five links 谁组织、转移谁、何时转、转何处、不擅返; 112 people moved an hour ahead in Jiayi town (Luoding), 1,200+ in Zhongzhou town (Huaiji), zero casualties",
    url: "https://cn.chinadaily.com.cn/a/202506/24/WS685a1fa0a31009d21e5be322.html",
  },
  zzReport: {
    claim: "Zhengzhou 7·20 investigation report: 398 dead or missing in Henan, 380 in Zhengzhou; 120.06 billion yuan losses; weak warning-response linkage; Metro Line 5 and tunnel deaths were responsibility incidents",
    url: "https://www.chinanews.com.cn/gn/2022/01-21/9658591.shtml",
  },
  zzTiming: {
    claim: "Zhengzhou timing: fifth red warning at 16:01, Level I at 16:30, no emergency flood period; Changzhuang piping from 10:30; over 90% of 251 dead or missing lost 13:00-15:00; 139 deaths concealed",
    url: "https://news.ifeng.com/c/8CzFKQR6ynR",
  },
  waterRescue: {
    claim: "National Fire and Rescue Administration: 462 water-rescue specialist teams, 27,000 people (June 2026)",
    url: "https://www.stdaily.com/web/gdxw/2026-06/17/content_533930.html",
  },
} satisfies Record<string, Source>;

const CN: FloodProfile = {
  code: "CN",
  country: "China",
  place: "Zhengzhou",
  lang: "zh-Hans",
  scope: "National flood rules; the flood lesson is Zhengzhou, Henan. VoiceFlare's China profile on /global is Chongqing (wildfire).",
  warnings: [
    {
      name: "Hydrological flood warnings (洪水预警)",
      issuer: "The MWR Information Centre (水利部信息中心)",
      levels: [],
      note: "Colour-coded. On 20 August 2026 it issued a yellow flood warning (洪水黄色预警) for Hainan, Guangdong, Guangxi, Fujian, Zhejiang, Shanghai, Jiangsu, Shandong and Heilongjiang.",
      src: [CN_S.mwrYellow],
    },
    {
      name: "Mountain-torrent warnings (山洪灾害)",
      issuer: "The Ministry of Water Resources (MWR), with meteorological agencies; rolling 2–3 hour nowcasts round the clock",
      levels: [
        { local: "蓝色多留意", en: "Blue: pay attention", swatch: "blue" },
        { local: "黄色早准备", en: "Yellow: prepare early", swatch: "yellow" },
        { local: "橙色有序转", en: "Orange: move in order", swatch: "orange" },
        { local: "红色马上撤", en: "Red: leave at once", swatch: "red" },
      ],
      note: "After the forecast colours, monitoring and on-site warnings have two levels: 准备转移 (prepare to relocate) and 立即转移 (relocate immediately).",
      src: [CN_S.torrent],
    },
    {
      name: "Rainstorm warning signals (暴雨预警信号)",
      issuer: "China Meteorological Administration (CMA)",
      levels: [
        { en: "Blue", swatch: "blue" },
        { en: "Yellow", swatch: "yellow" },
        { en: "Orange", swatch: "orange" },
        { en: "Red", swatch: "red" },
      ],
      note: "A CMA expert says blue and yellow mean prepare; orange and red are an instruction to take refuge.",
      src: [CN_S.cmaSignals],
    },
    {
      name: "Emergency response levels (应急响应)",
      issuer: "The National Flood Control and Drought Relief Emergency Plan (2022)",
      levels: [
        { local: "四级", en: "Level IV (lowest)" },
        { local: "三级", en: "Level III" },
        { local: "二级", en: "Level II" },
        { local: "一级", en: "Level I (highest)" },
      ],
      note: "Separate from every warning: a response level is what the government does. MWR also runs its own flood defence Level III and IV responses.",
      src: [CN_S.plan2022, CN_S.mwrYellow],
    },
  ],
  orders: [
    {
      step: "advisory",
      terms: [
        { local: "蓝色多留意", en: "blue: pay attention" },
        { local: "远离低洼空间，提前做好转移避险相关准备", en: "stay away from low ground; prepare in advance to relocate" },
      ],
      src: [CN_S.torrent, CN_S.mwrYellow],
    },
    {
      step: "prepare",
      terms: [
        { local: "准备转移", en: "prepare to relocate" },
        { local: "黄色早准备", en: "yellow: prepare early" },
      ],
      src: [CN_S.torrent],
    },
    {
      step: "evacuate",
      terms: [
        { local: "立即转移", en: "relocate immediately" },
        { local: "橙色有序转", en: "orange: move in order" },
        { local: "红色马上撤", en: "red: leave at once" },
        { local: "转移安置危险区域人员", en: "relocate and resettle people in danger areas", note: "national plan" },
      ],
      src: [CN_S.torrent, CN_S.plan2022],
    },
    { step: "shelter", terms: [], src: [] },
  ],
  orderNotes: [
    {
      text: "Local practice spells out five links for every relocation: 谁组织、转移谁、何时转、转何处、不擅返 (who organises, who moves, when, to where, no return without leave).",
      src: [CN_S.guangdong],
    },
    { text: "A colour is a hazard level, not an order: a red warning does not by itself move anyone.", src: [CN_S.plan2022] },
  ],
  decider: {
    text: "Local governments and their flood control and drought relief headquarters (防汛抗旱指挥部). Under the 2022 national plan, the local headquarters relocates people from danger areas in urban waterlogging, township governments organise the safe evacuation of people threatened by mountain torrents, and headquarters at county level and above may declare an emergency flood period (紧急防汛期).",
    src: [CN_S.plan2022],
  },
  channel: {
    text: "The National Emergency Early-Warning Information Release System (国家突发事件预警信息发布系统), run since May 2015 by a national centre under the CMA. It sends warnings through 17 channels, including 12379 SMS, phone calls, village loudspeakers (大喇叭), radio, TV, social media and air-raid sirens. The 2022 flood plan says to use broadcast, TV, new media and mobile SMS.",
    src: [CN_S.channels, CN_S.center, CN_S.plan2022],
  },
  dose: "The 12379 and carrier SMS audience for the area.",
  emergency: {
    call: JURISDICTIONS.CN.call_now,
    others: profileNumbers("CN"),
    note: {
      text: "119 fire and rescue also does flood and water rescue: 462 specialist water-rescue teams, 27,000 people, as of June 2026.",
      src: [CN_S.waterRescue],
    },
    src: [],
    fromProfile: true,
  },
  sentinels: [
    {
      text: "Village signal senders (信号发送员): every village or community in mountain-torrent areas must have them, to warn nearby residents as soon as danger signs appear (2022 plan, 3.2.4).",
      src: [CN_S.plan2022],
    },
    {
      text: "Grid workers (网格员) in the mass-monitoring system (群测群防), with the call-and-respond practice (临灾预警叫应). In Guangdong in June 2025, grid workers in Jiayi town (Luoding) moved 112 people an hour ahead, and more than 1,200 were moved in Zhongzhou town (Huaiji), with no casualties.",
      src: [CN_S.guangdong],
    },
    { text: "Named responsible units and persons (责任单位和责任人), whom MWR rings after each 2–3 hour nowcast.", src: [CN_S.torrent] },
    { text: "Flood staff named by each township government (2022 plan, 2.3).", src: [CN_S.plan2022] },
  ],
  lesson: {
    title: "Zhengzhou “7·20” rainstorm",
    where: "Zhengzhou, Henan",
    when: "20 July 2021",
    facts: [
      {
        text: "The State Council investigation, published on 21 January 2022, found 398 dead or missing in Henan, 380 of them in Zhengzhou, and 120.06 billion yuan in direct losses. It found 139 deaths had been concealed.",
        src: [CN_S.zzReport, CN_S.zzTiming],
      },
      {
        text: "The weather service issued five red rainstorm warnings. Zhengzhou started its Level I response at 16:30, only after the fifth, at 16:01. It never declared the emergency flood period the plan required.",
        src: [CN_S.zzTiming],
      },
      { text: "Piping (管涌) at Changzhuang reservoir from 10:30 had not triggered Level I.", src: [CN_S.zzTiming] },
      { text: "In four hilly cities, more than 90% of the 251 dead or missing were lost between 13:00 and 15:00, before Level I began.", src: [CN_S.zzTiming] },
    ],
    lesson: {
      text: "The report named a weak link between warning and response (预警与响应联动机制不健全) and called for managing them as one (强化预警和响应一体化管理). Warnings sat for hours without a decision.",
      src: [CN_S.zzReport, CN_S.zzTiming],
    },
  },
  ladder: {
    watch: "MWR flood and mountain-torrent warnings, CMA rainstorm signals and reservoir dangers (such as the Changzhuang piping) are triggers, never orders.",
    ask: "This is 叫应: ring the named responsible persons, village signal senders and grid workers at the zone's edge, and require a spoken answer.",
    slow: "Low ground, basements and underground spaces first, and MWR's vulnerable lists first (schools, hospitals, elder-care homes, construction sites). Each wave fills the five links. Routes avoid flooded roads, underpasses and gorges.",
    hold: "Zhengzhou is the case for a short, named hold: warnings sat for hours with no decision. The 90-second clock asks the headquarters duty leader to decide, and records a name and a reason.",
    hand: "Live GPS from trapped people who consented goes to 119 water-rescue teams.",
  },
  sources: Object.values(CN_S),
};

// ---------------------------------------------------------------------------------------------------------------
// Greece (EU), with Spain's Valencia DANA 2024 as the EU lesson
// ---------------------------------------------------------------------------------------------------------------

const GR_S = {
  patras: {
    claim: "Patras special flood evacuation plan (April 2026), under Law 4662/2020: the mayor decides, the regional governor if more than one municipality; flash floods are rescue led by the Fire Service; 112 via ΕΣΚΕΔΙΚ; English 112; door to door with loudspeakers; on-site refuge; police lead notification with volunteers",
    url: "https://e-patras.gr/sites/default/files/2026-04/%CE%95%CE%99%CE%94%CE%99%CE%9A%CE%9F%20%CE%A3%CE%A7%CE%95%CE%94%CE%99%CE%9F%20%20O%CE%A1%CE%93%CE%91%CE%9D%CE%A9%CE%9C%CE%95%CE%9D%CE%97%CE%A3%20%CE%A0%CE%A1%CE%9F%CE%9B%CE%97%CE%A0%CE%A4%CE%99%CE%9A%CE%97%CE%A3%20%CE%91%CE%A0%CE%9F%CE%9C%CE%91%CE%9A%CE%A1%CE%A5%CE%9D%CE%A3%CE%97%CE%A3%20%CE%A0%CE%9F%CE%9B%CE%99%CE%A4%CE%A9%CE%9D%20%CE%9B%CE%9F%CE%93%CE%A9%20%CE%A0%CE%9B%CE%97%CE%9C%CE%9C%CE%A5%CE%A1%CE%99%CE%9A%CE%A9%CE%9D%20%CE%A6%CE%91%CE%99%CE%9D%CE%9F%CE%9C%CE%95%CE%9D%CE%A9%CE%9D.pdf",
  },
  edekf: {
    claim: "ΕΜΥ emergency bulletin of dangerous weather (Ε.Δ.Ε.Κ.Φ.) 5/2026, July 2026",
    url: "https://dimos-lokron.gov.gr/wp-content/uploads/2026/07/δελτιο-τυπου-εδεκφ-5-23.7.2026.pdf",
  },
  redCode: {
    claim: "Civil protection Risk Assessment Committee and red-code mobilisation for 11 areas (July 2026)",
    url: "https://www.tanea.gr/2026/07/23/epikairotita/se-red-code-11-perioxes-gia-tin-eperxomeni-kakokairia-systaseis-tis-politikis-prostasias/",
  },
  registry: {
    claim: "Unified Civil Protection Volunteering Registry and its registers under Law 4662/2020",
    url: "https://www.taxheaven.gr/law/4662/2020/arthro/71",
  },
  daniel112: {
    claim: "Storm Daniel: 112 messages to Pieria, Thessaly, the Sporades, Evia and Fthiotida; Thessaloniki asked to limit movements (4 Sep 2023)",
    url: "https://www.iefimerida.gr/ellada/kakokairia-daniel-112-plimmyres",
  },
  danielToll: {
    claim: "Storm Daniel: 14 dead, 3 missing, more than 4,250 evacuated as of 10 Sep 2023; most intense rainstorm since records began in 1930",
    url: "https://cyprus-mail.com/2023/09/10/three-more-bodies-found-after-greece-storm-raising-toll-to-14",
  },
  efasFaq: {
    claim: "EFAS notifications go to registered partners and the ERCC, are not public warnings, and follow the single-voice principle",
    url: "https://european-flood.emergency.copernicus.eu/faq",
  },
  efasOct: {
    claim: "EFAS in October 2024: 38 formal and 43 informal flood notifications, 262 flash-flood notifications",
    url: "https://european-flood.emergency.copernicus.eu/en/node/1107",
  },
  eecc: {
    claim: "Article 110 of the European Electronic Communications Code makes mobile public warning (reverse 112) mandatory in member states",
    url: "https://www.ctif.org/news/european-parliament-makes-reverse-112-public-warning-systems-mandatory-mobile-phones-all",
  },
  esAlert: {
    claim: "ES-Alert, cell broadcast, nationwide from February 2023, run through the national CENEM and the regional emergency centres",
    url: "https://www.interior.gob.es/opencms/es/detalle/articulo/El-sistema-de-avisos-a-la-poblacion-ante-emergencias-estara-operativo-desde-manana-en-toda-Espana/",
  },
  draft1837: {
    claim: "Valencia: the Generalitat had the ES-Alert draft at 18:37 (“permanezcan en sus domicilios”); sent later, per documents sent to the Catarroja judge",
    url: "https://www.elindependiente.com/espana/2025/11/07/la-generalitat-ya-tenia-listo-el-es-alert-de-la-dana-a-las-1837-pero-se-envio-mas-tarde/amp/",
  },
  sent2011: {
    claim: "The alert reached phones at 20:11, when many of the deaths had already happened; the red alert had been decreed early that morning",
    url: "https://en.ara.cat/environment/the-valencian-generalitat-is-late-again-and-sends-the-alert-more-than-an-hour-after-the-torrential-rains-started_1_5852509.html",
  },
  toll232: {
    claim: "The Catarroja court raises the official DANA death toll to 232 (September 2026)",
    url: "https://www.moncloa.com/2026/09/03/juzgado-catarroja-232-victimas-dana-valencia-3425322/",
  },
  turis: {
    claim: "Turís: 771 l/m² in 24 hours, 185 in one hour, a Spanish record for that duration; wettest October since 1961",
    url: "https://www.aemet.es/en/noticias/2024/11/resumen_oct24",
  },
  chj: {
    claim: "Júcar basin (SAIH) operator: e-mails around 18:43, an internal rule since 2015 to e-mail rather than call, reading not confirmed, 25 rain gauges watched",
    url: "https://www.eldebate.com/espana/comunidad-valenciana/20260608/operadora-chj-reconoce-ante-jueza-dana-no-alertaron-cecopi-crecida-poyo_426489.html",
  },
} satisfies Record<string, Source>;

const GR: FloodProfile = {
  code: "EU-GR",
  country: "Greece (EU)",
  place: "Thessaly · Valencia",
  lang: "el",
  scope: "Greek rules, with Spain's Valencia flood of 2024 as the EU lesson. VoiceFlare's Greece profile on /global is Rhodes (wildfire).",
  warnings: [
    {
      name: "Emergency weather bulletins",
      issuer: "Hellenic National Meteorological Service (ΕΜΥ)",
      levels: [],
      note: "The Έκτακτο Δελτίο Επικίνδυνων Καιρικών Φαινομένων (Ε.Δ.Ε.Κ.Φ.), an emergency bulletin of dangerous weather with colour-coded warnings. Bulletin 5/2026, in July 2026, carried a red warning.",
      src: [GR_S.edekf],
    },
    {
      name: "Civil protection mobilisation",
      issuer: "General Secretariat for Civil Protection (ΓΓΠΠ)",
      levels: [],
      note: "On such a bulletin its Risk Assessment Committee meets and declares named areas “red code”, and tells regions and municipalities to be in αυξημένη ετοιμότητα (heightened readiness).",
      src: [GR_S.redCode],
    },
    {
      name: "EFAS flood notifications (EU)",
      issuer: "Copernicus European Flood Awareness System",
      levels: [],
      note: "Flood and flash-flood notifications go to registered national and regional authorities and the EU's Emergency Response Coordination Centre. They are expert notices, not public warnings, and are not made public unless the national authority decides to. In October 2024 EFAS sent 38 formal and 43 informal flood notifications and 262 flash-flood notifications across Europe.",
      src: [GR_S.efasFaq, GR_S.efasOct],
    },
  ],
  orders: [
    {
      step: "advisory",
      terms: [{ local: "να περιορίσουν τις μετακινήσεις τους", en: "limit your movements", note: "112 messages before Storm Daniel, 2023" }],
      src: [GR_S.daniel112],
    },
    { step: "prepare", terms: [{ local: "αυξημένη ετοιμότητα", en: "heightened readiness", note: "for authorities" }], src: [GR_S.redCode] },
    {
      step: "evacuate",
      terms: [
        {
          local: "Οργανωμένη προληπτική απομάκρυνση πολιτών",
          en: "organised preventive evacuation of citizens",
          note: "Law 4662/2020. Not compulsory: it rests on telling people the risk of staying. For river and plain floods, not flash floods.",
        },
      ],
      src: [GR_S.patras],
    },
    {
      step: "shelter",
      terms: [
        { local: "ασφαλής επιτόπου καταφυγή", en: "safe on-site refuge, on the upper floors of multi-storey concrete or steel buildings" },
        { local: "μέτρα αυτοπροστασίας", en: "self-protection measures, by 112, in a flash flood" },
        { local: "permanezcan en sus domicilios", lang: "es", en: "stay in your homes", note: "Spain's ES-Alert draft, Valencia, 18:37 on 29 Oct 2024" },
      ],
      src: [GR_S.patras, GR_S.draft1837],
    },
  ],
  orderNotes: [
    {
      text: "In a flash flood, moving people becomes a rescue operation (έργο διάσωσης), led by the senior Fire Service officer on scene.",
      src: [GR_S.patras],
    },
  ],
  decider: {
    text: "The mayor (Δήμαρχος) decides an organised evacuation (Law 4662/2020, Art. 29(4)(f)); if more than one municipality may be hit, the regional governor (Περιφερειάρχης). The mayor and the national coordination centre (Ε.Σ.Κ.Ε.ΔΙ.Κ.) set the area and text of the 112 message. Police find and notify residents, with municipal staff and volunteers. In Valencia, the regional government ran the emergency.",
    src: [GR_S.patras, GR_S.draft1837, GR_S.sent2011],
  },
  channel: {
    text: "112 emergency messages (μηνύματα έκτακτης ανάγκης 112): geo-targeted mass messages from ΕΣΚΕΔΙΚ, with an English version where there are tourists. The Patras flood plan keeps the main way local: door to door, and municipal and police vehicles with loudspeakers giving safe routes. EU law (Art. 110 of the European Electronic Communications Code) requires mobile public warning in every member state; Spain's ES-Alert is cell broadcast, nationwide since February 2023.",
    src: [GR_S.patras, GR_S.eecc, GR_S.esAlert],
  },
  dose: "The 112 message area that the mayor and ΕΣΚΕΔΙΚ set.",
  emergency: {
    call: JURISDICTIONS["EU-GR"].call_now,
    others: profileNumbers("EU-GR"),
    note: { text: "The Fire Service leads flash-flood rescue.", src: [GR_S.patras] },
    src: [],
    fromProfile: true,
  },
  sentinels: [
    {
      text: "Registered civil protection volunteers: the Unified Civil Protection Volunteering Registry (Ε.Μ.Ε.Π.Π.) under Law 4662/2020, with registers for organisations and individuals. They help police door to door when the mayor calls them out.",
      src: [GR_S.registry, GR_S.patras],
    },
    { text: "Municipal civil protection departments, which keep lists of buildings fit for on-site refuge.", src: [GR_S.patras] },
    {
      text: "Spain's lesson: the Júcar basin's automatic gauge network (SAIH). On 29 October 2024 its staff watched 25 rain gauges, did not watch the Poyo ravine continuously, and around 18:43 sent e-mails rather than calling, under an internal rule from 2015. They could not confirm the e-mails were read.",
      src: [GR_S.chj],
    },
  ],
  lesson: {
    title: "Valencia DANA (the EU lesson)",
    where: "Valencia, Spain",
    when: "29 October 2024",
    facts: [
      { text: "AEMET recorded 771 l/m² of rain in 24 hours at Turís, 185 of them in one hour, a Spanish record for that duration.", src: [GR_S.turis] },
      { text: "AEMET's red warning had been in force since the morning.", src: [GR_S.sent2011] },
      {
        text: "The regional emergency centre had an ES-Alert draft by e-mail at 18:37. It reached phones at 20:11, when many of the deaths had already happened.",
        src: [GR_S.draft1837, GR_S.sent2011],
      },
      { text: "The basin authority's warning that the Poyo ravine was rising went out around 18:43, by e-mail, with no confirmed read.", src: [GR_S.chj] },
      { text: "The Catarroja court's official count reached 232 deaths (September 2026).", src: [GR_S.toll232] },
    ],
    lesson: {
      text: "A gauge signal that nobody acknowledged, and a drafted alert held about 94 minutes with no named, logged decision, cost the time that mattered.",
      src: [GR_S.chj, GR_S.draft1837, GR_S.sent2011],
    },
    also: {
      title: "Greece: Storm Daniel, September 2023",
      facts: [
        {
          text: "On 4 September, ahead of the storm, 112 messages went to Pieria, Thessaly, the Sporades, Evia and Fthiotida, and Thessaloniki was told to limit movements.",
          src: [GR_S.daniel112],
        },
        {
          text: "By 10 September, 14 people were dead and 3 missing, and more than 4,250 had been evacuated, in the most intense rainstorm since records began in 1930.",
          src: [GR_S.danielToll],
        },
      ],
    },
  },
  ladder: {
    watch: "ΕΜΥ emergency bulletins, the civil protection mobilisation, basin gauges, and EFAS notices. EFAS notices are for experts: VoiceFlare uses them to watch and never repeats them to the public.",
    ask: "Ring municipal civil protection staff, registered volunteers and police at the zone's edge, and require a spoken answer, not an unread e-mail.",
    slow: "River and plain floods: organised evacuation block by block, lowest ground first, on routes clear of streams and underpasses. Flash floods: nobody is moved; a 112 self-protection message and upper floors in listed buildings. An English version goes to tourist areas.",
    hold: "The mayor, or the regional governor when more than one municipality is hit, approves; ΕΣΚΕΔΙΚ sets the 112 area and text, and the ledger keeps both names. VoiceFlare never holds a 112 message. A 90-second hold with a name and a reason is the answer to Valencia's 18:37-to-20:11 gap.",
    hand: "Flash-flood rescue is led by the Fire Service, so live GPS from trapped people who consented goes there.",
  },
  sources: Object.values(GR_S),
};

// ---------------------------------------------------------------------------------------------------------------
// California, USA
// ---------------------------------------------------------------------------------------------------------------

const US_S = {
  nwsDefs: { claim: "NWS definitions of Flood Advisory, Flood Watch, Flood Warning and Flash Flood Warning", url: "https://www.weather.gov/safety/flood-watch-warning" },
  ffe: { claim: "NWS definition of Flash Flood Emergency (exceedingly rare, severe threat to human life, catastrophic damage)", url: "https://www.weather.gov/mob/severe_flood" },
  ffeAly: { claim: "Flash Flood Emergency definition (NWS Albany)", url: "https://www.weather.gov/aly/preparedness" },
  calOes: {
    claim: "Cal OES standard evacuation terms (May 2020): Evacuation Warning, Evacuation Order, Shelter in Place, Lifted",
    url: "https://www.malibucity.org/DocumentCenter/View/26770/05_28_2020_CALOES_EvacuationTerminology_PressRelease",
  },
  roseville: { claim: "City of Roseville page quoting California's standard evacuation terms", url: "https://www.roseville.ca.gov/emergency_preparedness/evacuation_terminology/index.php" },
  firescope: {
    claim: "FIRESCOPE Evacuation Terminology Working Group white paper",
    url: "https://firescope.caloes.ca.gov/ICS%20Documents/FIRESCOPE%20Evacuation%20Terminology%20Working%20Group%20White%20Paper.pdf",
  },
  fresno: {
    claim: "Penal Code 409.5: a sheriff or police chief can close an area, and so order an evacuation; no crime for a person who stays home after the closure",
    url: "https://fresnosheriff.org/community/fire-season-information/fresno-county-sheriff-s-office-evacuation-guidelines.html",
  },
  calOesLegal: {
    claim: "Cal OES legal guidelines for flood evacuation",
    url: "https://www.caloes.ca.gov/wp-content/uploads/Preparedness/Documents/02-FEAT-LegalGuidelinesforFloodEvacuationFEAT-doc.pdf",
  },
  weaFaq: {
    claim: "WEA 90- and 360-character limits; Spanish shown only on phones set to Spanish; no automatic translation",
    url: "https://www.fcc.gov/wireless-emergency-alert-enhancements-faqs-authorized-alert-originators",
  },
  fccEas: { claim: "FCC multilingual alerting for EAS and WEA", url: "https://www.fcc.gov/MultilingualAlerting_EAS-WEA" },
  ipaws: {
    claim: "FEMA IPAWS Wireless Emergency Alerts",
    url: "https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/public/wireless-emergency-alerts",
  },
  calAlerts: { claim: "CalAlerts.org: Cal OES directory of county alert sign-ups", url: "https://www.calalerts.org/evacuations.html" },
  skywarn: { claim: "SKYWARN spotters: free training; they coordinate with local emergency managers", url: "https://www.weather.gov/gsp/skywarn" },
  cocorahs: { claim: "CoCoRaHS in California: since 2008; more than 1,000 observers as of spring 2020", url: "https://www.weather.gov/mtr/cocorahs" },
  cert: {
    claim: "California's CERT program is run by Cal OES",
    url: "https://www.caloes.ca.gov/office-of-the-director/operations/planning-preparedness-prevention/community-emergency-response-team/",
  },
  cnrfcData: { claim: "CNRFC river and reservoir data: more than 1,000 stations, updated every 10 minutes", url: "https://www.cnrfc.noaa.gov/river_data.php" },
  cnrfcGuidance: { claim: "CNRFC river guidance issued jointly with California DWR", url: "https://www.cnrfc.noaa.gov/rfc_guidance.php" },
  cdec: { claim: "CDEC real-time river stage maps and data", url: "https://cdec.water.ca.gov/stage_maps/" },
  pajaro: {
    claim: "Pajaro levee breach around midnight on 10 March 2023; more than 8,500 under orders or warnings; about 1,700 Pajaro residents, many Latino farmworkers; door to door on Friday afternoon; more than 50 rescued (AP)",
    url: "https://www.ksat.com/news/2023/03/11/storm-breaches-california-rivers-levee-thousands-evacuate/",
  },
  texas: {
    claim: "Texas, July 2025: Flash Flood Warning for Kerr County at 1:14 a.m.; NWS summary counts 139 deaths, 119 along the Guadalupe",
    url: "https://www.kxan.com/independence-day-floods/national-weather-service-releases-new-report-on-deadly-central-texas-floods/amp/",
  },
  oig: {
    claim: "Commerce OIG review OIG-26-017-I (9 April 2026): multiple flood alerts on 3 and 4 July; no recommendations",
    url: "https://www.oversight.gov/reports/review-national-weather-services-actions-support-kerr-county-during-catastrophic-flash",
  },
} satisfies Record<string, Source>;

const US: FloodProfile = {
  code: "US-CA",
  country: "United States",
  place: "California",
  lang: null,
  scope: "California rules; the flood example is the Pajaro River, Monterey County. VoiceFlare's built adapter is Los Angeles.",
  warnings: [
    {
      name: "Flood products",
      issuer: "National Weather Service (NWS)",
      levels: [
        { en: "Flood Advisory", note: "may become a nuisance; stay alert" },
        { en: "Flood Watch", note: "conditions are favorable; flooding is possible; get prepared" },
        { en: "Flood Warning", note: "imminent or already happening; act now" },
        { en: "Flash Flood Warning", note: "a flash flood is imminent or occurring; move to higher ground now" },
        { en: "Flash Flood Emergency", note: "exceedingly rare: a severe threat to life and catastrophic damage" },
      ],
      src: [US_S.nwsDefs, US_S.ffe, US_S.ffeAly],
    },
    {
      name: "River and reservoir forecasts",
      issuer: "NWS California Nevada River Forecast Center (CNRFC), with the California Department of Water Resources",
      levels: [],
      note: "More than 1,000 river and reservoir stations, updated every 10 minutes. Live river stage is published on CDEC, the California Data Exchange Center.",
      src: [US_S.cnrfcData, US_S.cnrfcGuidance, US_S.cdec],
    },
  ],
  orders: [
    { step: "advisory", terms: [{ en: "Flood Advisory · Flood Watch", note: "NWS" }], src: [US_S.nwsDefs] },
    {
      step: "prepare",
      terms: [
        {
          en: "Evacuation Warning",
          note: "“Potential threat to life and/or property. Those who require additional time to evacuate, and those with pets and livestock should leave now.”",
        },
      ],
      src: [US_S.calOes, US_S.roseville],
    },
    {
      step: "evacuate",
      terms: [{ en: "Evacuation Order", note: "“Immediate threat to life. This is a lawful order to leave now. The area is lawfully closed to public access.”" }],
      src: [US_S.calOes, US_S.roseville],
    },
    {
      step: "shelter",
      terms: [
        {
          en: "Shelter in Place",
          note: "“Go indoors. Shut and lock doors and windows. Prepare to self-sustain until further notice and/or contacted by emergency personnel for additional direction.”",
        },
      ],
      src: [US_S.calOes, US_S.roseville],
    },
  ],
  orderNotes: [
    {
      text: "California's standard terms, recommended by Cal OES in May 2020 and used by local agencies for every hazard. “Evacuation Order(s) Lifted” ends an evacuation.",
      src: [US_S.calOes, US_S.roseville, US_S.firescope],
    },
  ],
  decider: {
    text: "Local officials, not the NWS, which issues weather warnings only. Under Penal Code 409.5 a sheriff or police chief can close an area threatened by a flood, and that is how an evacuation is ordered. A fire or incident commander often decides; law enforcement carries it out. Per the Fresno County Sheriff, a person already home before the closure commits no crime by staying.",
    src: [US_S.fresno, US_S.calOesLegal],
  },
  channel: {
    text: "Wireless Emergency Alerts (WEA) through FEMA's IPAWS, the Emergency Alert System on radio and TV, and each county's opt-in alerts (listed at CalAlerts.org). A WEA has a 90-character message and may add a 360-character one. A Spanish version is optional, shows only on phones set to Spanish, and nobody translates it for the sender.",
    src: [US_S.ipaws, US_S.fccEas, US_S.weaFaq, US_S.calAlerts],
  },
  dose: "The WEA polygon, or the county alert list for the zone.",
  emergency: { call: JURISDICTIONS["US-CA"].call_now, others: "", src: [], fromProfile: true },
  sentinels: [
    { text: "SKYWARN storm spotters: free NWS training; volunteers report hazardous weather to the NWS and often work with county emergency managers.", src: [US_S.skywarn] },
    { text: "CoCoRaHS volunteers, who read a standard rain gauge every morning; California joined in 2008 and had over 1,000 observers in spring 2020.", src: [US_S.cocorahs] },
    { text: "CERT members: California's Community Emergency Response Team program is run by Cal OES.", src: [US_S.cert] },
    { text: "Machine sentinels: more than 1,000 CNRFC river and reservoir stations, and CDEC's live river stage.", src: [US_S.cnrfcData, US_S.cdec] },
  ],
  lesson: {
    title: "Pajaro River levee breach",
    where: "Pajaro, Monterey County",
    when: "March 2023",
    facts: [
      { text: "The levee broke around midnight on 10 March 2023, opening a gap about 100 ft (30 m) wide.", src: [US_S.pajaro] },
      {
        text: "More than 8,500 people in Monterey County were under evacuation orders or warnings, including about 1,700 residents of Pajaro, many of them Latino farmworkers.",
        src: [US_S.pajaro],
      },
      {
        text: "Crews went door to door on the Friday afternoon to urge people to leave. Some stayed and had to be pulled from floodwater; first responders and the National Guard rescued more than 50 people overnight (AP).",
        src: [US_S.pajaro],
      },
    ],
    lesson: {
      text: "An order and a door knock still left people behind. VoiceFlare adds a follow-up call when someone does not answer, words in the person's language (Spanish here), and a rescue list with GPS for those who stay.",
      src: [US_S.pajaro],
    },
    also: {
      title: "Texas Hill Country, July 2025 (not California)",
      facts: [
        {
          text: "The NWS issued a Flash Flood Warning for Kerr County at 1:14 a.m. on 4 July. An NWS summary counts 139 deaths across Central Texas, 119 of them along the Guadalupe River.",
          src: [US_S.texas],
        },
        {
          text: "The Commerce Inspector General found the Austin/San Antonio NWS office issued multiple flood alerts on 3 and 4 July, and made no recommendations. The warning existed; reaching people in the middle of the night was the gap.",
          src: [US_S.oig],
        },
      ],
    },
  },
  ladder: {
    watch: "NWS Flood Watch and Flash Flood Warning feeds, CNRFC river and reservoir forecasts (which show coming dam releases), CDEC river stage, and CoCoRaHS morning rain totals.",
    ask: "Ring SKYWARN spotters, CoCoRaHS observers and CERT members at the zone's edge: “Does this match what you see?”",
    slow: "The Evacuation Warning already says those who need more time leave now, so low-lying blocks go first. Then the Evacuation Order goes block by block, on exit roads away from flooded streets and low-water crossings.",
    hold: "The sheriff's or county official who owns the order approves. VoiceFlare delays only its own calls and county alert, never an NWS alert. The words use the exact state terms, fit the 90- and 360-character limits, and come with Spanish.",
    hand: "People who consented share live GPS with 911 and swiftwater rescue. Silence gets a retry, then a linked contact, then a door knock.",
  },
  sources: Object.values(US_S),
};

// ---------------------------------------------------------------------------------------------------------------
// Australia (flood example: New South Wales; the repo's adapter is East Gippsland, Victoria)
// ---------------------------------------------------------------------------------------------------------------

const AU_S = {
  bom: {
    claim: "BoM Flood Watch (not a warning of imminent flooding, up to four days ahead); Minor, Moderate and Major definitions; Severe Weather Warnings for flash flooding",
    url: "https://www.bom.gov.au/water/floods/floodWarningServices.shtml",
  },
  aws: { claim: "Australian Warning System levels and calls to action, including flood statements", url: "https://knowledge.aidr.org.au/resources/australian-warning-system/" },
  sesWarnings: {
    claim: "NSW SES warning levels and colours, “Evacuate now” at Emergency Warning, Hazards Near Me, Emergency Alert by text and voice; uses BoM flood warnings",
    url: "https://www.ses.nsw.gov.au/understand-warnings",
  },
  aws2022: {
    claim: "NSW SES moved to the AWS for floods on 30 September 2022, from seven levels to three",
    url: "https://www.abc.net.au/news/2022-09-29/nsw-new-flood-warning-system-after-horror-season/101485482",
  },
  ses9pm: {
    claim: "NSW SES wording “emergency warning to evacuate by 9pm tonight” (6 March 2025)",
    url: "https://www.ses.nsw.gov.au/news/nsw-ses-evacuates-parts-northern-rivers",
  },
  floodPlan: {
    claim: "NSW State Flood Plan: NSW SES is the Combat Agency for floods; approved 14 November 2024",
    url: "https://www.ses.nsw.gov.au/sites/default/files/document/2024-nsw-state-flood-plan.pdf",
  },
  sesWhat: { claim: "NSW SES manages the response to floods, storms and tsunami; 132 500", url: "https://www.ses.nsw.gov.au/about-us/what-we-do" },
  tripleZero: { claim: "000; 112 from mobiles; 106 for TTY; no texting", url: "https://www.triplezero.gov.au/triple-zero/other-emergency-numbers" },
  acma: { claim: "Emergency calls (ACMA)", url: "https://www.acma.gov.au/emergency-calls" },
  ausAlert: { claim: "AusAlert national cell broadcast; national test 27 July 2026; planned launch 1 October 2026", url: "https://en.wikipedia.org/wiki/AusAlert" },
  ausAlertDeck: {
    claim: "AusAlert runs alongside Emergency Alert until at least July 2027 (NEMA webinar)",
    url: "https://wesnet.org.au/wp-content/uploads/sites/3/2026/06/Wesnet-NEMA_AusAlert-Webinar_02062026.pdf",
  },
  nema: { claim: "NEMA AusAlert page", url: "https://www.nema.gov.au/our-work/risk-reduction/ausalert" },
  bomVolunteers: {
    claim: "BoM volunteers collect data from about 5,900 rainfall stations and more than 1,000 river height gauges",
    url: "https://media.bom.gov.au/social/blog/853/volunteer-weather-observers-more-than-100-years-of-vital-data-collection/",
  },
  lismore: {
    claim: "Lismore: 14.4 m on 28 February 2022, the highest on record; previous record 12.11 m (1954, 1974)",
    url: "https://www.lismore.nsw.gov.au/Community/Natural-hazards-and-emergencies/Floods/Past-floods",
  },
  aidr: {
    claim: "NSW 2022 floods: 13 deaths; more than 2,200 rescue activations, 862 in Lismore on 28 February; BoM forecast minor to moderate two days before; the Tinny Army",
    url: "https://knowledge.aidr.org.au/resources/flood-flooding-new-south-wales-2022/",
  },
  inquiry: {
    claim: "Inquiry: failures to give timely warnings; community rescues outnumbered SES rescues; evacuation orders should not signal rescues",
    url: "https://www.abc.net.au/news/2022-08-17/key-takeaways-from-2022-nsw-flood-inquiry/101342094",
  },
  inquiryReport: {
    claim: "Inquiry report released; local first-responder program recommended; boats and jet skis; all 28 recommendations accepted",
    url: "https://www.abc.net.au/news/2022-08-17/nsw-independent-flood-inquiry-report-made-public/101331288",
  },
  parliament: {
    claim: "NSW parliamentary inquiry: warnings out of date, inaccurate and confusing; unanswered 000 and SES calls",
    url: "https://www.abc.net.au/news/2022-08-09/nsw-parliamentary-flood-inquiry-report-finds-agencies-failed/101302802",
  },
  inquiryVolumes: { claim: "2022 Flood Inquiry volumes (summary, full report, appendices)", url: "https://apo.org.au/node/319043" },
} satisfies Record<string, Source>;

const AU: FloodProfile = {
  code: "AU",
  country: "Australia",
  place: "Lismore",
  lang: null,
  scope: "The flood example is New South Wales. VoiceFlare's Australia profile on /global is East Gippsland, Victoria (bushfire); each state has its own arrangements.",
  warnings: [
    {
      name: "Flood Watch and Flood Warning",
      issuer: "Bureau of Meteorology (BoM)",
      levels: [
        { en: "Flood Watch", note: "early advice that flooding may develop, up to four days ahead; not a warning of imminent flooding" },
        { en: "Minor flooding", note: "“causes inconvenience”" },
        { en: "Moderate flooding", note: "main traffic routes may be affected; evacuation may be required" },
        { en: "Major flooding", note: "towns likely isolated; major rail and traffic routes closed" },
      ],
      note: "Flood Warnings give predicted levels and peak times at key gauges. Severe Weather Warnings cover flash flooding.",
      src: [AU_S.bom],
    },
    {
      name: "Australian Warning System",
      issuer: "State emergency services (NSW SES for floods in New South Wales)",
      levels: [
        { en: "Advice", swatch: "yellow", note: "an incident has started; stay up to date" },
        { en: "Watch and Act", swatch: "orange", note: "conditions are changing; start taking action now" },
        { en: "Emergency Warning", swatch: "red", note: "“You may be in danger and need to take action immediately. Any delay now puts your life at risk.”" },
      ],
      note: "NSW SES moved flood warnings onto this system on 30 September 2022, cutting seven levels to three.",
      src: [AU_S.aws, AU_S.sesWarnings, AU_S.aws2022],
    },
  ],
  orders: [
    {
      step: "advisory",
      terms: [{ en: "Prepare now" }, { en: "Stay informed" }, { en: "Monitor conditions" }, { en: "Avoid the area" }],
      src: [AU_S.aws],
    },
    {
      step: "prepare",
      terms: [{ en: "Prepare to evacuate" }, { en: "Move to higher ground" }, { en: "Do not enter flood water" }, { en: "Prepare for isolation" }],
      src: [AU_S.aws],
    },
    {
      step: "evacuate",
      terms: [{ en: "Evacuate now" }, { en: "Emergency warning to evacuate by 9pm tonight", note: "NSW SES wording, March 2025" }],
      src: [AU_S.sesWarnings, AU_S.ses9pm],
    },
    { step: "shelter", terms: [{ en: "Shelter indoors now" }, { en: "Too late to leave" }], src: [AU_S.aws] },
  ],
  orderNotes: [{ text: "After a flood: “Advice: Return with Caution”.", src: [AU_S.aws, AU_S.sesWarnings] }],
  decider: {
    text: "The state emergency service, not the BoM. In New South Wales, NSW SES is the Combat Agency for floods under the State Emergency Service Act 1989 and the NSW State Flood Plan (approved 14 November 2024), and it uses BoM forecasts to set warning levels and issue evacuation warnings. Each state has its own arrangements.",
    src: [AU_S.floodPlan, AU_S.sesWarnings],
  },
  channel: {
    text: "Emergency Alert sends text and voice messages to landlines and mobiles in the warning area. AusAlert, the new national cell broadcast, had a national test on 27 July 2026, with launch planned for 1 October 2026; it runs alongside Emergency Alert until at least July 2027. New South Wales also has the Hazards Near Me app.",
    src: [AU_S.sesWarnings, AU_S.ausAlert, AU_S.ausAlertDeck, AU_S.nema],
  },
  dose: "The Emergency Alert or AusAlert area.",
  emergency: {
    call: "000",
    others: "112 from mobiles reaches the same service; 106 for TTY users; NSW SES 132 500 for flood help that is not life-threatening",
    note: { text: "000 and 112 cannot be texted.", src: [AU_S.tripleZero] },
    src: [AU_S.tripleZero, AU_S.acma, AU_S.sesWhat],
  },
  sentinels: [
    { text: "BoM volunteer observers: thousands collect data every day from about 5,900 rainfall stations and more than 1,000 river-height gauges.", src: [AU_S.bomVolunteers] },
    { text: "NSW SES volunteer units, which run the response to floods, storms and tsunami.", src: [AU_S.sesWhat] },
    {
      text: "After 2022, the independent inquiry recommended training and equipping local people as first responders; the NSW Premier accepted all 28 recommendations.",
      src: [AU_S.inquiryReport],
    },
  ],
  lesson: {
    title: "Northern Rivers floods",
    where: "Lismore, New South Wales",
    when: "February–March 2022",
    facts: [
      {
        text: "On 28 February 2022 the Wilsons River at Lismore reached 14.4 m, the highest flood on record there. The previous record was 12.11 m (1954 and 1974).",
        src: [AU_S.lismore],
      },
      { text: "Two days earlier, the BoM had forecast minor to moderate flooding.", src: [AU_S.aidr] },
      {
        text: "NSW SES handled more than 2,200 flood rescue activations across the state, 862 of them in Lismore on 28 February alone. Across NSW, 13 people died (AIDR).",
        src: [AU_S.aidr],
      },
      {
        text: "The independent inquiry found “many failures to give timely public warnings which led to the need for a high number of rescues”, and that in the Northern Rivers “community rescues significantly outnumbered SES rescues”: locals in boats and on jet skis, the “Tinny Army”.",
        src: [AU_S.inquiry, AU_S.inquiryReport, AU_S.aidr, AU_S.inquiryVolumes],
      },
      { text: "A parliamentary inquiry found the warnings out of date, inaccurate and confusing, and many calls to 000 and the SES unanswered.", src: [AU_S.parliament] },
    ],
    lesson: {
      text: "The forecast was far too low, warnings came late, and neighbours did much of the rescuing. The inquiry also said “evacuation orders should not be used to signal the commencement of rescues”.",
      src: [AU_S.aidr, AU_S.inquiry],
    },
  },
  ladder: {
    watch: "BoM Flood Watch (up to four days ahead), Flood Warnings with Minor, Moderate and Major classes, Severe Weather Warnings for flash flooding, and volunteer river-height gauges. Lismore shows a forecast can be far too low, so gauge readings count first.",
    ask: "Before the warning level goes up, ring BoM volunteer observers and SES unit members near the zone's edge: “Does this match what you see?”",
    slow: "Watch and Act “Prepare to evacuate” goes to low-lying blocks first. “Evacuate by [time]” goes out in timed waves, on roads away from creeks and low bridges.",
    hold: "The SES incident controller approves, with words from the warning system's list. VoiceFlare delays only its own calls, never an Emergency Alert or AusAlert.",
    hand: "People who consented share live GPS with SES flood rescue (132 500, or 000 when life is at risk). An evacuation order is never used to say rescues have started. Silence gets a retry, then a linked contact, then a door knock.",
  },
  sources: Object.values(AU_S),
};

/** Display order: the anchor (India) first, then the other five. */
export const FLOOD_CODES: JurisdictionCode[] = ["IN", "JP", "CN", "EU-GR", "US-CA", "AU"];

export const FLOODS: Record<JurisdictionCode, FloodProfile> = {
  IN,
  JP,
  CN,
  "EU-GR": GR,
  "US-CA": US,
  AU,
};

// ---------------------------------------------------------------------------------------------------------------
// The anchor, the ladder, and what stays and what changes
// ---------------------------------------------------------------------------------------------------------------

/** The July 2026 Pimpri-Chinchwad floods, for the hero. Sourced numbers only. */
export const PUNE_2026: {
  title: string;
  stats: { value: string; label: string; src: Source[] }[];
  timeline: { when: string; what: string; src: Source[] }[];
  gap: Sourced;
} = {
  title: "Pimpri-Chinchwad, July 2026",
  stats: [
    { value: "268 mm", label: "of rain in 24 hours at Chinchwad, to 8:30 am on 7 July", src: [IN_S.rain268] },
    { value: "1,500+", label: "residents stuck in their homes in Tanajinagar, Keshavnagar and Laxminagar", src: [IN_S.stuck] },
    { value: "1,880", label: "people moved out of flooded areas by noon on 6 July", src: [IN_S.moved] },
  ],
  timeline: [
    {
      when: "6 Jul",
      what: "IMD red alert for Pune district. The commissioner directs warnings by public announcement in vulnerable areas.",
      src: [IN_S.redAlert],
    },
    { when: "7 Jul", what: "Chinchwad's second day above 200 mm. The Thergaon bridge is under water.", src: [IN_S.rain206, IN_S.stuck] },
    { when: "24 Jul", what: "Pavana dam about 97% full; the release goes from 5,600 to 7,000 cusecs, announced in advance.", src: [IN_S.pavana] },
    { when: "31 Jul", what: "Khadakwasla's release is raised to 22,880 cusecs.", src: [IN_S.khadakwasla] },
  ],
  gap: {
    text: "The warning to riverside areas came during the flood. Rain and dam releases are measured and announced hours ahead.",
    src: [IN_S.redAlert, IN_S.pavana],
  },
};

/** VoiceFlare's ladder for floods, with the Pune example for each step. */
export const FLOOD_LADDER: { key: FloodRungKey; emoji: string; name: string; what: string; pune: Sourced }[] = [
  {
    key: "watch",
    emoji: "🌧️",
    name: "Watch",
    what: "Read the river gauges, the rainfall, the dam releases and the official warnings.",
    pune: { text: "IMD's red alert, 268 mm in 24 hours at Chinchwad, and the Pavana dam's release notices.", src: [IN_S.redAlert, IN_S.rain268, IN_S.pavana] },
  },
  {
    key: "ask",
    emoji: "📞",
    name: "Ask",
    what: "Before waking a zone, ask people at the riverbank or the low street: “Is the water at the bridge?”",
    pune: { text: "Ward-office staff and the dam flood control cell: “Is the water at the Thergaon bridge?”", src: [IN_S.stuck, IN_S.pavana] },
  },
  {
    key: "slow",
    emoji: "🏘️",
    name: "Slow",
    what: "Low-lying blocks first, in timed waves, on routes that avoid flooded roads and underpasses.",
    pune: {
      text: "First the pockets that flooded, such as Ambedkar Colony and River Road; routes avoid the Thergaon bridge and Telco Road.",
      src: [IN_S.moved, IN_S.stuck],
    },
  },
  {
    key: "hold",
    emoji: "✋",
    name: "Hold",
    what: "A named human approves the order. VoiceFlare holds its own alert up to 90 seconds and sends on time if nobody decides: it can delay an alert, never stop one.",
    pune: { text: "The commissioner's control room, or the Collector, approves the words.", src: [IN_S.dmAct, IN_S.redAlert] },
  },
  {
    key: "hand",
    emoji: "🚤",
    name: "Hand to a person",
    what: "Boats and rescue teams go to a person's live GPS, shared with consent. Each wave has a named shelter.",
    pune: { text: "Rescue teams get the exact spot; each wave goes to a ward relief shelter.", src: [IN_S.moved] },
  },
];

/** The six invariants (lib/jurisdictions.ts, PRD 17.2), said for floods. */
export const FLOOD_INVARIANTS: { title: string; body: string }[] = [
  { title: "A named human approves", body: "A mayor, a collector, a sheriff or an SES controller: a person with a name approves every order. Feeds and models only propose." },
  { title: "The edge is asked first", body: "Before an order wakes a zone, people at its edge are asked: “Is the water at the bridge?”" },
  {
    title: "The dose shows, the hold sends on time",
    body: "The board shows how many phones an order will wake before it goes. The hold can delay VoiceFlare's own alert, never stop it, and never touches an official warning.",
  },
  { title: "Only approved words are read", body: "Calls read the official words the human approved, in the person's language. Never an arrival time, never “you are safe”." },
  { title: "A canary checks delivery", body: "One phone inside the flood zone and one outside report whether the alert arrived where it should." },
  { title: "Silence gets a door knock", body: "No answer means a retry, a linked contact, then a door knock. Every decision is logged with a name and a reason." },
];

/** The six adapters, said for floods. Values per place come from the profiles above and lib/jurisdictions.ts. */
export const FLOOD_ADAPTERS: { name: string; byPlace?: Partial<Record<JurisdictionCode, string>>; body?: string }[] = [
  {
    name: "Ladder words",
    byPlace: {
      IN: "Remain alert · Avoid entering riverbeds",
      JP: "警戒レベル4 避難指示",
      CN: "立即转移",
      "EU-GR": "Οργανωμένη προληπτική απομάκρυνση",
      "US-CA": "Evacuation Order",
      AU: "Emergency Warning: Evacuate now",
    },
  },
  {
    name: "Who decides",
    byPlace: {
      IN: "The Collector; the PCMC commissioner in the city",
      JP: "The mayor (市町村長)",
      CN: "Flood control headquarters (防汛抗旱指挥部)",
      "EU-GR": "The mayor or regional governor",
      "US-CA": "Sheriff or police chief",
      AU: "NSW SES",
    },
  },
  {
    name: "Emergency number",
    byPlace: {
      IN: IN.emergency.call,
      JP: JP.emergency.call,
      CN: CN.emergency.call,
      "EU-GR": GR.emergency.call,
      "US-CA": US.emergency.call,
      AU: AU.emergency.call,
    },
  },
  {
    name: "Public channel and dose",
    byPlace: {
      IN: "SACHET SMS and cell broadcast",
      JP: "緊急速報メール and disaster radio",
      CN: "12379 SMS and village loudspeakers",
      "EU-GR": "112 messages",
      "US-CA": "WEA and county alerts",
      AU: "Emergency Alert and AusAlert",
    },
  },
  {
    name: "Voice platform and AI model",
    body: "Local carriers and a registered number in each place. Where the usual model is not offered, as in mainland China, a domestic model hosted in-country sits behind the same tools and the same approved-words rule.",
  },
  {
    name: "Privacy and maps",
    body: "Live GPS only with consent, under each place's law: the DPDP Act in India, APPI in Japan, PIPL in China, GDPR in Greece, the Privacy Act in Australia, California privacy law. GPS is stored in WGS-84; Chinese basemaps use GCJ-02, so it is converted only to draw.",
  },
];
