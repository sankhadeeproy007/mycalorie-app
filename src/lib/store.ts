"use client";

import { useSyncExternalStore } from "react";
import { dayKey } from "./day";
import { demoState } from "./demo";
import { NO_TARGETS, type AppState, type Macros, type MealLog, type SavedMeal, type Targets } from "./types";

/**
 * Browser-local store. It sits behind these functions so the Supabase
 * milestone can replace persistence without touching the UI.
 */

const STORAGE_KEY = "mycalorie:v1";
const DEMO_KEY = "mycalorie:demo:v3";

const EMPTY_STATE: AppState = { settings: { targets: NO_TARGETS }, saved: [], logs: [] };

/** Older saves stored only a protein target; carry it into the full set of targets. */
type LegacySettings = { proteinTarget?: number | null; targets?: Targets };

function migrate(saved: Omit<AppState, "settings"> & { settings?: LegacySettings }): AppState {
  const { proteinTarget = null, targets } = saved.settings ?? {};
  return {
    ...EMPTY_STATE,
    ...saved,
    settings: { targets: targets ?? { ...NO_TARGETS, protein: proteinTarget } },
  };
}

let state: AppState | null = null;
const listeners = new Set<() => void>();

export function isDemo(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo");
}

function storageKey(): string {
  return isDemo() ? DEMO_KEY : STORAGE_KEY;
}

function load(): AppState {
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (raw) return migrate(JSON.parse(raw));
  } catch {
    // Unreadable or blocked storage: start fresh rather than crash.
  }
  return isDemo() ? demoState(dayKey()) : EMPTY_STATE;
}

function persist(next: AppState) {
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(next));
  } catch (error) {
    console.warn("Could not save to this browser's storage", error);
  }
}

function commit(update: (prev: AppState) => AppState) {
  state = update(getSnapshot());
  persist(state);
  listeners.forEach((listener) => listener());
}

function getSnapshot(): AppState {
  if (state === null) state = load();
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey()) return;
    state = load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** `null` until the browser store has loaded, so the server never renders a fake first run. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

function newId(): string {
  return crypto.randomUUID();
}

export function scaleMacros(macros: Macros, factor: number): Macros {
  return {
    protein: Math.round(macros.protein * factor),
    kcal: Math.round(macros.kcal * factor),
    carbs: Math.round(macros.carbs * factor),
    fat: Math.round(macros.fat * factor),
  };
}

type NewLog = { name: string; macros: Macros; portion?: number; savedMealId?: string };

export function logMeal({ name, macros, portion = 1, savedMealId }: NewLog): MealLog {
  const now = Date.now();
  const log: MealLog = {
    id: newId(),
    name,
    macros: scaleMacros(macros, portion),
    portion,
    eatenAt: now,
    day: dayKey(new Date(now)),
    savedMealId,
  };
  commit((prev) => ({ ...prev, logs: [...prev.logs, log] }));
  return log;
}

export function removeLog(id: string) {
  commit((prev) => ({ ...prev, logs: prev.logs.filter((log) => log.id !== id) }));
}

/** Puts a removed log back in its original place in time. */
export function restoreLog(log: MealLog) {
  commit((prev) => ({ ...prev, logs: [...prev.logs, log].sort((a, b) => a.eatenAt - b.eatenAt) }));
}

export function saveMeal(meal: { name: string; macros: Macros; photo?: string }): SavedMeal {
  const saved: SavedMeal = { ...meal, id: newId(), createdAt: Date.now() };
  commit((prev) => ({ ...prev, saved: [...prev.saved, saved] }));
  return saved;
}

/** Puts an already-logged meal on the shelf, at its 1× portion. */
export function saveLogToShelf(log: MealLog): SavedMeal {
  const saved = saveMeal({ name: log.name, macros: scaleMacros(log.macros, 1 / log.portion) });
  commit((prev) => ({
    ...prev,
    logs: prev.logs.map((entry) => (entry.id === log.id ? { ...entry, savedMealId: saved.id } : entry)),
  }));
  return saved;
}

export function removeSavedMeal(id: string) {
  commit((prev) => ({
    ...prev,
    saved: prev.saved.filter((meal) => meal.id !== id),
    logs: prev.logs.map((log) => (log.savedMealId === id ? { ...log, savedMealId: undefined } : log)),
  }));
}

export function setTargets(targets: Targets) {
  commit((prev) => ({ ...prev, settings: { ...prev.settings, targets } }));
}
