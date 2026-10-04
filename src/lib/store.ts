"use client";

import { useSyncExternalStore } from "react";
import { userKey } from "./current-user";
import { dayKey } from "./day";
import { demoState } from "./demo";
import { roundMacros, scaleItems, scaleMacros } from "./items";
import {
  NO_TARGETS,
  type AppState,
  type Macros,
  type MealItem,
  type MealLog,
  type PhotoModel,
  type ProductInfo,
  type SavedMeal,
  type Targets,
} from "./types";

/**
 * Browser-local store: the app always reads and writes here, so it opens instantly and works offline.
 * `sync.ts` mirrors the real data to the cloud through `onRealDataChange` and `writeRealState`.
 */

/** The signed-in person's data; see `current-user.ts`. */
const realKey = () => userKey("mycalorie:v1");
const DEMO_KEY = "mycalorie:demo:v5";
/** Set when demo mode is switched on in the app; `?demo` in the URL also turns it on. */
const DEMO_MODE_KEY = "mycalorie:demo-mode";

const EMPTY_STATE: AppState = { settings: { targets: NO_TARGETS }, saved: [], logs: [] };

/** Older saves stored only a protein target; carry it into the full set of targets. */
type LegacySettings = { proteinTarget?: number | null; targets?: Targets; keepForComparison?: boolean };

function migrate(saved: Omit<AppState, "settings"> & { settings?: LegacySettings }): AppState {
  const { proteinTarget = null, targets } = saved.settings ?? {};
  return {
    ...EMPTY_STATE,
    ...saved,
    settings: { ...saved.settings, targets: targets ?? { ...NO_TARGETS, protein: proteinTarget } },
  };
}

let state: AppState | null = null;
const listeners = new Set<() => void>();

/** Told about every change to the real data made in the app; `replaced` when it was swapped wholesale. */
type ChangeListener = (change: { replaced: boolean }) => void;
const changeListeners = new Set<ChangeListener>();

export function onRealDataChange(listener: ChangeListener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

export function isDemo(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).has("demo")) return true;
  try {
    return window.localStorage.getItem(DEMO_MODE_KEY) === "on";
  } catch {
    return false;
  }
}

function storageKey(): string {
  return isDemo() ? DEMO_KEY : realKey();
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
  if (!isDemo()) changeListeners.forEach((listener) => listener({ replaced: false }));
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

type NewLog = { name: string; macros: Macros; portion?: number; savedMealId?: string; items?: MealItem[] };

export function logMeal({ name, macros, portion = 1, savedMealId, items }: NewLog): MealLog {
  const now = Date.now();
  const log: MealLog = {
    id: newId(),
    name,
    macros: roundMacros(scaleMacros(macros, portion)),
    portion,
    items: items && scaleItems(items, portion),
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

type LogChanges = { name: string; macros: Macros; items?: MealItem[] };

/** Corrects a logged meal in place; its time, day and portion stay as they were. */
export function updateLog(id: string, changes: LogChanges) {
  commit((prev) => ({
    ...prev,
    logs: prev.logs.map((log) => (log.id === id ? { ...log, ...changes } : log)),
  }));
}

/** Puts a removed log back in its original place in time. */
export function restoreLog(log: MealLog) {
  commit((prev) => ({ ...prev, logs: [...prev.logs, log].sort((a, b) => a.eatenAt - b.eatenAt) }));
}

type NewRegular = { name: string; macros: Macros; photo?: string; items?: MealItem[]; product?: ProductInfo };

export function saveMeal(meal: NewRegular): SavedMeal {
  const saved: SavedMeal = { ...meal, id: newId(), createdAt: Date.now() };
  commit((prev) => ({ ...prev, saved: [...prev.saved, saved] }));
  return saved;
}

/** Puts an already-logged meal on the shelf, at its 1× portion. */
export function saveLogToShelf(log: MealLog): SavedMeal {
  const saved = saveMeal({
    name: log.name,
    macros: roundMacros(scaleMacros(log.macros, 1 / log.portion)),
    items: log.items && scaleItems(log.items, 1 / log.portion),
  });
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

type RegularChanges = { name: string; macros: Macros; items?: MealItem[]; product?: ProductInfo };

/** Changes a regular from now on; meals already logged from it keep what they were logged with. */
export function updateSavedMeal(id: string, changes: RegularChanges) {
  commit((prev) => ({
    ...prev,
    saved: prev.saved.map((meal) => (meal.id === id ? { ...meal, ...changes } : meal)),
  }));
}

/** Undoes `removeSavedMeal`: the regular returns with the meals that were logged from it. */
export function restoreSavedMeal(meal: SavedMeal, linkedLogIds: string[]) {
  const linked = new Set(linkedLogIds);
  commit((prev) => ({
    ...prev,
    saved: [...prev.saved, meal].sort((a, b) => a.createdAt - b.createdAt),
    logs: prev.logs.map((log) => (linked.has(log.id) ? { ...log, savedMealId: meal.id } : log)),
  }));
}

/** The real data, as stored, for a backup; demo data is never backed up. */
export function readRealState(): AppState {
  try {
    const raw = window.localStorage.getItem(realKey());
    if (raw) return migrate(JSON.parse(raw));
  } catch {
    // Fall through to nothing stored.
  }
  return EMPTY_STATE;
}

/** Replaces the real data with a backup. Throws when the phone has no room for it. */
export function replaceRealState(next: AppState) {
  writeRealState(next);
  changeListeners.forEach((listener) => listener({ replaced: true }));
}

/** Takes in the cloud copy (or a merge with it) without counting as a change to send back. */
export function writeRealState(next: AppState) {
  window.localStorage.setItem(realKey(), JSON.stringify(migrate(next)));
  if (!isDemo()) reload();
}

function reload() {
  state = load();
  listeners.forEach((listener) => listener());
}

/** Swaps between real and demo data in place; each keeps its own storage, so nothing is lost either way. */
export function setDemoMode(on: boolean) {
  try {
    if (on) window.localStorage.setItem(DEMO_MODE_KEY, "on");
    else window.localStorage.removeItem(DEMO_MODE_KEY);
  } catch {
    // Without storage the switch can't stick; the URL parameter still works.
  }
  const url = new URL(window.location.href);
  if (!on && url.searchParams.has("demo")) {
    url.searchParams.delete("demo");
    window.history.replaceState(null, "", url);
  }
  reload();
}

/** Throws away whatever was done in demo mode and starts again from fresh sample data. */
export function resetDemoData() {
  try {
    window.localStorage.removeItem(DEMO_KEY);
  } catch {
    // Nothing stored to remove.
  }
  reload();
}

export function setTargets(targets: Targets) {
  commit((prev) => ({ ...prev, settings: { ...prev.settings, targets } }));
}

export function setReadWith(model: PhotoModel) {
  commit((prev) => ({ ...prev, settings: { ...prev.settings, readWith: model } }));
}

/** Settings as they stand, for code outside React that needs them at the moment it runs. */
export const readSettings = () => getSnapshot().settings;

export function setKeepForComparison(keep: boolean) {
  commit((prev) => ({ ...prev, settings: { ...prev.settings, keepForComparison: keep } }));
}
