import { NextResponse, type NextRequest } from "next/server";

// Desk access control. When DESK_PASSWORD is set (e.g. behind a public tunnel), the supervisor's pages and APIs —
// the board, the help registry with phone numbers, approvals, resets, exports — need HTTP Basic auth (any user
// name, that password). Left open: volunteers' phone pages and their API, the public line, Retell (signed
// requests), the GeoJSON feeds (FEED_TOKEN) and the health check. With DESK_PASSWORD unset nothing changes.

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function proxy(req: NextRequest) {
  const password = process.env.DESK_PASSWORD;
  if (!password) return NextResponse.next();
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
  matcher: ["/((?!_next/|favicon\\.ico|phone/|api/phone/|call|api/call|api/retell/|api/feeds/|api/health).*)"],
};
