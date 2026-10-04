import { createHmac, timingSafeEqual } from "node:crypto";
import { OWNER_ID, USER_ID_PATTERN } from "./users";

/**
 * Access codes, set on the server. ACCESS_CODE is the owner's; ACCESS_CODES adds other people as
 * `name:code` pairs separated by commas (e.g. `priya:48291736,rahul:20556611`), each code the same
 * length as the owner's. Sessions are an HMAC of the person and their code, so changing a code signs
 * only that person out.
 */

export const SESSION_COOKIE = "mycalorie_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const CODE_PATTERN = /^\d{4,8}$/;
const DEFAULT_LENGTH = 6;

export type AccessUser = { id: string; code: string };

export type AccessConfig =
  | { state: "open" }
  | { state: "misconfigured" }
  | { state: "locked"; users: AccessUser[]; secret: string };

/** Every request reads the config, so each skipped entry is reported once per server instance. */
const reported = new Set<string>();

/** Other people from ACCESS_CODES; malformed entries are skipped with a warning rather than locking everyone out. */
function otherUsers(raw: string | undefined, owner: string): AccessUser[] {
  const users: AccessUser[] = [];
  for (const entry of (raw ?? "").split(",").map((part) => part.trim()).filter(Boolean)) {
    const [name = "", code = ""] = entry.split(":").map((part) => part.trim());
    const id = name.toLowerCase();
    const valid =
      USER_ID_PATTERN.test(id) &&
      id !== OWNER_ID &&
      CODE_PATTERN.test(code) &&
      code.length === owner.length &&
      code !== owner &&
      !users.some((user) => user.id === id || user.code === code);
    if (valid) users.push({ id, code });
    else if (!reported.has(entry)) {
      reported.add(entry);
      console.warn(`ACCESS_CODES: skipped "${name}" (needs a lower-case name and a unique ${owner.length}-digit code)`);
    }
  }
  return users;
}

/**
 * Locally, with no code set, the app stays open so development isn't blocked.
 * In production a missing or malformed owner code fails closed.
 */
export function accessConfig(): AccessConfig {
  const code = process.env.ACCESS_CODE?.trim();
  const secret = process.env.SESSION_SECRET?.trim();
  if (!code && process.env.NODE_ENV !== "production") return { state: "open" };
  if (!code || !CODE_PATTERN.test(code) || !secret) return { state: "misconfigured" };
  return { state: "locked", users: [{ id: OWNER_ID, code }, ...otherUsers(process.env.ACCESS_CODES, code)], secret };
}

export function codeLength(): number {
  const config = accessConfig();
  return config.state === "locked" ? config.users[0].code.length : DEFAULT_LENGTH;
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const sign = (secret: string, text: string) => createHmac("sha256", secret).update(text).digest("hex");

export function sessionToken(user: AccessUser, secret: string): string {
  return `${user.id}.${sign(secret, `mycalorie-session:${user.id}:${user.code}`)}`;
}

/** Who a session cookie belongs to, or `null` when it's missing, forged, or for a changed code. */
export function sessionUser(token: string | undefined, config: AccessConfig): string | null {
  if (config.state === "open") return OWNER_ID;
  if (config.state !== "locked" || !token) return null;
  const dot = token.indexOf(".");
  if (dot === -1) {
    // Cookies from before there were several people: the owner's, signed over the code alone.
    const owner = config.users[0];
    return sameText(token, sign(config.secret, `mycalorie-session:${owner.code}`)) ? OWNER_ID : null;
  }
  const user = config.users.find((candidate) => candidate.id === token.slice(0, dot));
  return user && sameText(token, sessionToken(user, config.secret)) ? user.id : null;
}

export const isValidSession = (token: string | undefined, config: AccessConfig) => sessionUser(token, config) !== null;

/** The person a code belongs to; every code is compared, so the time taken doesn't hint at which. */
export function userForCode(attempt: string, config: AccessConfig): AccessUser | null {
  if (config.state !== "locked") return null;
  let match: AccessUser | null = null;
  for (const user of config.users) if (sameText(attempt, user.code)) match = user;
  return match;
}
