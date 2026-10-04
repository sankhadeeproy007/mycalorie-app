"use client";

import { useSyncExternalStore } from "react";
import { isAppState } from "./app-state-check";
import { dayKey } from "./day";
import { onRealDataChange, readRealState, writeRealState } from "./store";
import type { AppState } from "./types";

/**
 * Mirrors the real data to the cloud copy behind /api/data. The phone stays the working copy: changes
 * are sent a moment after they happen, and the cloud copy is checked whenever the app comes to the front.
 *
 * Each cloud save has a revision. The phone remembers the revision it last matched and whether it has
 * changes the cloud hasn't seen. If the cloud moved on meanwhile (another device), an unchanged phone
 * takes the cloud copy; a changed one merges by id (its own version wins) and sends the result. A meal
 * deleted on one device while the other was offline with changes can come back in that merge.
 */

type Meta = {
  /** Cloud revision this phone last matched. */
  rev: number;
  /** Has changes the cloud hasn't seen. */
  dirty: boolean;
  /** A restore replaced everything: send it as is, without merging the cloud copy back in. */
  replace: boolean;
  syncedAt: number | null;
};

export type SyncPhase = "checking" | "off" | "syncing" | "synced" | "offline" | "error";
export type SyncStatus = { phase: SyncPhase; syncedAt: number | null };

const META_KEY = "mycalorie:sync";
const SEND_DELAY_MS = 1200;
const MAX_CONFLICT_RETRIES = 2;

function readMeta(): Meta {
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw) as Meta;
  } catch {
    // Unreadable: start as if never synced.
  }
  // Never synced: whatever is already on the phone is news to the cloud.
  const local = readRealState();
  return { rev: 0, dirty: local.logs.length > 0 || local.saved.length > 0, replace: false, syncedAt: null };
}

function saveMeta(changes: Partial<Meta>) {
  const next = { ...readMeta(), ...changes };
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch {
    // Without storage the next sync just starts over.
  }
  return next;
}

let status: SyncStatus | null = null;
const listeners = new Set<() => void>();

function getStatus(): SyncStatus {
  if (status === null) status = { phase: "checking", syncedAt: readMeta().syncedAt };
  return status;
}

function setStatus(phase: SyncPhase, syncedAt = getStatus().syncedAt) {
  status = { phase, syncedAt };
  listeners.forEach((listener) => listener());
}

/** `null` on the server, like the app state. */
export function useSyncStatus(): SyncStatus | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getStatus,
    () => null,
  );
}

/** Union by id; on the same id the phone's version wins. Settings are the phone's. */
function merge(local: AppState, cloud: AppState): AppState {
  const union = <T extends { id: string }>(mine: T[], theirs: T[]) => {
    const byId = new Map(theirs.map((entry) => [entry.id, entry]));
    mine.forEach((entry) => byId.set(entry.id, entry));
    return [...byId.values()];
  };
  return {
    ...local,
    saved: union(local.saved, cloud.saved).sort((a, b) => a.createdAt - b.createdAt),
    logs: union(local.logs, cloud.logs).sort((a, b) => a.eatenAt - b.eatenAt),
  };
}

type CloudReply = { configured: false } | { configured: true; rev: number; state: AppState | null; unchanged?: boolean };

async function fetchCloud(have: number): Promise<CloudReply | "offline" | "error"> {
  try {
    const response = await fetch(`/api/data?have=${have}`, { cache: "no-store" });
    if (!response.ok) return "error";
    return (await response.json()) as CloudReply;
  } catch {
    return "offline";
  }
}

/** Bumped on every local change, so a send that raced a new change doesn't mark the phone clean. */
let changeCount = 0;

async function syncOnce(attempt = 0): Promise<void> {
  const meta = readMeta();
  const cloud = await fetchCloud(meta.rev);
  if (cloud === "offline" || cloud === "error") return setStatus(cloud);
  if (!cloud.configured) return setStatus("off");

  let local = readRealState();
  const cloudMovedOn = cloud.rev !== meta.rev && !cloud.unchanged && cloud.state !== null && isAppState(cloud.state);
  if (cloudMovedOn && !meta.replace) {
    if (!meta.dirty) {
      writeRealState(cloud.state!);
      const now = Date.now();
      saveMeta({ rev: cloud.rev, dirty: false, syncedAt: now });
      return setStatus("synced", now);
    }
    local = merge(local, cloud.state!);
    writeRealState(local);
  }

  if (!meta.dirty && !meta.replace && cloud.rev === meta.rev) {
    return setStatus("synced");
  }

  setStatus("syncing");
  const sentAt = changeCount;
  let response: Response;
  try {
    response = await fetch("/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: local, baseRev: cloud.rev, day: dayKey() }),
    });
  } catch {
    return setStatus("offline");
  }
  if (response.status === 409 && attempt < MAX_CONFLICT_RETRIES) return syncOnce(attempt + 1);
  if (!response.ok) return setStatus("error");

  const { rev } = (await response.json()) as { rev: number };
  const now = Date.now();
  const stillDirty = changeCount !== sentAt;
  saveMeta({ rev, dirty: stillDirty, replace: false, syncedAt: now });
  setStatus("synced", now);
  if (stillDirty) schedule();
}

let running = false;
let again = false;

/** One sync at a time; a request during one runs once more after it. */
export async function syncNow() {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    do {
      again = false;
      await syncOnce();
    } while (again);
  } finally {
    running = false;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

function schedule(delay = SEND_DELAY_MS) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

/** Starts syncing: now, after every change, and whenever the app comes back to the front or online. */
export function startSync(): () => void {
  const stopListening = onRealDataChange(({ replaced }) => {
    changeCount += 1;
    saveMeta(replaced ? { dirty: true, replace: true } : { dirty: true });
    schedule();
  });
  const onVisible = () => {
    if (document.visibilityState === "visible") void syncNow();
  };
  const onOnline = () => void syncNow();
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onOnline);
  void syncNow();
  return () => {
    stopListening();
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", onOnline);
  };
}
