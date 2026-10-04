import "server-only";
import { isAppState } from "./app-state-check";
import type { AppState } from "./types";

/**
 * The cloud copy of the app's data, in Upstash Redis over its REST API. One key holds the whole state
 * as JSON and another its revision, so a phone holding an older copy can't overwrite a newer one.
 * Each write also keeps that day's last state for 30 days, as a way back from a bad overwrite.
 */

const STATE_KEY = "mycalorie:state";
const REV_KEY = "mycalorie:rev";
const SNAPSHOT_PREFIX = "mycalorie:snapshot:";
const SNAPSHOT_SECONDS = 60 * 60 * 24 * 30;

/** Vercel's Upstash integration names these KV_REST_API_*; a direct Upstash setup names them UPSTASH_REDIS_REST_*. */
function redisConfig(): { url: string; token: string } | null {
  const url = (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)?.trim();
  const token = (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)?.trim();
  return url && token ? { url, token } : null;
}

export const cloudConfigured = () => redisConfig() !== null;

async function redis<T>(command: (string | number)[]): Promise<T> {
  const config = redisConfig();
  if (!config) throw new Error("Redis is not configured");
  const response = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!response.ok || body.error) throw new Error(`redis ${response.status}: ${body.error ?? "no body"}`);
  return body.result as T;
}

/** `unchanged` means the caller already holds this revision, so the state wasn't fetched. */
export type CloudCopy = { rev: number; state: AppState | null; updatedAt: number | null; unchanged?: boolean };

type StoredState = { state: AppState; updatedAt: number };

export async function readCloud(have?: number): Promise<CloudCopy> {
  if (have !== undefined) {
    const current = Number((await redis<string | null>(["GET", REV_KEY])) ?? 0);
    if (current === have) return { rev: current, state: null, updatedAt: null, unchanged: true };
  }
  const [rev, raw] = await redis<[string | null, string | null]>(["MGET", REV_KEY, STATE_KEY]);
  let stored: StoredState | null = null;
  try {
    stored = raw ? (JSON.parse(raw) as StoredState) : null;
  } catch {
    stored = null;
  }
  const state = stored && isAppState(stored.state) ? stored.state : null;
  return { rev: Number(rev ?? 0), state, updatedAt: state ? stored!.updatedAt : null };
}

/** Saves only if the cloud is still at `baseRev`; the check and the write are one atomic script. */
const WRITE_IF_CURRENT = `
local rev = tonumber(redis.call('GET', KEYS[1]) or '0')
if rev ~= tonumber(ARGV[1]) then return {0, rev} end
redis.call('SET', KEYS[2], ARGV[2])
redis.call('SET', KEYS[3], ARGV[2], 'EX', ARGV[3])
return {1, redis.call('INCR', KEYS[1])}
`;

export async function writeCloud(
  state: AppState,
  baseRev: number,
  day: string,
): Promise<{ saved: true; rev: number } | { saved: false }> {
  const stored: StoredState = { state, updatedAt: Date.now() };
  const [saved, rev] = await redis<[number, number]>([
    "EVAL",
    WRITE_IF_CURRENT,
    3,
    REV_KEY,
    STATE_KEY,
    `${SNAPSHOT_PREFIX}${day}`,
    baseRev,
    JSON.stringify(stored),
    SNAPSHOT_SECONDS,
  ]);
  return saved === 1 ? { saved: true, rev } : { saved: false };
}
