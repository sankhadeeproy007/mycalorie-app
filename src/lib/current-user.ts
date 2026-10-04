import { OWNER_ID } from "./users";

/**
 * Who is signed in on this device, set once by the home screen from the server's session. The owner
 * keeps the original browser storage keys; anyone else gets their own, so people never see or sync
 * each other's data even on a shared phone.
 */

let current = OWNER_ID;

export function setCurrentUser(id: string) {
  current = id;
}

export const isOwner = () => current === OWNER_ID;

export const userKey = (base: string) => (current === OWNER_ID ? base : `${base}:${current}`);
