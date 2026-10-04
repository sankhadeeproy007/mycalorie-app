"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatClock } from "@/lib/day";
import { formatAmount } from "@/lib/format";
import { formatQuantity, formatUnit, itemMacros } from "@/lib/items";
import { portionLabel } from "@/lib/portions";
import { dayScore, shiftDay } from "@/lib/progress";
import { ZERO_MACROS, type Macros, type MealLog, type Targets } from "@/lib/types";
import { Sheet, sheetStyles } from "./Sheet";
import styles from "./DaySheet.module.css";

type DaySheetProps = {
  day: string | null;
  today: string;
  logs: MealLog[];
  targets: Targets;
  onNavigate: (day: string) => void;
  onEditLog: (log: MealLog) => void;
  onClose: () => void;
};

const DAY_TITLE = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short" });

function titleOf(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === shiftDay(today, -1)) return "Yesterday";
  const [y, m, d] = day.split("-").map(Number);
  return DAY_TITLE.format(new Date(y, m - 1, d));
}

const ROWS = [
  { key: "kcal", label: "kcal", unit: "" },
  { key: "carbs", label: "carbs", unit: " g" },
  { key: "fat", label: "fat", unit: " g" },
] as const;

/** One day: protein against the target, the other macros, the score, and every meal with its items; a meal opens to be corrected. */
export function DaySheet({ day, ...rest }: DaySheetProps) {
  return (
    <Sheet open={day !== null} labelledBy="day-heading" onClose={rest.onClose}>
      {day && <DayView day={day} {...rest} />}
    </Sheet>
  );
}

function DayView({ day, today, logs, targets, onNavigate, onEditLog, onClose }: DaySheetProps & { day: string }) {
  const meals = logs.filter((log) => log.day === day).sort((a, b) => a.eatenAt - b.eatenAt);
  const totals: Macros = meals.reduce(
    (sum, log) => ({
      protein: sum.protein + log.macros.protein,
      kcal: sum.kcal + log.macros.kcal,
      carbs: sum.carbs + log.macros.carbs,
      fat: sum.fat + log.macros.fat,
    }),
    ZERO_MACROS,
  );
  const score = meals.length ? dayScore(totals, targets) : null;
  const target = targets.protein;
  const gap = target === null ? null : totals.protein - target;

  return (
    <div className={sheetStyles.form}>
      <header className={`${sheetStyles.header} ${styles.header}`}>
        <button type="button" className={sheetStyles.close} onClick={() => onNavigate(shiftDay(day, -1))}>
          <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
          <span className="visually-hidden">Previous day</span>
        </button>
        <h2 id="day-heading" className={`${sheetStyles.title} ${styles.title}`}>
          {titleOf(day, today)}
        </h2>
        <button
          type="button"
          className={sheetStyles.close}
          onClick={() => onNavigate(shiftDay(day, 1))}
          disabled={day >= today}
        >
          <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
          <span className="visually-hidden">Next day</span>
        </button>
        <button type="button" className={sheetStyles.close} onClick={onClose}>
          <X size={20} strokeWidth={2} aria-hidden="true" />
          <span className="visually-hidden">Close</span>
        </button>
      </header>

      {meals.length === 0 ? (
        <p className={styles.empty}>Nothing logged on this day.</p>
      ) : (
        <>
          <section className={styles.summary} aria-label="Day totals">
            <p className={styles.protein}>
              <span className={`mono ${styles.proteinValue}`}>
                {totals.protein}
                <span className={styles.unit}>g</span>
              </span>
              <span className={styles.proteinLabel}>
                protein
                {target !== null && (
                  <>
                    {" "}
                    of {target} g ·{" "}
                    <span className={gap! >= 0 ? styles.hit : undefined}>
                      {gap! >= 0
                        ? gap === 0
                          ? "target hit"
                          : `target hit, +${gap} g`
                        : `${-gap!} g ${day === today ? "to go" : "under"}`}
                    </span>
                  </>
                )}
              </span>
            </p>
            <dl className={`mono ${styles.rows}`}>
              {ROWS.map(({ key, label, unit }) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {formatAmount(totals[key])}
                    {unit}
                    {targets[key] !== null && <span className={styles.of}> / {formatAmount(targets[key]!)}</span>}
                  </dd>
                </div>
              ))}
              {score !== null && (
                <div>
                  <dt>score</dt>
                  <dd>{score}</dd>
                </div>
              )}
            </dl>
          </section>

          <ol className={styles.meals}>
            {meals.map((log) => (
              <li key={log.id} className={styles.meal}>
                <button type="button" className={styles.mealHead} onClick={() => onEditLog(log)}>
                  <span className={`mono ${styles.time}`}>{formatClock(log.eatenAt)}</span>
                  <span className={styles.mealName}>
                    {log.name}
                    {log.portion !== 1 && <span className={styles.portion}> · {portionLabel(log.portion)}×</span>}
                  </span>
                  <span className={`mono ${styles.mealNumbers}`}>
                    <span className={styles.mealProtein}>{log.macros.protein} g</span>
                    <span>{formatAmount(log.macros.kcal)} kcal</span>
                  </span>
                  <span className="visually-hidden">, edit</span>
                </button>
                {log.items && log.items.length > 1 && (
                  <ul className={`mono ${styles.items}`}>
                    {log.items.map((item) => (
                      <li key={item.id}>
                        <span>
                          {formatQuantity(item.quantity)} {formatUnit(item.unit, item.quantity)} {item.name}
                        </span>
                        <span>{Math.round(itemMacros(item).protein)} g</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
