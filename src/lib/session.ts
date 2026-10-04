import "server-only";
import { cookies } from "next/headers";
import { accessConfig, SESSION_COOKIE, sessionUser } from "./access";

/** The signed-in person for this request, or `null`. The proxy already turns away requests without a session. */
export async function currentUser(): Promise<string | null> {
  return sessionUser((await cookies()).get(SESSION_COOKIE)?.value, accessConfig());
}
