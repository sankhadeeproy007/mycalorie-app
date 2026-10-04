import type { AppState } from "./types";

/**
 * A structural check of app data arriving from outside the app (a backup file, the cloud copy, a sync
 * upload). It checks what the app relies on to render, not every optional field.
 */

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isMacros = (value: unknown) =>
  isObject(value) && ["protein", "kcal", "carbs", "fat"].every((key) => typeof value[key] === "number");

export function isAppState(value: unknown): value is AppState {
  if (!isObject(value)) return false;
  const { settings, saved, logs } = value;
  if (!isObject(settings) || !isObject(settings.targets) || !Array.isArray(saved) || !Array.isArray(logs)) return false;
  const logsOk = logs.every(
    (log) =>
      isObject(log) &&
      typeof log.id === "string" &&
      typeof log.name === "string" &&
      typeof log.day === "string" &&
      typeof log.eatenAt === "number" &&
      isMacros(log.macros),
  );
  const savedOk = saved.every(
    (meal) => isObject(meal) && typeof meal.id === "string" && typeof meal.name === "string" && isMacros(meal.macros),
  );
  return logsOk && savedOk;
}
