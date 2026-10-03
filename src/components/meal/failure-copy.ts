import type { AnalyzeFailure } from "@/lib/meal-api";

export const FAILURE_COPY: Record<AnalyzeFailure, string> = {
  not_configured: "Photo reading isn’t set up yet (the Gemini key is missing). Enter this one by hand.",
  quota: "Today’s free AI allowance is used up. Enter this one by hand, or try again later.",
  unreadable: "Couldn’t find food or a nutrition label there. Try another photo, or enter it by hand.",
  offline: "You’re offline, so the AI can’t be reached. Enter it by hand.",
  failed: "Something went wrong reading that. Try again, or enter it by hand.",
};
