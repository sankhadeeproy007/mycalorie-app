"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import type { GraphCell, NextMilestone, PastScore, Streaks } from "@/lib/progress";
import { useRolledNumber } from "@/lib/use-rolled-number";
import { Panel } from "./Panel";
import styles from "./ProgressPanels.module.css";

type ScorePanelProps = { score: number | null; recent: PastScore[] };

const DAY_INITIAL = new Intl.DateTimeFormat("en-IN", { weekday: "narrow" });
const initialOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return DAY_INITIAL.format(new Date(y, m - 1, d));
};

/** One honest 0–100 scale for every bar, today included. */
const heightOf = (score: number) => Math.min(1, Math.max(0.03, score / 100));

/**
 * Today's score is shown as unfinished ("so far", an outlined bar) beside the
 * finished days, with their average as a reference line rather than a verdict.
 */
export function ScorePanel({ score, recent }: ScorePanelProps) {
  const shown = useRolledNumber(score ?? 0);
  const scored = recent.flatMap((entry) => (entry.score === null ? [] : [entry.score]));
  const average = scored.length ? Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length) : null;

  return (
    <Panel
      title="day score"
      headingId="score-heading"
      footer={score !== null && average !== null ? <span>7-day avg {average}</span> : undefined}
    >
      <p className={styles.scoreLine}>
        <span className={`mono ${styles.score}`}>{score === null ? "—" : shown}</span>
        <span className={styles.soFar}>{score === null ? "set a protein target" : "so far"}</span>
      </p>
      {score !== null && (
        <div className={styles.chart}>
          <ol className={styles.bars} aria-label="Scores for the last seven days and today so far">
            {recent.map(({ day, score: past }) => (
              <li key={day}>
                <span className={styles.track}>
                  {past !== null && <span className={styles.fill} style={{ scale: `1 ${heightOf(past)}` }} />}
                </span>
                <span className={`mono ${styles.day}`} aria-hidden="true">
                  {initialOf(day)}
                </span>
                <span className="visually-hidden">
                  {day}: {past ?? "nothing logged"}
                </span>
              </li>
            ))}
            <li data-today="">
              <span className={styles.track}>
                <span className={styles.fill} style={{ scale: `1 ${heightOf(score)}` }} />
              </span>
              <span className={`mono ${styles.day}`} aria-hidden="true">
                now
              </span>
              <span className="visually-hidden">Today so far: {score}</span>
            </li>
          </ol>
          {average !== null && (
            <span className={styles.average} style={{ top: `calc(${1 - heightOf(average)} * var(--bar-height))` }} aria-hidden="true" />
          )}
        </div>
      )}
    </Panel>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEVEL_TEXT = ["nothing logged", "under half the protein target", "over half", "close to target", "protein target hit"];

type StreakPanelProps = {
  graph: GraphCell[][];
  streaks: Streaks;
  milestone: NextMilestone | null;
  today: string;
  onOpenDay: (day: string) => void;
};

const WEEK = 7;

/**
 * The protein streak as a contribution graph: one column per week, one cell per day.
 * Cells are too small to hit reliably, so a tap opens the nearest day (gaps included)
 * and the day sheet has arrows to step to a neighbour.
 */
export function StreakPanel({ graph, streaks, milestone, today, onOpenDay }: StreakPanelProps) {
  const [focusDay, setFocusDay] = useState(today);
  const days = graph.flat();

  const openFromPointer = (event: MouseEvent<HTMLDivElement>) => {
    // Keyboard activation arrives as a click with no pointer position; the focused cell says which day.
    const target = event.target as HTMLElement;
    if (event.detail === 0) {
      const day = target.dataset.day;
      if (day) onOpenDay(day);
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const column = Math.min(graph.length - 1, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * graph.length)));
    const row = Math.min(WEEK - 1, Math.max(0, Math.floor(((event.clientY - box.top) / box.height) * WEEK)));
    const cell = graph[column][row];
    if (!cell.future) onOpenDay(cell.day);
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -WEEK, ArrowRight: WEEK }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const index = days.findIndex((cell) => cell.day === focusDay);
    const next = days[index + step];
    if (!next || next.future) return;
    setFocusDay(next.day);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-day="${next.day}"]`)?.focus();
  };

  return (
    <Panel
      title={`${graph.length} weeks`}
      headingId="streak-heading"
      meta={<span className={streaks.current > 0 ? styles.live : undefined}>{streaks.current}d streak</span>}
      footer={
        <>
          <span>
            best <b className={styles.strong}>{streaks.best}d</b>
          </span>
          {milestone && (
            <span>
              next <b className={styles.strong}>{milestone.label}</b> · {milestone.remaining} to go
            </span>
          )}
        </>
      }
    >
      <p className="visually-hidden">{graphSummary(streaks, milestone)} Choose a day to see what you ate.</p>
      <div className={styles.graph} role="group" aria-label="Protein by day" onClick={openFromPointer} onKeyDown={moveFocus}>
        {graph.map((week) =>
          week.map((cell, weekday) => (
            <button
              type="button"
              key={cell.day}
              className={styles.cell}
              data-day={cell.day}
              data-level={cell.future ? undefined : cell.level}
              data-today={cell.day === today ? "" : undefined}
              data-future={cell.future ? "" : undefined}
              disabled={cell.future}
              tabIndex={cell.day === focusDay ? 0 : -1}
              aria-label={`${WEEKDAYS[weekday]} ${cell.day}: ${LEVEL_TEXT[cell.level]}`}
            />
          )),
        )}
      </div>
      <p className={`mono ${styles.legend}`} aria-hidden="true">
        <span className={styles.legendCell} data-level={0} />
        <span>none</span>
        {[1, 2, 3].map((level) => (
          <span key={level} className={styles.legendCell} data-level={level} />
        ))}
        <span>under</span>
        <span className={styles.legendCell} data-level={4} />
        <span>hit</span>
      </p>
    </Panel>
  );
}

function graphSummary(streaks: Streaks, milestone: NextMilestone | null): string {
  const parts = [`Protein streak ${streaks.current} days, best ${streaks.best} days.`];
  if (milestone) parts.push(`Next milestone ${milestone.label}, ${milestone.remaining} to go.`);
  return parts.join(" ");
}
