import { NextResponse } from "next/server";
import {
  accessConfig,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionToken,
  userForCode,
} from "@/lib/access";

const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const FAILURE_DELAY_MS = 700;

/**
 * Wrong attempts per client address. It lives in this server instance's
 * memory, so it is best-effort on serverless; the delay on every failure
 * slows guessing either way.
 */
const failures = new Map<string, { count: number; since: number }>();

function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function lockedOut(address: string, now: number): boolean {
  const entry = failures.get(address);
  if (!entry) return false;
  if (now - entry.since > LOCKOUT_MS) {
    failures.delete(address);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(address: string, now: number) {
  const entry = failures.get(address);
  failures.set(address, entry ? { ...entry, count: entry.count + 1 } : { count: 1, since: now });
}

export async function POST(request: Request) {
  const config = accessConfig();
  if (config.state === "misconfigured") return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (config.state === "open") return NextResponse.json({ ok: true });

  const address = clientAddress(request);
  const now = Date.now();
  if (lockedOut(address, now)) return NextResponse.json({ error: "too_many" }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const attempt = typeof body?.code === "string" ? body.code : "";

  const user = userForCode(attempt, config);
  if (!user) {
    recordFailure(address, now);
    await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
    return NextResponse.json({ error: "wrong_code" }, { status: 401 });
  }

  failures.delete(address);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionToken(user, config.secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
