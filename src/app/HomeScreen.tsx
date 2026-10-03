"use client";

import { useCallback, useMemo, useState } from "react";
import { Dock } from "@/components/Dock";
import { EatenToday } from "@/components/EatenToday";
import { EntrySheet, type EntryDraft, type EntryResult } from "@/components/EntrySheet";
import { ScorePanel, StreakPanel } from "@/components/ProgressPanels";
import { ProteinPanel } from "@/components/ProteinPanel";
import { Regulars } from "@/components/Regulars";
import { TargetsSheet } from "@/components/TargetsSheet";
import { Toast, type UndoNotice } from "@/components/Toast";
import { useToday } from "@/lib/day";
import { prepareForAnalysis, shelfThumbnail } from "@/lib/image";
import { requestAnalysis } from "@/lib/meal-api";
import {
  consistencyGraph,
  dayScore,
  nextMilestone,
  proteinStreaks,
  recentScores,
  totalsByDay,
} from "@/lib/progress";
import { orderShelf } from "@/lib/shelf-order";
import {
  isDemo,
  logMeal,
  removeLog,
  removeSavedMeal,
  restoreLog,
  saveLogToShelf,
  saveMeal,
  setTargets,
  useAppState,
} from "@/lib/store";
import { ZERO_MACROS, type MealLog, type SavedMeal } from "@/lib/types";
import styles from "./HomeScreen.module.css";

/** The console's state string: lit once today's target is hit, open until then, never broken mid-day. */
function StreakStatus({ current, hitToday, hasTarget }: { current: number; hitToday: boolean; hasTarget: boolean }) {
  if (!hasTarget) return null;
  const dot = <span className={styles.dot} data-state={hitToday ? "hit" : "open"} aria-hidden="true" />;
  if (hitToday)
    return (
      <span className={`${styles.streak} ${styles.hit}`}>
        {dot}
        {current}d streak · hit
      </span>
    );
  return (
    <span className={styles.streak}>
      {dot}
      {current > 0 ? `${current}d streak · today open` : "no streak yet"}
    </span>
  );
}

function formatStatusDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })
    .toLowerCase()
    .replace(",", "");
}

export function HomeScreen() {
  const state = useAppState();
  const today = useToday();
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [readingPhoto, setReadingPhoto] = useState<string | null>(null);
  const [notice, setNotice] = useState<UndoNotice | null>(null);
  const [editingTargets, setEditingTargets] = useState(false);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const view = useMemo(() => {
    if (!state) return null;
    const { targets } = state.settings;
    const byDay = totalsByDay(state.logs);
    const totals = byDay.get(today) ?? ZERO_MACROS;
    const streaks = proteinStreaks(byDay, targets.protein, today);
    return {
      targets,
      totals,
      todaysLogs: state.logs.filter((log) => log.day === today),
      regulars: orderShelf(state.saved, state.logs, today),
      score: dayScore(totals, targets),
      recentScores: recentScores(byDay, targets, today),
      streaks,
      graph: consistencyGraph(byDay, targets.protein, today),
      milestone: nextMilestone(streaks.current, state.logs.length),
    };
  }, [state, today]);

  const announceLog = (log: MealLog) =>
    setNotice({ key: log.id, message: `logged ${log.name} +${log.macros.protein} g`, undo: () => removeLog(log.id) });

  const logRegular = (meal: SavedMeal, portion: number) =>
    announceLog(logMeal({ name: meal.name, macros: meal.macros, portion, savedMealId: meal.id }));

  const readPhoto = async (file: File) => {
    let prepared;
    try {
      prepared = await prepareForAnalysis(file);
    } catch {
      setDraft({ failure: "unreadable" });
      return;
    }
    setReadingPhoto(prepared.dataUrl);
    const result = await requestAnalysis(prepared);
    setReadingPhoto(null);
    const photo = { dataUrl: prepared.dataUrl, file };
    setDraft(result.ok ? { photo, analysis: result.analysis } : { photo, failure: result.reason });
  };

  const logEntry = async ({ name, macros, saveToShelf, photoFile }: EntryResult) => {
    setDraft(null);
    let savedMealId: string | undefined;
    if (saveToShelf) {
      const photo = photoFile ? await shelfThumbnail(photoFile).catch(() => undefined) : undefined;
      savedMealId = saveMeal({ name, macros, photo }).id;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    announceLog(logMeal({ name, macros, savedMealId }));
  };

  const removeFromToday = (log: MealLog) => {
    removeLog(log.id);
    setNotice({ key: `rm-${log.id}`, message: `removed ${log.name}`, undo: () => restoreLog(log) });
  };

  const addToRegulars = (log: MealLog) => {
    const saved = saveLogToShelf(log);
    setNotice({ key: `reg-${saved.id}`, message: `${log.name} added to regulars`, undo: () => removeSavedMeal(saved.id) });
  };

  const remaining = view?.targets.protein ? Math.max(0, view.targets.protein - view.totals.protein) : null;

  return (
    <>
      <main className={styles.page} aria-busy={view === null}>
        <header className={`mono ${styles.status}`}>
          <span className={styles.statusLeft}>
            {view && formatStatusDate(today)}
            {view && isDemo() && <span className={styles.demo}>demo data</span>}
          </span>
          {view && <StreakStatus current={view.streaks.current} hitToday={view.streaks.hitToday} hasTarget={remaining !== null} />}
        </header>
        <h1 className="visually-hidden">Today</h1>

        {view ? (
          <>
            <ProteinPanel totals={view.totals} targets={view.targets} onEditTargets={() => setEditingTargets(true)} />
            <div className={styles.split}>
              <ScorePanel score={view.score} recent={view.recentScores} />
              <StreakPanel graph={view.graph} streaks={view.streaks} milestone={view.milestone} today={today} />
            </div>
            <Regulars meals={view.regulars} onLog={logRegular} />
            <EatenToday logs={view.todaysLogs} onRemove={removeFromToday} onSaveToRegulars={addToRegulars} />
          </>
        ) : (
          <div className={styles.loading} aria-hidden="true">
            <span />
            <span />
          </div>
        )}
      </main>

      <Toast notice={notice} onDismiss={dismissNotice} />
      <Dock readingPhoto={readingPhoto} onPhoto={readPhoto} onTypeIn={() => setDraft({})} />
      <EntrySheet draft={draft} onLog={logEntry} onClose={() => setDraft(null)} />
      {state && (
        <TargetsSheet
          open={editingTargets}
          targets={state.settings.targets}
          onSave={(targets) => {
            setTargets(targets);
            setEditingTargets(false);
          }}
          onClose={() => setEditingTargets(false)}
        />
      )}
    </>
  );
}
