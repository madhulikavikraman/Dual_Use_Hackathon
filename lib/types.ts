export type Stage = "checkin" | "warning" | "order" | "all_clear";
export type Mode = "civilian" | "base";

export type Status =
  | "pending" | "ringing" | "on_call"
  | "safe" | "leaving" | "needs_help" | "wont_leave" | "unclear" | "wrong_number"
  | "no_answer" | "unreachable";

export type Need =
  | "wheelchair" | "walker" | "no_car" | "oxygen" | "powered_medical_device" | "dialysis"
  | "bedbound" | "children_alone" | "hearing" | "vision" | "cognitive" | "other";

export interface Household {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  has_device: boolean;
  synthetic: boolean;
  language: string;
  lang_code: string;
  afn_flags: Need[];
  memory_note: string | null;
  linked_contact_household_id: string | null;
  linked_contact_name: string | null;
  can_drive_neighbors: boolean;
  seats: number;
}

export interface Campaign {
  id: string;
  stage: Stage;
  mode: Mode;
  zone_name: string | null;
  polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  alert_text: string;
  shelter_name: string | null;
  shelter_address: string | null;
  shelter_accepts_pets: boolean | null;
  verification_phrase: string | null;
  callback_number: string | null;
  created_at: string;
}

export type CallState = "ringing" | "active" | "ended" | "no_answer" | "unreachable";

export interface Call {
  id: string;
  campaign_id: string;
  household_id: string;
  called_party: "resident" | "linked_contact";
  attempt: number;
  state: CallState;
  messages: unknown[];
  transcript: string | null;
  summary: string | null;
  analysis: Record<string, unknown> | null;
  started_at: string;
  ended_at: string | null;
  simulated: boolean;
}

export interface HouseholdStatus {
  campaign_id: string;
  household_id: string;
  status: Status;
  understood: boolean | null;
  destination: string | null;
  needs: Need[];
  needs_note: string | null;
  device_battery_hours: number | null;
  animals: string | null;
  people: number | null;
  refusal_reason: string | null;
  seats_for_neighbors: number | null;
  hazard_seen: boolean | null;
  hazard_type: string | null;
  hazard_direction: string | null;
  hazard_distance: string | null;
  distress: boolean;
  human_requested: boolean;
  human_reason: string | null;
  via: "resident" | "linked_contact";
  assigned_run: string | null;
  updated_at: string;
  simulated: boolean;
}

export interface AlertItem {
  id: string;
  campaign_id: string;
  kind: string;
  title: string;
  detail: string | null;
  geo: unknown;
  created_at: string;
}
