import { NextResponse, type NextRequest } from "next/server";

// Desk access control. When DESK_PASSWORD is set (e.g. behind a public tunnel), the supervisor's pages and APIs —
// the board, the help registry with phone numbers, approvals, resets, exports — need HTTP Basic auth (any user
// name, that password). Left open: volunteers' phone pages and their API, the public line, Retell (signed
// requests), the GeoJSON feeds (FEED_TOKEN), the health check, and the two links sent by text message: the
// resident's live-location page (/l/, /api/locate/) and the helper's page (/helper/, /api/helper/). Those open from
// a text, so the unguessable token in the path is the key. Also open: the landing page and the read-only public pages
// in PUBLIC_PAGE_PREFIXES below, so a visitor or judge never meets a sign-in before the desk itself. With
// DESK_PASSWORD unset nothing changes.

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Pages anyone may read without the desk password: the landing page, Twist 2 (/global, /global/flood), the poster,
// the twists and evidence pages, and the images and icons they use. They show no personal data.
const PUBLIC_PAGE_PREFIXES = ["/global", "/poster", "/twists", "/evidence", "/brand/", "/icon", "/apple-icon", "/opengraph-image"];
// Read-only data those public pages fetch (aggregate numbers and the twist log; no names, phones or locations).
const PUBLIC_GET_APIS = ["/api/evidence", "/api/twists"];

function isPublic(req: NextRequest): boolean {
  const path = req.nextUrl.pathname;
  if (path === "/") return true;
  if (PUBLIC_PAGE_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`) || path.startsWith(`${p}.`))) return true;
  if ((req.method === "GET" || req.method === "HEAD") && PUBLIC_GET_APIS.some((p) => path === p)) return true;
  return false;
}

export function proxy(req: NextRequest) {
  const password = process.env.DESK_PASSWORD;
  if (!password || isPublic(req)) return NextResponse.next();
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      if (sameSecret(decoded.slice(decoded.indexOf(":") + 1), password)) return NextResponse.next();
    } catch {
      // malformed header: fall through to the challenge
    }
  }
  return new NextResponse("VoiceFlare desk: sign in required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="VoiceFlare desk", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except Next's own assets and the open paths listed above.
  matcher: ["/((?!_next/|favicon\\.ico|phone/|api/phone/|call|api/call|api/retell/|api/feeds/|api/health|l/|api/locate/|helper/|api/helper/).*)"],
};
