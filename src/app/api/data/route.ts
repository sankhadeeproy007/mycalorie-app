import { isAppState } from "@/lib/app-state-check";
import { cloudConfigured, readCloud, writeCloud } from "@/lib/cloud-store";
import { currentUser } from "@/lib/session";

/** The signed-in person's data in the cloud: GET reads it, PUT replaces it if nothing newer was saved meanwhile. */

const MAX_BODY_CHARS = 4_000_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const NO_STORE = { "Cache-Control": "no-store" };

function failed(error: unknown) {
  console.error("cloud data", error);
  return Response.json({ error: "storage" }, { status: 502, headers: NO_STORE });
}

/** `?have=<rev>` skips sending the state when the phone already holds that revision. */
export async function GET(request: Request) {
  // The proxy already guards /api; checking here keeps the data locked even if that matcher ever changes.
  const user = await currentUser();
  if (!user) return Response.json({ error: "locked" }, { status: 401 });
  if (!cloudConfigured()) return Response.json({ configured: false }, { headers: NO_STORE });
  const have = Number(new URL(request.url).searchParams.get("have"));
  try {
    const copy = await readCloud(user, Number.isInteger(have) && have > 0 ? have : undefined);
    return Response.json({ configured: true, ...copy }, { headers: NO_STORE });
  } catch (error) {
    return failed(error);
  }
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "locked" }, { status: 401 });
  if (!cloudConfigured()) return Response.json({ configured: false }, { status: 409, headers: NO_STORE });

  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return Response.json({ error: "too_large" }, { status: 413 });
  let body: { state?: unknown; baseRev?: unknown; day?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const { state, baseRev, day } = body;
  if (!isAppState(state) || typeof baseRev !== "number" || !Number.isInteger(baseRev) || typeof day !== "string" || !DAY.test(day)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const result = await writeCloud(user, { state, baseRev, day });
    if (result.saved) return Response.json({ rev: result.rev }, { headers: NO_STORE });
    // Something newer is in the cloud: send it back so the phone can fold its changes in and retry.
    return Response.json({ conflict: true, ...(await readCloud(user)) }, { status: 409, headers: NO_STORE });
  } catch (error) {
    return failed(error);
  }
}
