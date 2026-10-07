"use client";

import type { Analysis, Macros, MealItem } from "./types";

/**
 * Meal photos kept for comparing AI models later: the photo exactly as it was
 * sent, what Gemini said at the time, and what the owner logged after fixing
 * it. Lives in IndexedDB because photos are far too big for localStorage.
 */

export type ComparisonSample = {
  id: string;
  logId: string;
  takenAt: number;
  /** The JPEG the app sent for analysis (longest edge 1024 px). */
  photo: Blob;
  hint: string;
  outside: boolean;
  /** Whether the photo was read as "eggs are whites only". */
  eggWhitesOnly?: boolean;
  /** Gemini's answer before any correction; null when it failed and the meal was typed in. */
  estimate: Analysis | null;
  /** Claude's answer, when "Try Claude" was tapped for this photo. */
  claudeEstimate?: Analysis | null;
  /** Which answer the logged meal started from. */
  chosen?: "gemini" | "claude";
  logged: { name: string; macros: Macros; items?: MealItem[] };
};

export type ComparisonExport = {
  format: "mycalorie-comparison";
  version: 1;
  exportedAt: string;
  samples: (Omit<ComparisonSample, "photo"> & { photoBase64: string })[];
};

const DB_NAME = "mycalorie-comparison";
const STORE = "samples";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("logId", "logId");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export function addSample(sample: ComparisonSample): Promise<IDBValidKey> {
  return withStore("readwrite", (store) => store.put(sample));
}

export function listSamples(): Promise<ComparisonSample[]> {
  return withStore("readonly", (store) => store.getAll() as IDBRequest<ComparisonSample[]>);
}

export function clearSamples(): Promise<undefined> {
  return withStore("readwrite", (store) => store.clear());
}

/** Undoing a log takes its sample with it, so the comparison only holds meals that were really logged. */
export async function removeSampleForLog(logId: string): Promise<void> {
  const keys = await withStore("readonly", (store) => store.index("logId").getAllKeys(logId));
  await Promise.all(keys.map((key) => withStore("readwrite", (store) => store.delete(key))));
}

/** A corrected log is the better answer key, so its kept sample follows the correction. */
export async function updateSampleForLog(logId: string, logged: ComparisonSample["logged"]): Promise<void> {
  const samples = await withStore("readonly", (store) => store.index("logId").getAll(logId) as IDBRequest<ComparisonSample[]>);
  await Promise.all(samples.map((sample) => withStore("readwrite", (store) => store.put({ ...sample, logged }))));
}

export async function sampleStats(): Promise<{ count: number; bytes: number }> {
  const samples = await listSamples();
  return { count: samples.length, bytes: samples.reduce((sum, sample) => sum + sample.photo.size, 0) };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function buildExport(): Promise<ComparisonExport> {
  const samples = await listSamples();
  samples.sort((a, b) => a.takenAt - b.takenAt);
  return {
    format: "mycalorie-comparison",
    version: 1,
    exportedAt: new Date().toISOString(),
    samples: await Promise.all(
      samples.map(async ({ photo, ...rest }) => ({ ...rest, photoBase64: await blobToBase64(photo) })),
    ),
  };
}
