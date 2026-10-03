import type { MealLog, SavedMeal } from "./types";

type Mealtime = "morning" | "midday" | "evening";

function mealtimeOf(date: Date): Mealtime {
  const hour = date.getHours();
  if (hour < 11) return "morning";
  if (hour < 16) return "midday";
  return "evening";
}

/**
 * Meals usually eaten at this time of day come first (breakfasts in the
 * morning), then the most used overall, then the newest. Only past days
 * count, so logging a meal never reshuffles the shelf under your thumb.
 */
export function orderShelf(saved: SavedMeal[], logs: MealLog[], today: string, now: Date = new Date()): SavedMeal[] {
  const current = mealtimeOf(now);
  const usage = new Map<string, { now: number; total: number }>();

  for (const log of logs) {
    if (!log.savedMealId || log.day === today) continue;
    const entry = usage.get(log.savedMealId) ?? { now: 0, total: 0 };
    entry.total += 1;
    if (mealtimeOf(new Date(log.eatenAt)) === current) entry.now += 1;
    usage.set(log.savedMealId, entry);
  }

  const score = (meal: SavedMeal) => usage.get(meal.id) ?? { now: 0, total: 0 };
  return [...saved].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    return sb.now - sa.now || sb.total - sa.total || b.createdAt - a.createdAt;
  });
}
