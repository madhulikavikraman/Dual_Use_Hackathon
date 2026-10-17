// The helper roster for "Send helper": a few CERT volunteer teams and quick response team units per scenario.
// Simulated people with no phone numbers; the dispatcher may type a real number to text the helper link.
// Client-safe (pure data).
import type { Helper, Scenario } from "@/lib/types";

const GENERIC: Helper[] = [
  { id: "qrt-1", label: "QRT unit 1 (accessible van)", kind: "qrt", vehicle: "accessible_van", note: "Wheelchair lift, two staff" },
  { id: "qrt-2", label: "QRT unit 2 (car)", kind: "qrt", vehicle: "car", note: "Two staff, four seats" },
  { id: "cert-1", label: "CERT volunteers (2)", kind: "cert", vehicle: "on_foot", note: "Door knock and check on a person" },
];

export const HELPER_ROSTER: Record<Scenario, Helper[]> = {
  westside: [
    { id: "qrt-1", label: "QRT unit 1 (accessible van)", kind: "qrt", vehicle: "accessible_van", note: "Wheelchair lift, two staff" },
    { id: "qrt-2", label: "QRT unit 2 (car)", kind: "qrt", vehicle: "car", note: "Two staff, four seats" },
    { id: "cert-palms", label: "CERT volunteers, Palms (2)", kind: "cert", vehicle: "on_foot", note: "Door knock and check on a person" },
    { id: "cert-culver", label: "CERT volunteers, Culver City (2)", kind: "cert", vehicle: "car", note: "One car, three seats" },
  ],
  norte: [
    { id: "qrt-1", label: "QRT unit 1 (accessible van)", kind: "qrt", vehicle: "accessible_van", note: "Wheelchair lift, two staff" },
    { id: "qrt-2", label: "QRT unit 2 (car)", kind: "qrt", vehicle: "car", note: "Two staff, four seats" },
    { id: "cert-sc", label: "CERT volunteers, San Clemente (2)", kind: "cert", vehicle: "car", note: "One car, three seats" },
  ],
  // Heat line: a wellness visit is a helper too (door knock, water, a ride to a cooling center).
  heat: [
    { id: "van-1", label: "Senior services van (accessible)", kind: "qrt", vehicle: "accessible_van", note: "Wheelchair lift; rides to a cooling center" },
    { id: "well-rs", label: "Wellness volunteers, Reseda (2)", kind: "cert", vehicle: "car", note: "Door knock, water, check on a person" },
    { id: "well-wh", label: "Wellness volunteers, Woodland Hills (2)", kind: "cert", vehicle: "car", note: "Door knock, water, check on a person" },
    { id: "qrt-2", label: "QRT unit 2 (car)", kind: "qrt", vehicle: "car", note: "Two staff, four seats" },
  ],
  altadena: GENERIC,
  chongqing: [
    { id: "grid-1", label: "Grid worker team (2)", kind: "cert", vehicle: "on_foot", note: "Knows the residents on the slope" },
    { id: "qrt-1", label: "Street rescue team (accessible van)", kind: "qrt", vehicle: "accessible_van", note: "Wheelchair lift" },
  ],
};

export function rosterFor(scenario: Scenario): Helper[] {
  return HELPER_ROSTER[scenario] ?? GENERIC;
}
