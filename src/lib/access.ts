import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A single access code, set as ACCESS_CODE on the server. Sessions are an
 * HMAC of the code, so changing ACCESS_CODE signs every device out.
 */

export const SESSION_COOKIE = "mycalorie_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const CODE_PATTERN = /^\d{4,8}$/;
const DEFAULT_LENGTH = 6;

export type AccessConfig =
  | { state: "open" }
  | { state: "misconfigured" }
  | { state: "locked"; code: string; secret: string };

/**
 * Locally, with no code set, the app stays open so development isn't blocked.
 * In production a missing or malformed code fails closed.
 */
export function accessConfig(): AccessConfig {
  const code = process.env.ACCESS_CODE?.trim();
  const secret = process.env.SESSION_SECRET?.trim();
  if (!code && process.env.NODE_ENV !== "production") return { state: "open" };
  if (!code || !CODE_PATTERN.test(code) || !secret) return { state: "misconfigured" };
  return { state: "locked", code, secret };
}

export function codeLength(): number {
  const config = accessConfig();
  return config.state === "locked" ? config.code.length : DEFAULT_LENGTH;
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function sessionToken(code: string, secret: string): string {
  return createHmac("sha256", secret).update(`mycalorie-session:${code}`).digest("hex");
}

export function isValidSession(token: string | undefined, config: AccessConfig): boolean {
  if (config.state === "open") return true;
  if (config.state !== "locked" || !token) return false;
  return sameText(token, sessionToken(config.code, config.secret));
}

export function isCorrectCode(attempt: string, config: AccessConfig): boolean {
  return config.state === "locked" && sameText(attempt, config.code);
}
