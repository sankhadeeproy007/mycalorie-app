"use client";

import { Bookmark, BookmarkPlus, Trash2 } from "lucide-react";
import { formatClock } from "@/lib/day";
import { formatAmount } from "@/lib/format";
import { portionLabel } from "@/lib/portions";
import type { MealLog } from "@/lib/types";
import { Panel } from "./Panel";
import styles from "./EatenToday.module.css";

type EatenTodayProps = {
  logs: MealLog[];
  onRemove: (log: MealLog) => void;
  onSaveToRegulars: (log: MealLog) => void;
};

export function EatenToday({ logs, onRemove, onSaveToRegulars }: EatenTodayProps) {
  return (
    <Panel
      title="today"
      meta={logs.length > 0 ? `${logs.length} ${logs.length === 1 ? "meal" : "meals"}` : undefined}
      headingId="eaten-heading"
    >
      {logs.length === 0 ? (
        <p className={styles.empty}>Nothing logged yet today.</p>
      ) : (
        <ol className={styles.list}>
          {[...logs].reverse().map((log) => (
            <li key={log.id} className={styles.item}>
              <span className={`mono ${styles.time}`}>{formatClock(log.eatenAt)}</span>
              <span className={styles.name}>
                {log.name}
                {log.portion !== 1 && <span className={styles.portion}> · {portionLabel(log.portion)}×</span>}
              </span>
              <span className={`mono ${styles.numbers}`}>
                <span className={styles.protein}>{log.macros.protein} g</span>
                <span className={styles.kcal}>{formatAmount(log.macros.kcal)} kcal</span>
              </span>
              <span className={styles.actions}>
                {log.savedMealId ? (
                  <span className={styles.saved} title="In your regulars">
                    <Bookmark size={16} strokeWidth={1.9} fill="currentColor" aria-hidden="true" />
                    <span className="visually-hidden">In your regulars</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => onSaveToRegulars(log)}
                    title="Save to regulars"
                  >
                    <BookmarkPlus size={16} strokeWidth={1.9} aria-hidden="true" />
                    <span className="visually-hidden">Save {log.name} to regulars</span>
                  </button>
                )}
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.remove}`}
                  onClick={() => onRemove(log)}
                  title="Remove from today"
                >
                  <Trash2 size={16} strokeWidth={1.9} aria-hidden="true" />
                  <span className="visually-hidden">Remove {log.name} from today</span>
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
