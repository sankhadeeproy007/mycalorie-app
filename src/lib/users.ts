/** The owner signs in with ACCESS_CODE and keeps the original storage keys; other people get their own. */
export const OWNER_ID = "owner";

/** Lower-case letters, digits and dashes: it ends up in storage keys. */
export const USER_ID_PATTERN = /^[a-z][a-z0-9-]{0,23}$/;
