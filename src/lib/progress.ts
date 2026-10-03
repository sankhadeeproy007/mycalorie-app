import { dayKey } from "./day";
import { ZERO_MACROS, type Macros, type MealLog, type Targets } from "./types";

/**
 * The game layer: a day score, the protein streak, the consistency graph and
 * milestones. Past days are judged against today's targets because targets
 * are not stored per day yet.
 */

const PROTEIN_WEIGHT = 0.5;
const OTHER_WEIGHT = (1 - PROTEIN_WEIGHT) / 3;
const RECENT_DAYS = 7;
export const GRAPH_WEEKS = 12;

export const STREAK_MILESTONES = [7, 14, 21, 30, 50, 75, 100, 150, 200, 365];
export const MEAL_MILESTONES = [10, 25, 50, 100, 250, 500, 1000];

export function totalsByDay(logs: MealLog[]): Map<string, Macros> {
  const totals = new Map<string, Macros>();
  for (const log of logs) {
    const sum = totals.get(log.day) ?? ZERO_MACROS;
    totals.set(log.day, {
      protein: sum.protein + log.macros.protein,
      kcal: sum.kcal + log.macros.kcal,
      carbs: sum.carbs + log.macros.carbs,
      fat: sum.fat + log.macros.fat,
    });
  }
  return totals;
}

/** 1 when on target, falling linearly to 0 at double or nothing. */
function closeness(eaten: number, target: number): number {
  return Math.max(0, 1 - Math.abs(eaten - target) / target);
}

/**
 * 0–100. Protein carries half the score and only counts shortfall (more
 * protein never costs points); calories, carbs and fat share the rest by
 * how close they landed. Targets that aren't set are left out.
 */
export function dayScore(eaten: Macros, targets: Targets): number | null {
  if (!targets.protein) return null;
  let score = PROTEIN_WEIGHT * Math.min(1, eaten.protein / targets.protein);
  let weight = PROTEIN_WEIGHT;
  for (const key of ["kcal", "carbs", "fat"] as const) {
    const target = targets[key];
    if (!target) continue;
    score += OTHER_WEIGHT * closeness(eaten[key], target);
    weight += OTHER_WEIGHT;
  }
  return Math.round((score / weight) * 100);
}

function shiftDay(key: string, offset: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + offset));
}

const hitProtein = (totals: Macros | undefined, target: number) => (totals?.protein ?? 0) >= target;

export type Streaks = { current: number; best: number; hitToday: boolean };

/** Consecutive days at or above the protein target. Today only counts once it's hit, so a streak never breaks mid-day. */
export function proteinStreaks(byDay: Map<string, Macros>, target: number | null, today: string): Streaks {
  if (!target) return { current: 0, best: 0, hitToday: false };
  const hitToday = hitProtein(byDay.get(today), target);

  let current = hitToday ? 1 : 0;
  for (let day = shiftDay(today, -1); hitProtein(byDay.get(day), target); day = shiftDay(day, -1)) current += 1;

  let best = current;
  let run = 0;
  for (const day of [...byDay.keys()].sort()) {
    const previous = shiftDay(day, -1);
    run = hitProtein(byDay.get(day), target) ? (hitProtein(byDay.get(previous), target) ? run + 1 : 1) : 0;
    best = Math.max(best, run);
  }
  return { current, best, hitToday };
}

/** Graph levels: 0 nothing logged, 1 under half, 2 under 80%, 3 under target, 4 target hit. */
export type GraphCell = { day: string; level: 0 | 1 | 2 | 3 | 4; future: boolean };

export function consistencyGraph(byDay: Map<string, Macros>, target: number | null, today: string): GraphCell[][] {
  const [y, m, d] = today.split("-").map(Number);
  const mondayOffset = (new Date(y, m - 1, d).getDay() + 6) % 7;
  const firstDay = shiftDay(today, -mondayOffset - (GRAPH_WEEKS - 1) * 7);

  return Array.from({ length: GRAPH_WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const day = shiftDay(firstDay, week * 7 + weekday);
      const protein = byDay.get(day)?.protein;
      let level: GraphCell["level"] = 0;
      if (protein !== undefined && target) {
        const ratio = protein / target;
        level = ratio >= 1 ? 4 : ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;
      } else if (protein !== undefined) {
        level = 2;
      }
      return { day, level, future: day > today };
    }),
  );
}

export type PastScore = { day: string; score: number | null };

/**
 * The finished days before today, oldest first. Today is left out on purpose:
 * comparing a half-eaten day with whole days would read as falling behind.
 */
export function recentScores(byDay: Map<string, Macros>, targets: Targets, today: string): PastScore[] {
  return Array.from({ length: RECENT_DAYS }, (_, index) => {
    const day = shiftDay(today, index - RECENT_DAYS);
    const totals = byDay.get(day);
    return { day, score: totals ? dayScore(totals, targets) : null };
  });
}

export type NextMilestone = { label: string; remaining: number };

/** The closest upcoming milestone, streak or meal count, whichever is fewer steps away. */
export function nextMilestone(streak: number, mealsLogged: number): NextMilestone | null {
  const streakGoal = STREAK_MILESTONES.find((goal) => goal > streak);
  const mealGoal = MEAL_MILESTONES.find((goal) => goal > mealsLogged);
  const options: NextMilestone[] = [];
  if (streakGoal) options.push({ label: `${streakGoal}d`, remaining: streakGoal - streak });
  if (mealGoal) options.push({ label: `${mealGoal} meals`, remaining: mealGoal - mealsLogged });
  return options.sort((a, b) => a.remaining - b.remaining)[0] ?? null;
}
