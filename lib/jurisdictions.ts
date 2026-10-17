// Jurisdiction profiles (Twist 2: "make it global"). The product is the same everywhere: a named human approves,
// sentinels at the zone's edge confirm, the dose is shown, the agent reads only approved text, a canary checks
// delivery, a ledger records every decision. What changes by country is configuration and six adapters:
// vocabulary, the emergency number, the alert channel (and its audience count), telephony, the AI model behind
// the same seven-tool contract, and maps and privacy. Facts are from the fact-checked research behind PRD 17.2
// (Oct 17, 2026); directive wording outside California is a demo paraphrase, never an official text.
// Client-safe (no server imports).
import type { ZoneState } from "@/lib/types";

export type JurisdictionCode = "US-CA" | "CN" | "JP" | "EU-GR" | "IN" | "AU";

export interface Jurisdiction {
  code: JurisdictionCode;
  name: string;
  flag: string;
  example: string;
  fire_service: string;
  decider: string;
  emergency: { fire: string; medical: string; police: string; note: string };
  /** The number the agent says in "hang up and call ... now". */
  call_now: string;
  warning_system: string;
  /** Local label per ladder state (with an English gloss where useful). */
  labels: Record<ZoneState, string>;
  /** Approved-directive templates per state in the local language; {zone} is replaced. A human still approves each one. */
  directives: Partial<Record<ZoneState, string>>;
  languages: string[];
  units: "imperial" | "metric";
  datum: "WGS-84" | "GCJ-02";
  telephony: string;
  ai_model: string;
  privacy: string;
  maps: string;
  adaptations: string[];
  sources: string[];
}

const US_CA: Jurisdiction = {
  code: "US-CA",
  name: "Los Angeles, California, USA",
  flag: "US",
  example: "January 2025 Los Angeles fires; on January 9 a warning meant for a few neighborhoods reached about 10 million phones",
  fire_service: "Los Angeles Fire Department; LA County Fire Department",
  decider: "The overnight supervisor of the city or county alert desk; the duty officer approves",
  emergency: { fire: "911", medical: "911", police: "911", note: "One number for everything" },
  call_now: "911",
  warning_system: "Wireless Emergency Alerts through FEMA IPAWS; county mass notification",
  labels: {
    monitor: "Monitor", watch: "Watch", warning: "Evacuation Warning", order: "Evacuation Order",
    shelter_in_place: "Shelter in Place", lifted: "Lifted",
  },
  directives: {},
  languages: ["en-US", "es-US", "ko-KR", "zh-CN", "hi-IN", "fr-FR", "hy-AM", "fil-PH"],
  units: "imperial",
  datum: "WGS-84",
  telephony: "Retell AI over the US phone network; browser phone fallback",
  ai_model: "Claude through the Anthropic API",
  privacy: "California privacy law; the FCC treats AI voices as artificial voice under the TCPA, with an emergency-purpose exemption",
  maps: "Esri and OpenStreetMap tiles, WGS-84",
  adaptations: [],
  sources: ["https://www.calalerts.org/evacuations.html"],
};

const CN: Jurisdiction = {
  code: "CN",
  name: "Chongqing, China",
  flag: "CN",
  example:
    "Chongqing mountain fires, August 2022: the Beibei fire started at 22:30 on Aug 21 in Xiema subdistrict on the Jinyun Mountain side; MEM reported 680+ households (1,800+ people) relocated and 14,000+ responders; all open flames were out by 08:30 on Aug 26",
  fire_service: "National Fire and Rescue Administration (国家消防救援局), under the Ministry of Emergency Management; about 220,000 firefighters",
  decider:
    "The county or district forest fire prevention and suppression headquarters (森林防灭火指挥部) duty leader or the front-line command post; under Chongqing's 2026 regulation a township or street head may act on the spot (临机处置权), and the act is reported upward",
  emergency: { fire: "119", medical: "120", police: "110", note: "No single number: 119 fire and rescue, 120 ambulance, 110 police, 122 traffic; 12345 is the non-emergency government line" },
  call_now: "119",
  warning_system:
    "National Emergency Early-Warning Information Release System (国家突发事件预警信息发布系统, CAP-based): 12379 SMS, WeChat, village loudspeakers (大喇叭), TV and radio; carriers must carry government warnings free of charge",
  labels: {
    monitor: "蓝色预警 Blue (Level IV)",
    watch: "黄色预警 Yellow (Level III)",
    warning: "橙色/红色预警 · 做好转移准备 (prepare to relocate)",
    order: "转移指令 Relocation order",
    shelter_in_place: "就地避险 Shelter where you are",
    lifted: "解除转移 · 有序返回 Lifted",
  },
  directives: {
    watch: "【北碚区森林防灭火指挥部办公室】{zone}森林火险黄色预警：未来24小时森林火险等级较高，严禁一切野外用火。请关注官方信息，发现火情立即拨打119。",
    warning: "【北碚区应急管理局】山火可能威胁{zone}。请立即做好转移准备，备好身份证件和常用药品，听从村（社区）干部指挥；老人、儿童和行动不便者请先行转移。",
    order: "【北碚区人民政府紧急转移通知】受山火威胁，{zone}全体人员请立即按指定路线转移，不要返回取物。需要帮助请拨打119或联系村（社区）干部。",
    shelter_in_place: "【北碚区应急管理局】{zone}道路已被山火阻断，请立即就地避险：关闭门窗，留在室内，不要驾车穿越火场，等待救援人员指示。紧急求助请拨打119。",
    lifted: "【北碚区森林防灭火指挥部】{zone}山火明火已全部扑灭，转入清理看守阶段，转移群众可有序返回。如发现复燃请立即拨打119。",
  },
  languages: ["zh-CN", "en-US"],
  units: "metric",
  datum: "GCJ-02",
  telephony:
    "A registered, number-authenticated government line through a domestic carrier or cloud platform (no Retell); one canary phone on each of China Mobile, China Telecom, China Unicom and China Broadcast Network; every call opens with an AI-voice disclosure (CAC AI content labeling measures; GB 45438-2025)",
  ai_model:
    "Claude is not available in mainland China (Anthropic supported regions). A CAC-filed domestic model, hosted in-country, sits behind the same seven tools and the same verbatim-relay rule (Interim Measures for Generative AI Services, 2023)",
  privacy:
    "PIPL: last-seen locations and health needs are sensitive personal information (Art. 28) needing separate consent (Art. 29) unless the emergency basis applies (Art. 13(4)); vulnerable residents are pre-registered with named help-responsible persons (Chongqing 2026 regulation, Art. 8); everything stays on in-country government cloud",
  maps:
    "Public maps need an approval number (审图号); approved providers use GCJ-02, where raw GPS lands about 100-700 m off, so coordinates are converted at render time (Tianditu uses CGCS2000)",
  adaptations: [
    "Colour warnings (blue, yellow, orange, red) are hazard levels, not evacuation states; moving people needs a separate relocation order (转移指令). Never auto-promote a red warning into an order: the human key matters more, not less.",
    "Sentinels become the existing call-and-respond (叫应) practice: ring the named village or community relocation leads (转移责任人) and grid workers (网格员) at the zone's edges and require an acknowledgement.",
    "The dose preview counts 12379 / carrier targeted-SMS audiences by base-station area instead of WEA cells.",
    "Last mile is human: WeChat official-account pushes, village WeChat groups, loudspeakers, and the printable door-knock sheet for cadres.",
  ],
  sources: [
    "https://www.anthropic.com/supported-countries",
    "https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm",
    "https://www.gov.cn/zhengce/202310/content_6912956.htm",
    "https://www.chinanews.com.cn/sh/2022/08-26/9837205.shtml",
    "https://cmalibrary.cn/amst/2022/202204/lt/202209/P020220920383986059987.pdf",
    "https://news.qq.com/rain/a/20260804A0CSHM00",
  ],
};

const IN: Jurisdiction = {
  code: "IN",
  name: "Odisha, India",
  flag: "IN",
  example: "Cyclone Dana, October 2024: landfall between Bhitarkanika and Dhamra on the Odisha coast (Kendrapara and Bhadrak districts)",
  fire_service: "State fire services (Odisha Fire and Emergency Service); district disaster management authorities",
  decider: "The District Collector and the District Disaster Management Authority order evacuation; the state emergency operations centre runs the desk",
  emergency: { fire: "101", medical: "108", police: "100", note: "112 (Emergency Response Support System) reaches police, fire and ambulance" },
  call_now: "112",
  warning_system: "SACHET, NDMA's CAP-based integrated alert system (built by C-DOT), geo-targeted SMS in many Indian languages, plus cell broadcast",
  labels: {
    monitor: "Pre-Cyclone Watch", watch: "Cyclone Alert (yellow)", warning: "Cyclone Warning (orange)",
    order: "District evacuation order", shelter_in_place: "Stay indoors", lifted: "All clear",
  },
  directives: {
    order: "जिलाधिकारी का आदेश: {zone} के सभी निवासी तुरंत अपना घर छोड़कर नज़दीकी चक्रवात आश्रय स्थल जाएँ। यह अनिवार्य है। मदद के लिए 112 पर कॉल करें।",
  },
  languages: ["hi-IN", "en-US"],
  units: "metric",
  datum: "WGS-84",
  telephony: "Domestic carriers; consented outbound calls and SMS; SACHET SMS from the government sender ID",
  ai_model: "Claude is available in India (Anthropic supported countries); in-region hosting for government data residency",
  privacy: "Digital Personal Data Protection Act 2023 and the DPDP Rules 2025",
  maps: "WGS-84; Survey of India and OpenStreetMap",
  adaptations: ["Directives in Odia and Hindi as well as English; 112 in the agent's emergency line."],
  sources: ["https://sachet.ndma.gov.in/"],
};

const AU: Jurisdiction = {
  code: "AU",
  name: "East Gippsland, Victoria, Australia",
  flag: "AU",
  example: "Black Summer 2019-20: evacuation warnings for East Gippsland on Dec 28, 2019; thousands sheltered at Mallacoota",
  fire_service: "Country Fire Authority and Forest Fire Management Victoria",
  decider: "The incident controller issues warnings under the Australian Warning System",
  emergency: { fire: "000", medical: "000", police: "000", note: "000 (Triple Zero); 112 from mobiles reaches the same service" },
  call_now: "000",
  warning_system: "Emergency Alert (SMS and landline voice by area), the Australian Warning System, and the national public warning cell broadcast",
  labels: {
    monitor: "Fire Danger Rating", watch: "Advice", warning: "Watch and Act", order: "Emergency Warning: leave now",
    shelter_in_place: "Emergency Warning: shelter now", lifted: "Advice: safe to return",
  },
  directives: {
    order: "Emergency Warning – Bushfire – Leave immediately – {zone}. You may be in danger and need to take action immediately. Any delay now puts your life at risk.",
  },
  languages: ["en-US"],
  units: "metric",
  datum: "WGS-84",
  telephony: "Domestic carriers; Retell-class voice platforms work",
  ai_model: "Claude is available (Anthropic supported countries); in-region hosting available for data residency",
  privacy: "Privacy Act 1988 and the Australian Privacy Principles",
  maps: "WGS-84 / GDA2020",
  adaptations: ["The Australian Warning System's three levels map directly onto watch, warning and order."],
  sources: ["https://www.australianwarningsystem.com.au/"],
};

export const JURISDICTIONS: Record<JurisdictionCode, Jurisdiction> = {
  "US-CA": US_CA,
  CN,
  JP: {
    code: "JP",
    name: "Ōfunato, Iwate, Japan",
    flag: "JP",
    example:
      "Ōfunato wildfire, Feb 26 to Apr 7, 2025: about 3,370 ha, Japan's largest since 1964; one death; 226 buildings burned; at the peak, evacuation instructions (避難指示) covered 1,896 households (4,596 people) in 17 districts",
    fire_service: "Municipal fire headquarters (720 nationwide) and volunteer fire corps (消防団); prefectural mutual aid and the national Emergency Fire Response Teams for large fires",
    decider: "The mayor (市町村長) issues and lifts 避難指示 under the Disaster Countermeasures Basic Act, Art. 60, and reports each one to the governor; the fire chief recommends",
    emergency: { fire: "119", medical: "119", police: "110", note: "119 for fire and ambulance, 110 for police; no single all-hazards number" },
    call_now: "119",
    warning_system:
      "Municipal disaster radio (防災行政無線), cell-broadcast emergency mail (緊急速報メール) on every carrier, and L-Alert to broadcasters; J-ALERT carries national alerts, not municipal fire orders",
    labels: {
      monitor: "林野火災注意報 · 警戒レベル1", watch: "林野火災警報 · 警戒レベル2", warning: "警戒レベル3 高齢者等避難",
      order: "警戒レベル4 避難指示", shelter_in_place: "警戒レベル5 緊急安全確保", lifted: "避難指示の解除",
    },
    directives: {
      warning: "【警戒レベル３】{zone}に高齢者等避難を発令しました。避難に時間のかかる方は、今すぐ避難を始めてください。（演習）",
      order: "【警戒レベル４】{zone}に避難指示を発令しました。林野火災が迫っています。直ちに指定避難所へ避難してください。（演習）",
    },
    languages: ["ja-JP", "en-US", "zh-CN", "ko-KR"],
    units: "metric",
    datum: "WGS-84",
    telephony: "Domestic carriers; outbound calls from a registered municipal number",
    ai_model: "Claude is available in Japan (Anthropic supported countries)",
    privacy: "Act on the Protection of Personal Information (APPI)",
    maps: "JGD2024, within about 1 m of WGS-84; GSI tiles",
    adaptations: [
      "Every message carries the alert level and colour, e.g. 【警戒レベル４】.",
      "Only the mayor (or the official the local disaster plan names) approves an order or a lift; the ledger records the legal basis and drafts the report to the governor.",
      "Easy Japanese (やさしい日本語) and foreign-language calls for residents and visitors.",
    ],
    sources: ["https://www.fdma.go.jp/", "https://www.city.ofunato.iwate.jp/"],
  },
  "EU-GR": {
    code: "EU-GR",
    name: "Rhodes, Greece (EU)",
    flag: "GR",
    example:
      "Rhodes, July 2023: about 19,000 people moved (about 16,000 by land, 3,000 by sea) from 12 villages and hotels, many of them tourists, in what the civil protection ministry called Greece's largest wildfire evacuation; orders went out as 112 cell-broadcast messages",
    fire_service: "Hellenic Fire Service (199), under the Ministry for Climate Crisis and Civil Protection",
    decider:
      "Two named roles: the mayor (one municipality) or the regional governor decides an organized evacuation on the fire service's recommendation (Law 4662/2020); the General Secretariat for Civil Protection sends the 112 message",
    emergency: { fire: "199", medical: "166", police: "100", note: "112 is the EU-wide number: free, 24/7, in Greek and English" },
    call_now: "112",
    warning_system: "112 cell broadcast (EU-Alert under Article 110 of the European Electronic Communications Code), in Greek and English",
    labels: {
      monitor: "Fire risk category 1-3", watch: "Fire risk category 4-5", warning: "112: Παραμείνετε σε ετοιμότητα (stay alert)",
      order: "112: Εκκενώστε τώρα (evacuate now)", shelter_in_place: "112: Κλείστε πόρτες και παράθυρα (stay inside)", lifted: "112: Ασφαλής επιστροφή (safe return)",
    },
    directives: {
      order: "112 · Αν βρίσκεστε στην περιοχή {zone}, εκκενώστε τώρα. Δασική πυρκαγιά στην περιοχή σας. Ακολουθήστε τις οδηγίες των Αρχών. (άσκηση)",
    },
    languages: ["el-GR", "en-US", "de-DE", "fr-FR"],
    units: "metric",
    datum: "WGS-84",
    telephony: "EU carriers; 112 cell broadcast stays the public channel, with consented outbound calls on top",
    ai_model: "Claude is available in the EU (Anthropic supported countries)",
    privacy: "GDPR: health needs are special-category data (Art. 9), with the vital-interests basis in an emergency",
    maps: "WGS-84; agency polygons in the Greek Grid (GGRS87, EPSG:2100) are converted on import",
    adaptations: [
      "The approver splits in two, as Greek law does: who orders the evacuation and who sends the 112 message; the ledger records both and the decision number.",
      "Every order names a destination, as 112 does ('evacuate now towards Lindos').",
      "Tourist languages on calls: English, German, French and others.",
    ],
    sources: ["https://civilprotection.gov.gr/", "https://www.fireservice.gr/"],
  },
  IN,
  AU,
};

export function jurisdictionFor(code: string | null | undefined): Jurisdiction {
  return JURISDICTIONS[(code ?? "US-CA") as JurisdictionCode] ?? US_CA;
}

/** Which jurisdiction a demo scenario runs under. */
export function jurisdictionForScenario(scenario: string): JurisdictionCode {
  return scenario === "chongqing" ? "CN" : "US-CA";
}

/** The local directive template for a state, if the jurisdiction has one ({zone} filled in). */
export function localDirective(code: string | null | undefined, state: ZoneState, zoneName: string): string | null {
  const t = jurisdictionFor(code).directives[state];
  return t ? t.replaceAll("{zone}", zoneName) : null;
}

/** Area for the dose preview in the jurisdiction's units. */
export function formatArea(sqMi: number, code: string | null | undefined): string {
  return jurisdictionFor(code).units === "metric" ? `${(sqMi * 2.58999).toFixed(1)} km²` : `${sqMi.toFixed(1)} sq mi`;
}
