import { NextResponse, type NextRequest } from "next/server";
import { accessConfig, isValidSession, SESSION_COOKIE } from "@/lib/access";

/** Everything except the unlock screen, its API and the public assets needs a session. */
export function proxy(request: NextRequest) {
  const config = accessConfig();
  if (isValidSession(request.cookies.get(SESSION_COOKIE)?.value, config)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }

  const unlock = new URL("/unlock", request.url);
  const destination = request.nextUrl.pathname + request.nextUrl.search;
  if (destination !== "/") unlock.searchParams.set("next", destination);
  return NextResponse.redirect(unlock);
}

export const config = {
  matcher: [
    "/((?!unlock|api/unlock|_next/static|_next/image|icon|apple-icon|manifest.webmanifest).*)",
  ],
};
