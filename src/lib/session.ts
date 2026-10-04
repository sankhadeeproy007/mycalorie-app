import "server-only";
import { cookies } from "next/headers";
import { accessConfig, SESSION_COOKIE, sessionUser } from "./access";
import { OWNER_ID } from "./users";

/** The signed-in person for this request, or `null`. The proxy already turns away requests without a session. */
export async function currentUser(): Promise<string | null> {
  return sessionUser((await cookies()).get(SESSION_COOKIE)?.value, accessConfig());
}

/** Claude is paid for by the owner, so only the owner can ask it. */
export async function mayUseClaude(): Promise<boolean> {
  return (await currentUser()) === OWNER_ID;
}

export const CLAUDE_REFUSED = { error: "not_configured", detail: "claude is for the owner only" } as const;
