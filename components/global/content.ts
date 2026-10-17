// Content for /global (Twist 2: "make it global"). Short forms of the profile facts in lib/jurisdictions.ts and of
// the tables in docs/PRD.md section 17.2; nothing here is new research. Directive wording outside California is a
// demo paraphrase, never an official text. Client-safe.
import type { Jurisdiction, JurisdictionCode } from "@/lib/jurisdictions";

/** Display order: the two built jurisdictions first, then the four profiles. */
export const CODES: JurisdictionCode[] = ["US-CA", "CN", "JP", "EU-GR", "IN", "AU"];
export const PROFILE_CODES: JurisdictionCode[] = ["JP", "EU-GR", "IN", "AU"];

export interface Place {
  /** Short name for tabs and column heads. */
  place: string;
  country: string;
  /** BCP-47 tag for text in the local script; null when the local text is English. */
  script: string | null;
  /** Name of the local script's language, for "the order call, in ...". */
  scriptName: string;
}

export const PLACES: Record<JurisdictionCode, Place> = {
  "US-CA": { place: "Los Angeles", country: "United States", script: null, scriptName: "English" },
  CN: { place: "Chongqing", country: "China", script: "zh-Hans", scriptName: "Chinese" },
  JP: { place: "Ōfunato", country: "Japan", script: "ja", scriptName: "Japanese" },
  "EU-GR": { place: "Rhodes", country: "Greece", script: "el", scriptName: "Greek" },
  IN: { place: "Odisha", country: "India", script: "hi", scriptName: "Hindi" },
  AU: { place: "East Gippsland", country: "Australia", script: null, scriptName: "English" },
};

/** The six things that never change (PRD 17.2, decision D-37). `short` is for the hero switch. */
export const INVARIANTS: { short: string; title: string; body: string }[] = [
  {
    short: "A named human approves",
    title: "A named human approves",
    body: "Every directive has a named approver. Models and feeds only propose.",
  },
  {
    short: "The edge is asked first",
    title: "The edge is asked first",
    body: "Before an order wakes a zone, people at its edge are asked what they see.",
  },
  {
    short: "The dose shows; the hold sends on time",
    title: "The dose shows, the hold sends on time",
    body: "How many people the polygon wakes is shown before the send, and the hold sends on time if nobody decides.",
  },
  {
    short: "Only approved words are read",
    title: "Only approved words are read",
    body: "The agent reads only approved text, in the person's language, and says it is an automated voice.",
  },
  {
    short: "A canary checks delivery",
    title: "A canary checks delivery",
    body: "One phone inside the polygon and one outside report whether the alert arrived where it should.",
  },
  {
    short: "Silence gets a door knock; the ledger keeps it all",
    title: "Silence gets a door knock",
    body: "No answer becomes a door-knock row, and every decision goes in the ledger with a name and a reason.",
  },
];

/** The six adapters (decision D-37), as slots in the hero switch. */
export type SlotKey = "ladder" | "decider" | "number" | "channel" | "voice" | "data";

export const SLOTS: { key: SlotKey; name: string }[] = [
  { key: "ladder", name: "Word for an order" },
  { key: "decider", name: "Who approves" },
  { key: "number", name: "Number in every call" },
  { key: "channel", name: "Public channel and dose" },
  { key: "voice", name: "Voice and AI model" },
  { key: "data", name: "Privacy and maps" },
];

/** One-line forms of the long profile fields, for the hero switch (PRD 17.2 wording). */
export const SHORT: Record<JurisdictionCode, Record<"decider" | "channel" | "voice" | "data", string>> = {
  "US-CA": {
    decider: "The overnight supervisor of the alert desk; the duty officer approves",
    channel: "Wireless Emergency Alerts through IPAWS; dose from the population in the polygon",
    voice: "Retell AI on the phone network; Claude in the call",
    data: "California privacy law; Esri and OpenStreetMap maps in WGS-84",
  },
  CN: {
    decider: "The district forest fire headquarters (森林防灭火指挥部) duty leader; a township head may act on the spot",
    channel: "12379 SMS, WeChat and village loudspeakers; dose from carrier SMS audiences",
    voice: "A registered government line; a CAC-filed domestic model, hosted in-country",
    data: "PIPL consent; GCJ-02 basemaps with an approval number (审图号)",
  },
  JP: {
    decider: "The mayor (Disaster Countermeasures Basic Act, Art. 60), reporting to the governor",
    channel: "Municipal disaster radio and cell-broadcast emergency mail",
    voice: "A registered municipal number; Claude is available in Japan",
    data: "APPI; JGD2024, within about 1 m of WGS-84",
  },
  "EU-GR": {
    decider: "Two roles: the mayor or regional governor orders; civil protection sends the 112 message",
    channel: "112 cell broadcast, in Greek and English",
    voice: "Consented calls on top of 112; Claude is available in the EU",
    data: "GDPR; Greek Grid polygons converted to WGS-84 on import",
  },
  IN: {
    decider: "The District Collector and the district disaster authority",
    channel: "SACHET, NDMA's CAP system: geo-targeted SMS and cell broadcast",
    voice: "Domestic carriers; Claude is available in India, hosted in-region",
    data: "DPDP Act 2023; WGS-84 maps",
  },
  AU: {
    decider: "The incident controller, under the Australian Warning System",
    channel: "Emergency Alert by area, and the national cell broadcast",
    voice: "Domestic carriers; Claude is available, hosted in-region",
    data: "Privacy Act 1988; WGS-84 and GDA2020 maps",
  },
};

/** Los Angeles cells for the adapter rows the profile has no field for (PRD 17.2 table, product description). */
export const LA_EXTRA = {
  ladder: "Cal OES standard terms: a human moves a zone between them",
  dose: "Dose: the population inside the polygon, shown before the send.",
  sentinels: "Enrolled residents, CERT members and block captains at the zone's edges.",
  lastMile: "No answer becomes retries, a call to a linked contact, then a door-knock row for the quick response team.",
};

const LANGUAGE_NAMES: Record<string, string> = {
  "en-US": "English",
  "es-US": "Spanish",
  "ko-KR": "Korean",
  "zh-CN": "Mandarin",
  "hi-IN": "Hindi",
  "fr-FR": "French",
  "hy-AM": "Armenian",
  "fil-PH": "Filipino",
  "ja-JP": "Japanese",
  "el-GR": "Greek",
  "de-DE": "German",
};

export const languageName = (code: string) => LANGUAGE_NAMES[code] ?? code;

/** The first adaptation line that matches, or "" (profiles are edited as research lands). */
export function adaptation(j: Jurisdiction, pattern: RegExp): string {
  return j.adaptations.find((a) => pattern.test(a)) ?? "";
}

/** "www.example.gov.cn" for a source link label; the raw string if it is not a URL. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** The Chongqing fire of August 2022, from the CN profile's example and PRD 17.2. */
export const CHONGQING_2022: { term: string; detail: string }[] = [
  { term: "Started", detail: "22:30 on Aug 21, 2022, in Xiema subdistrict on the Jinyun Mountain side of Beibei" },
  { term: "Moved", detail: "More than 680 households (1,800+ people) relocated, as reported by the Ministry of Emergency Management" },
  { term: "Responders", detail: "More than 14,000, in the same report" },
  { term: "Out", detail: "All open flames were out at 08:30 on Aug 26" },
];

/** Chongqing's Natural Disaster Evacuation Regulation, effective Aug 1, 2026 (PRD 17.2; CN profile). */
export const CHONGQING_REGULATION: string[] = [
  "An immediate relocation directive is required when a forest fire may endanger life.",
  "A township or street head may act on the spot (临机处置权) and reports the act upward.",
  "Vulnerable residents are pre-registered with named helpers (Art. 8).",
];

/** "VoiceFlare's shape in China's own law" (PRD 17.2), as rows: China's practice, then the product's piece. */
export const CHINA_FIT: { china: string; voiceflare: string; how: string }[] = [
  {
    china: "A township head acts on the spot and reports upward",
    voiceflare: "A named decider",
    how: "The human key: one named person approves the order, and the ledger records the name and the reason.",
  },
  {
    china: "Relocation leads (转移责任人) and grid workers (网格员) must acknowledge: 叫应",
    voiceflare: "An acknowledged edge",
    how: "The sentinels: before an order wakes a zone, the people at its edge are rung and asked what they see.",
  },
  {
    china: "Vulnerable residents are pre-registered with a named helper",
    voiceflare: "A linked contact",
    how: "When a resident does not answer, the agent retries, then calls their named helper; a door-knock row comes last.",
  },
];

/** What the chongqing scenario seeds (PRD 17.2, "What changed in the build", item 2). */
export const CHONGQING_SCENARIO: string[] = [
  "Five Beibei zones on the 2022 fire's ground, with Chinese directives from the China profile.",
  "Sentinels who are grid workers and relocation leads.",
  "Grandpa Zhao, whose named helper is Phone 1.",
  "A wrong polygon of central Chongqing (about 10 million people, an estimate) for the hold.",
];
