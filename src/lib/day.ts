"use client";

import { useEffect, useState } from "react";

export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * A time on `day` for a meal being added to it: the current clock time on that date, or `null` for
 * today (meaning now). The meal sheet's When field can change it.
 */
export function timeOnDay(day: string): number | null {
  if (day === dayKey()) return null;
  const [y, m, d] = day.split("-").map(Number);
  const now = new Date();
  return new Date(y, m - 1, d, now.getHours(), now.getMinutes()).getTime();
}

const DAY_CHECK_MS = 30_000;

/** The current local day; re-renders when the clock passes midnight. */
export function useToday(): string {
  const [today, setToday] = useState(dayKey);

  useEffect(() => {
    const tick = () => setToday((prev) => (prev === dayKey() ? prev : dayKey()));
    const timer = setInterval(tick, DAY_CHECK_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  return today;
}

export function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDayHeading(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
