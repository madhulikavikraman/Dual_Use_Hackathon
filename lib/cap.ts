// CAP 1.2 (OASIS Common Alerting Protocol, the format IPAWS accepts) for a zone or a hold (PRD 17.1, item 19).
// Every message is status "Exercise": every send in this build is simulated and reaches no alert system.
// Pure functions; safe on server and client.
import type { Mode, ZoneState } from "@/lib/types";

export const CAP_NS = "urn:oasis:names:tc:emergency:cap:1.2";

export interface CapInput {
  identifier: string;
  sent: string; // ISO 8601
  state: ZoneState;
  mode: Mode;
  /** "Fire", "Geo" (earthquake), "Safety", "Security"; derived from the state and mode when omitted. */
  category?: string;
  quake?: boolean;
  areaDesc: string;
  polygon: GeoJSON.Polygon;
  directive: string; // the approved directive, read verbatim
  moveText: string | null;
  evacPoint: string | null;
  senderName: string;
  note?: string;
  /** Extra name/value pairs carried as CAP parameters (e.g. the hold id, the dose estimate). */
  parameters?: Record<string, string | number>;
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

/** Escape text for XML element content and attributes; drop characters XML 1.0 forbids. */
export function xmlEscape(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "").replace(/[&<>"']/g, (c) => ESC[c]);
}

/** CAP DateTime: "2026-10-17T03:40:00-00:00" (no fractional seconds; "Z" is not allowed in CAP 1.2). */
export function capTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toISOString().replace(/\.\d{3}Z$/, "-00:00").replace(/Z$/, "-00:00");
}

/** CAP polygon: "lat,lon lat,lon ..." with the first and last pairs equal (a closed ring of at least 4 pairs). */
export function capPolygon(geom: GeoJSON.Polygon): string {
  const ring = geom.coordinates[0].map(([lng, lat]) => [+lat.toFixed(5), +lng.toFixed(5)] as const);
  if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) ring.push(ring[0]);
  return ring.map(([lat, lng]) => `${lat},${lng}`).join(" ");
}

/** CAP identifiers may not contain spaces, commas or the characters < and &. */
export function capIdentifier(...parts: string[]): string {
  return parts.join("-").replace(/[\s,<&]+/g, "_");
}

interface StateMap {
  event: string;
  responseType: string;
  urgency: string;
  severity: string;
  certainty: string;
  same: string | null; // EAS/SAME event code
}

function mapState(state: ZoneState, mode: Mode, quake: boolean): StateMap {
  if (mode === "heat") return heatState(state);
  const civil = mode === "civilian";
  switch (state) {
    case "order":
      return { event: civil ? "Evacuation Order" : mode === "base" ? "Evacuate" : "Leave the Area", responseType: "Evacuate", urgency: "Immediate", severity: "Extreme", certainty: "Observed", same: "EVI" };
    case "warning":
      return { event: civil ? "Evacuation Warning" : "Avoid the Area", responseType: civil ? "Prepare" : "Avoid", urgency: "Expected", severity: "Severe", certainty: "Likely", same: civil && !quake ? "FRW" : "CEM" };
    case "shelter_in_place":
      return { event: mode === "base" ? "Lockdown" : "Shelter in Place", responseType: "Shelter", urgency: "Immediate", severity: "Severe", certainty: "Observed", same: "SPW" };
    case "watch":
      return { event: "Advisory", responseType: "Monitor", urgency: "Future", severity: "Moderate", certainty: "Possible", same: "ADR" };
    case "lifted":
      return { event: civil ? "Evacuation Orders Lifted" : "All Clear", responseType: "AllClear", urgency: "Past", severity: "Minor", certainty: "Observed", same: "ADR" };
    case "monitor":
    default:
      return { event: "Monitor", responseType: "None", urgency: "Unknown", severity: "Unknown", certainty: "Unknown", same: null };
  }
}

/** Heat check-in line: the ladder's rung names (no EAS/SAME code is claimed for a demo line). */
function heatState(state: ZoneState): StateMap {
  switch (state) {
    case "order":
      return { event: "Extreme Heat (heat check-in line)", responseType: "Execute", urgency: "Immediate", severity: "Extreme", certainty: "Likely", same: null };
    case "warning":
      return { event: "Heat Advisory (heat check-in line)", responseType: "Prepare", urgency: "Expected", severity: "Severe", certainty: "Likely", same: null };
    case "shelter_in_place":
      return { event: "Stay indoors (heat check-in line)", responseType: "Shelter", urgency: "Immediate", severity: "Severe", certainty: "Likely", same: null };
    case "watch":
      return { event: "Heat watch (heat check-in line)", responseType: "Monitor", urgency: "Future", severity: "Moderate", certainty: "Possible", same: null };
    case "lifted":
      return { event: "Heat over", responseType: "AllClear", urgency: "Past", severity: "Minor", certainty: "Observed", same: null };
    case "monitor":
    default:
      return { event: "Monitor", responseType: "None", urgency: "Unknown", severity: "Unknown", certainty: "Unknown", same: null };
  }
}

function category(input: CapInput): string {
  if (input.category) return input.category;
  if (input.mode === "base") return "Security";
  if (input.mode === "heat") return "Met";
  if (input.state === "shelter_in_place") return input.quake ? "Geo" : "Safety";
  return "Fire";
}

/** Build a CAP 1.2 alert document. */
export function buildCap(input: CapInput): string {
  const m = mapState(input.state, input.mode, Boolean(input.quake));
  const sent = new Date(input.sent);
  const expires = new Date(sent.getTime() + 6 * 3600_000);
  const instruction = [input.moveText?.trim(), input.evacPoint ? `Evacuation point: ${input.evacPoint}.` : null].filter(Boolean).join(" ");
  const headline = `${m.event}: ${input.areaDesc}`.slice(0, 160);
  const e = xmlEscape;
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<alert xmlns="${CAP_NS}">`);
  lines.push(`  <identifier>${e(input.identifier)}</identifier>`);
  lines.push("  <sender>voiceflare@demo.invalid</sender>");
  lines.push(`  <sent>${capTime(sent)}</sent>`);
  lines.push("  <status>Exercise</status>");
  lines.push("  <msgType>Alert</msgType>");
  lines.push("  <source>VoiceFlare (demo)</source>");
  lines.push("  <scope>Public</scope>");
  lines.push(
    `  <note>${e(input.note ?? "Exercise: demo alert from a hackathon demonstration (VoiceFlare). It was not sent to IPAWS or any alert system.")}</note>`,
  );
  lines.push("  <info>");
  lines.push("    <language>en-US</language>");
  lines.push(`    <category>${e(category(input))}</category>`);
  lines.push(`    <event>${e(m.event)}</event>`);
  lines.push(`    <responseType>${m.responseType}</responseType>`);
  lines.push(`    <urgency>${m.urgency}</urgency>`);
  lines.push(`    <severity>${m.severity}</severity>`);
  lines.push(`    <certainty>${m.certainty}</certainty>`);
  if (m.same) {
    lines.push("    <eventCode>");
    lines.push("      <valueName>SAME</valueName>");
    lines.push(`      <value>${m.same}</value>`);
    lines.push("    </eventCode>");
  }
  lines.push(`    <expires>${capTime(expires)}</expires>`);
  lines.push(`    <senderName>${e(input.senderName)}</senderName>`);
  lines.push(`    <headline>${e(headline)}</headline>`);
  lines.push(`    <description>${e(input.directive || m.event)}</description>`);
  if (instruction) lines.push(`    <instruction>${e(instruction)}</instruction>`);
  for (const [k, v] of Object.entries(input.parameters ?? {})) {
    lines.push("    <parameter>");
    lines.push(`      <valueName>${e(k)}</valueName>`);
    lines.push(`      <value>${e(String(v))}</value>`);
    lines.push("    </parameter>");
  }
  lines.push("    <area>");
  lines.push(`      <areaDesc>${e(input.areaDesc)}</areaDesc>`);
  lines.push(`      <polygon>${capPolygon(input.polygon)}</polygon>`);
  lines.push("    </area>");
  lines.push("  </info>");
  lines.push("</alert>");
  return lines.join("\n") + "\n";
}
