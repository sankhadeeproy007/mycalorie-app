"use client";

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
};

/** The protein streak as a contribution graph: one column per week, one cell per day. */
export function StreakPanel({ graph, streaks, milestone, today }: StreakPanelProps) {
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
      <div className={styles.graph} role="img" aria-label={graphSummary(streaks, milestone)}>
        {graph.map((week) =>
          week.map((cell, weekday) => (
            <span
              key={cell.day}
              className={styles.cell}
              data-level={cell.future ? undefined : cell.level}
              data-today={cell.day === today ? "" : undefined}
              data-future={cell.future ? "" : undefined}
              title={cell.future ? undefined : `${WEEKDAYS[weekday]} ${cell.day}: ${LEVEL_TEXT[cell.level]}`}
            />
          )),
        )}
      </div>
    </Panel>
  );
}

function graphSummary(streaks: Streaks, milestone: NextMilestone | null): string {
  const parts = [`Protein streak ${streaks.current} days, best ${streaks.best} days.`];
  if (milestone) parts.push(`Next milestone ${milestone.label}, ${milestone.remaining} to go.`);
  return parts.join(" ");
}
