import { currentUser } from "@/lib/session";
import { OWNER_ID } from "@/lib/users";
import { HomeScreen } from "./HomeScreen";

/** Rendered per request: the app's storage is kept apart per signed-in person. */
export default async function Home() {
  return <HomeScreen userId={(await currentUser()) ?? OWNER_ID} />;
}
