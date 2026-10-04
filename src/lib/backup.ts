"use client";

import { useSyncExternalStore } from "react";
import { isAppState } from "./app-state-check";
import { dayKey } from "./day";
import type { AppState } from "./types";

/**
 * Backups are plain JSON files the owner keeps in Files (or iCloud Drive). With cloud sync on they're a
 * second copy; without it, the phone's storage is the only one, and a backup file is the way back.
 */

type BackupFile = { app: "mycalorie"; version: 1; exportedAt: number; data: AppState };

export function backupFile(state: AppState, now = Date.now()): File {
  const body: BackupFile = { app: "mycalorie", version: 1, exportedAt: now, data: state };
  return new File([JSON.stringify(body)], `mycalorie-backup-${dayKey(new Date(now))}.json`, { type: "application/json" });
}

export type ParsedBackup = { state: AppState; exportedAt: number; meals: number; regulars: number };

/** Reads a backup file's text; returns `null` when it isn't a Mycalorie backup or is damaged. */
export function parseBackup(text: string): ParsedBackup | null {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null) return null;
  const { app, data, exportedAt } = body as Record<string, unknown>;
  if (app !== "mycalorie" || !isAppState(data)) return null;
  return {
    state: data,
    exportedAt: typeof exportedAt === "number" ? exportedAt : 0,
    meals: data.logs.length,
    regulars: data.saved.length,
  };
}

/** When the last backup was saved, and the day the daily prompt was waved off. */
export type BackupStatus = { lastAt: number | null; dismissedDay: string | null };

const STATUS_KEY = "mycalorie:backup";
const EMPTY_STATUS: BackupStatus = { lastAt: null, dismissedDay: null };

let status: BackupStatus | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): BackupStatus {
  if (status !== null) return status;
  try {
    const raw = window.localStorage.getItem(STATUS_KEY);
    status = raw ? { ...EMPTY_STATUS, ...(JSON.parse(raw) as Partial<BackupStatus>) } : EMPTY_STATUS;
  } catch {
    status = EMPTY_STATUS;
  }
  return status;
}

function update(changes: Partial<BackupStatus>) {
  status = { ...getSnapshot(), ...changes };
  try {
    window.localStorage.setItem(STATUS_KEY, JSON.stringify(status));
  } catch {
    // Without storage the prompt simply comes back next time.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `null` until the browser has loaded, like the app state. */
export function useBackupStatus(): BackupStatus | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export const markBackedUp = (at = Date.now()) => update({ lastAt: at });
export const dismissPromptFor = (day: string) => update({ dismissedDay: day });

/** The daily prompt shows until it's acted on, once per day, and not on a day that already has a backup. */
export function promptDue(backup: BackupStatus, today: string): boolean {
  if (backup.dismissedDay === today) return false;
  return backup.lastAt === null || dayKey(new Date(backup.lastAt)) !== today;
}
