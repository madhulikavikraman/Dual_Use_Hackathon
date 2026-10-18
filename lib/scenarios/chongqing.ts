// Chongqing mountain fire (synthetic), the Twist 2 scenario: Beibei District, anchored on the real August 2022 fire
// that started in Xiema subdistrict on the Jinyun Mountain side. Geography is stylized; zone texts are demo
// paraphrases on China's ladder (yellow watch, orange "prepare to relocate", a separate relocation order 转移指令).
// Everyone is synthetic except the six device phones. Coordinates are stored in WGS-84 (see lib/geo-cn.ts).
import { localDirective } from "@/lib/jurisdictions";
import type { Household, Proposal, SimProfile } from "@/lib/types";
import {
  EN, ZH, assignZones, hid, inset, mkZones, person, pointsIn, poly, rng,
  type Lang, type MovePresets, type ZoneSeed,
} from "./common";
import type { ScenarioBuild } from "./westside";

const SHELTER: [number, number] = [106.468, 29.8];
const SHELTER_NAME = "嘉陵江东岸临时安置点（演示）";
const NOTE = "这是黑客松演示的模拟场景；安置点和路线为演示选择。This is a demo scenario for a hackathon.";

export const CHONGQING_PRESETS: MovePresets = {
  "CQ-TS": {
    warning: { move_text: "如需转移，请向东远离缙云山方向，前往嘉陵江东岸临时安置点（演示路线）。", evac_point: SHELTER_NAME, evac: SHELTER },
    order: { move_text: "立即向东转移至嘉陵江东岸临时安置点，不要向缙云山方向走（演示路线）。", evac_point: SHELTER_NAME, evac: SHELTER },
  },
  "CQ-JY": {
    warning: { move_text: "如需转移，请沿山下道路向东前往嘉陵江东岸临时安置点（演示路线）。", evac_point: SHELTER_NAME, evac: SHELTER },
    order: { move_text: "立即沿山下道路向东转移至嘉陵江东岸临时安置点（演示路线）。", evac_point: SHELTER_NAME, evac: SHELTER },
  },
  "CQ-XM": {
    order: { move_text: "立即向东北方向转移至嘉陵江东岸临时安置点，远离缙云山（演示路线）。", evac_point: SHELTER_NAME, evac: SHELTER },
  },
  "CQ-CY": {
    warning: { move_text: "如需转移，请前往嘉陵江东岸临时安置点（演示路线）。", evac_point: SHELTER_NAME, evac: SHELTER },
  },
};

const ZONES: ZoneSeed[] = [
  { id: "CQ-XM", name: "歇马街道（虎头村一带）Xiema", coords: [[106.33, 29.8], [106.4, 29.8], [106.41, 29.76], [106.36, 29.74], [106.32, 29.76]],
    state: "order", directive_text: localDirective("CN", "order", "歇马街道虎头村一带"),
    move_text: CHONGQING_PRESETS["CQ-XM"].order!.move_text, evac_point: SHELTER_NAME, evac: SHELTER,
    fact_sheet: NOTE, population_est: 50_000, hazard_origin: [106.36, 29.775] },
  { id: "CQ-JY", name: "北温泉街道（缙云山东麓）Beiwenquan", coords: [[106.36, 29.86], [106.42, 29.87], [106.425, 29.84], [106.4, 29.8], [106.33, 29.8], [106.34, 29.84]],
    state: "warning", directive_text: localDirective("CN", "warning", "北温泉街道"),
    move_text: CHONGQING_PRESETS["CQ-JY"].warning!.move_text, evac_point: SHELTER_NAME, evac: SHELTER,
    fact_sheet: NOTE, population_est: 40_000, hazard_origin: [106.37, 29.81] },
  { id: "CQ-TS", name: "天生街道 Tiansheng", coords: [[106.4, 29.8], [106.425, 29.84], [106.445, 29.835], [106.45, 29.81], [106.43, 29.79], [106.41, 29.76]],
    state: "watch", directive_text: localDirective("CN", "watch", "天生街道"),
    move_text: null, evac_point: null, evac: null, fact_sheet: NOTE, population_est: 60_000, hazard_origin: [106.37, 29.79] },
  { id: "CQ-CY", name: "朝阳街道 Chaoyang", coords: [[106.425, 29.84], [106.43, 29.87], [106.46, 29.865], [106.465, 29.83], [106.445, 29.835]],
    state: "watch", directive_text: localDirective("CN", "watch", "朝阳街道"),
    move_text: null, evac_point: null, evac: null, fact_sheet: NOTE, population_est: 90_000, hazard_origin: [106.39, 29.83] },
  { id: "CQ-CJ", name: "澄江镇 Chengjiang", coords: [[106.42, 29.87], [106.43, 29.91], [106.48, 29.905], [106.46, 29.865], [106.43, 29.87]],
    state: "monitor", directive_text: null, move_text: null, evac_point: null, evac: null,
    fact_sheet: NOTE, population_est: 30_000, hazard_origin: [106.4, 29.85] },
];

/** The wrong polygon for this scenario: all of central Chongqing instead of one subdistrict. */
export const CENTRAL_CHONGQING_POLYGON: GeoJSON.Polygon = poly([[106.25, 29.95], [106.8, 29.95], [106.8, 29.4], [106.25, 29.4]]);
export const CENTRAL_CHONGQING_POPULATION = 10_000_000; // estimate, central urban area

const NAMES: { name: string; lang: Lang }[] = [
  ["王秀英", ZH], ["李强", ZH], ["刘芳", ZH], ["陈伟", ZH], ["杨静", ZH], ["黄磊", ZH], ["周敏", ZH], ["吴军", ZH],
  ["徐丽", ZH], ["孙涛", ZH], ["马红", ZH], ["朱杰", ZH], ["胡娟", ZH], ["郭勇", ZH], ["何艳", ZH], ["高峰", ZH],
  ["林霞", ZH], ["罗斌", ZH], ["郑燕", ZH], ["梁华", ZH], ["谢平", ZH], ["宋玲", ZH], ["唐鹏", ZH], ["韩梅", ZH],
  ["Emily Carter (student)", EN], ["Ahmed Hassan (student)", EN], ["冯刚", ZH], ["邓琳", ZH], ["曹明", ZH], ["彭洁", ZH],
].map(([name, lang]) => ({ name: name as string, lang: lang as Lang }));

const PROFILES: SimProfile[] = [
  "leaving", "leaving", "already_left", "leaving", "no_answer", "leaving", "staying", "leaving", "unclear", "leaving",
  "needs_help_leaving", "leaving", "already_left", "voicemail", "leaving", "leaving", "no_answer", "leaving", "needs_help_now", "leaving",
];

export function buildChongqing(at: string, devicePhones: (string | null)[] = []): ScenarioBuild {
  const r = rng(20220821);
  const zones = mkZones("chongqing", ZONES, "北碚区森林防灭火指挥部值班领导 (seed)", at);
  const z = (id: string) => zones.find((x) => x.id === id)!;
  const phone = (i: number) => devicePhones[i - 1] ?? null;
  const C = (over: Partial<Household> & Pick<Household, "id" | "name" | "lat" | "lng">) => person("chongqing", over);

  const devices: Household[] = [
    C({ id: hid(1), name: "张丽 Zhang Li", address: "天生街道（演示）", lng: 106.408, lat: 29.797, ...ZH,
      has_device: true, device_label: "Phone 1", synthetic: false, phone_e164: phone(1), sim_profile: "leaving",
      can_drive_neighbors: true, seats: 2, memory_note: "两个孩子，开一辆小轿车；是隔壁赵大爷的帮扶责任人。" }),
    C({ id: hid(2), name: "王建国 Wang Jianguo", address: "天生街道（演示）", lng: 106.414, lat: 29.79, ...ZH,
      has_device: true, device_label: "Phone 2", synthetic: false, phone_e164: phone(2), sim_profile: "needs_help_leaving",
      afn_flags: ["wheelchair", "no_car"], memory_note: "老伴坐轮椅，家里没有车。" }),
    C({ id: hid(3), name: "李明（网格员）", address: "天生街道东侧（演示）", lng: 106.441, lat: 29.815, ...ZH,
      has_device: true, device_label: "Phone 3", synthetic: false, phone_e164: phone(3), role: "sentinel", on_post: true, sim_profile: "sentinel_yes",
      memory_note: "社区网格员，哨点。" }),
    C({ id: hid(4), name: "陈芳（转移责任人）", address: "天生街道南侧（演示）", lng: 106.425, lat: 29.79, ...ZH,
      has_device: true, device_label: "Phone 4", synthetic: false, phone_e164: phone(4), role: "sentinel", on_post: true, sim_profile: "sentinel_yes",
      memory_note: "社区转移责任人，哨点。" }),
    C({ id: hid(5), name: "解放碑哨点 Jiefangbei sentinel", address: "渝中区（演示）", lng: 106.577, lat: 29.557, ...ZH,
      has_device: true, device_label: "Phone 5 (judge)", synthetic: false, phone_e164: phone(5), role: "sentinel", on_post: true, sim_profile: "sentinel_no" }),
    C({ id: hid(6), name: "刘洋（金丝雀）Canary", address: "嘉陵江东岸（演示）", lng: 106.485, lat: 29.805, ...ZH,
      has_device: true, device_label: "Phone 6 (canary)", synthetic: false, phone_e164: phone(6), role: "canary", sim_profile: "canary_no" }),
  ];

  const synth: Household[] = [];
  // 赵大爷 does not answer; his named help-responsible person (帮扶责任人) is Phone 1 (Chongqing 2026 regulation, Art. 8).
  synth.push(C({ id: hid(7), name: "赵大爷 Grandpa Zhao", address: "天生街道（演示）", lng: 106.409, lat: 29.796, ...ZH,
    afn_flags: ["walker", "no_car"], memory_note: "独居，用助行器。", sim_profile: "no_answer",
    linked_contact_household_id: hid(1), linked_contact_name: "张丽（帮扶责任人）" }));

  let n = 8;
  let ix = 0;
  for (const [lng, lat] of pointsIn(z("CQ-TS").geom, PROFILES.length, r)) {
    const p = NAMES[ix % NAMES.length];
    synth.push(C({ id: hid(n++), name: p.name, ...p.lang, address: "天生街道（演示）", lng, lat, sim_profile: PROFILES[ix % PROFILES.length],
      afn_flags: ix === 10 ? ["wheelchair"] : ix === 18 ? ["oxygen"] : [] }));
    ix++;
  }
  for (const [zoneId, count] of [["CQ-JY", 5], ["CQ-CY", 6], ["CQ-XM", 4]] as const) {
    for (const [lng, lat] of pointsIn(z(zoneId).geom, count, r)) {
      const p = NAMES[ix % NAMES.length];
      synth.push(C({ id: hid(n++), name: p.name, ...p.lang, address: "（演示）", lng, lat, sim_profile: "leaving" }));
      ix++;
    }
  }
  // Collections line (synthetic): a retired teacher's private library of thread-bound old books.
  synth.push(C({ id: hid(95), name: "刘老师 Teacher Liu", ...ZH, address: "天生街道（演示）", lng: 106.432, lat: 29.812, sim_profile: "leaving",
    collection_note: "家藏线装古籍约200册；清单上的两箱放在书房门口" }));
  let s = 100;
  const post = (zoneId: string, vertex: number, label: string, profile: SimProfile) => {
    const [lng, lat] = inset(z(zoneId).geom, vertex, 0.2);
    synth.push(C({ id: hid(s++), name: label, address: `${z(zoneId).name}（演示）`, lng, lat, role: "sentinel", on_post: true, sim_profile: profile }));
  };
  post("CQ-TS", 0, "天生街道网格员（西北哨点）", "sentinel_yes");
  post("CQ-TS", 2, "天生街道网格员（东北哨点）", "sentinel_yes");
  post("CQ-JY", 1, "北温泉哨点", "sentinel_yes");
  post("CQ-JY", 4, "缙云山脚哨点", "sentinel_yes");
  post("CQ-CY", 2, "朝阳街道哨点", "sentinel_no");
  post("CQ-XM", 1, "歇马街道哨点", "sentinel_yes");
  post("CQ-CJ", 2, "澄江镇哨点", "silent");
  // Far points of central Chongqing (only matter when the wrong, citywide polygon is composed).
  synth.push(C({ id: hid(s++), name: "沙坪坝哨点 Shapingba", lng: 106.456, lat: 29.541, role: "sentinel", on_post: true, sim_profile: "sentinel_no" }));
  synth.push(C({ id: hid(s++), name: "江北哨点 Jiangbei", lng: 106.574, lat: 29.606, role: "sentinel", on_post: true, sim_profile: "sentinel_no" }));
  synth.push(C({ id: hid(s++), name: "南岸哨点 Nan'an", lng: 106.644, lat: 29.5, role: "sentinel", on_post: true, sim_profile: "silent" }));
  synth.push(C({ id: hid(s++), name: "嘉陵江东岸（金丝雀）", lng: 106.49, lat: 29.83, role: "canary", sim_profile: "canary_no" }));

  const proposals: Proposal[] = [{
    id: crypto.randomUUID(), zone_id: "CQ-TS", proposed_state: "warning", model: "fire_envelope",
    reason: "Toy fire model: the 3-hour envelope from the Jinyun Mountain side reaches the west edge of Tiansheng (天生街道).", score: 0.72,
    envelope: null, status: "open", decided_by: null, decided_at: null, decision_reason: null, created_at: at,
  }];
  return { zones, households: assignZones([...devices, ...synth], zones), proposals, presets: CHONGQING_PRESETS };
}
