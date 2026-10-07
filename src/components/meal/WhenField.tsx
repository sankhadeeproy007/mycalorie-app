"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { dayKey, formatClock, formatDayHeading } from "@/lib/day";
import { shiftDay } from "@/lib/progress";
import styles from "./MealSheet.module.css";

/** "2026-10-08T13:30", the local time a datetime-local input works in. */
function toInputValue(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${dayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dayLabel(at: number, today: string): string {
  const day = dayKey(new Date(at));
  if (day === today) return "Today";
  if (day === shiftDay(today, -1)) return "Yesterday";
  return formatDayHeading(day);
}

type WhenFieldProps = {
  /** When the meal was eaten; `null` means now. */
  at: number | null;
  onChange: (at: number) => void;
};

/**
 * When the meal was eaten, shown as "Today · 13:30". Tapping opens the phone's own date and time
 * picker, so a meal can go on an earlier day; times after now aren't allowed.
 */
export function WhenField({ at, onChange }: WhenFieldProps) {
  // The moment the sheet opened stands in for "now": a meal can't be logged into the future.
  const [openedAt] = useState(() => Date.now());
  const shown = at ?? openedAt;
  const today = dayKey(new Date(openedAt));

  return (
    <label className={styles.when}>
      <CalendarClock size={16} strokeWidth={2} aria-hidden="true" />
      <span className={styles.whenLabel}>Eaten</span>
      <span className={`mono ${styles.whenValue}`}>
        {dayLabel(shown, today)} · {formatClock(shown)}
      </span>
      <input
        type="datetime-local"
        className={styles.whenInput}
        value={toInputValue(shown)}
        max={toInputValue(openedAt)}
        aria-label="When this meal was eaten"
        onChange={(event) => {
          const picked = new Date(event.target.value).getTime();
          if (Number.isFinite(picked)) onChange(Math.min(picked, Date.now()));
        }}
      />
    </label>
  );
}
