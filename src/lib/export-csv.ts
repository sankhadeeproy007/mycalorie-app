import { formatQuantity, formatUnit } from "./items";
import { dayScore, totalsByDay } from "./progress";
import type { MealLog, Targets } from "./types";

/**
 * Spreadsheet exports of the logged data: one row per meal, and one row per day against the targets.
 * Plain CSV with a byte-order mark, so Excel and Numbers read ½ and other non-ASCII text correctly.
 */

const cell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (rows: (string | number | null | undefined)[][]) => "﻿" + rows.map((row) => row.map(cell).join(",")).join("\n") + "\n";

const clock = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const describeItems = (log: MealLog) =>
  (log.items ?? []).map((item) => `${formatQuantity(item.quantity)} ${formatUnit(item.unit, item.quantity)} ${item.name}`).join("; ");

export function mealsCsv(logs: MealLog[]): string {
  const rows = [...logs]
    .sort((a, b) => a.eatenAt - b.eatenAt)
    .map((log) => [
      log.day,
      clock(log.eatenAt),
      log.name,
      log.portion,
      log.macros.protein,
      log.macros.kcal,
      log.macros.carbs,
      log.macros.fat,
      describeItems(log),
    ]);
  return toCsv([["date", "time", "meal", "portion", "protein_g", "kcal", "carbs_g", "fat_g", "items"], ...rows]);
}

/** Targets are today's, not the ones in force on each past day; the app doesn't keep target history. */
export function dailyCsv(logs: MealLog[], targets: Targets): string {
  const meals = new Map<string, number>();
  logs.forEach((log) => meals.set(log.day, (meals.get(log.day) ?? 0) + 1));
  const rows = [...totalsByDay(logs).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, totals]) => [
      day,
      meals.get(day) ?? 0,
      totals.protein,
      totals.kcal,
      totals.carbs,
      totals.fat,
      targets.protein,
      targets.kcal,
      targets.carbs,
      targets.fat,
      dayScore(totals, targets),
    ]);
  return toCsv([
    ["date", "meals", "protein_g", "kcal", "carbs_g", "fat_g", "protein_target_g", "kcal_target", "carbs_target_g", "fat_target_g", "score"],
    ...rows,
  ]);
}
