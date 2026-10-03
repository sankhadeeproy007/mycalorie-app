"use client";

import { useCallback, useMemo, useRef, useState, type MouseEvent } from "react";
import { ComparisonPanel } from "@/components/ComparisonPanel";
import { DaySheet } from "@/components/DaySheet";
import { DeveloperPanel } from "@/components/DeveloperPanel";
import { LaunchScreen } from "@/components/LaunchScreen";
import { Dock } from "@/components/Dock";
import { MealSheet, type LogEntry, type PhotoCapture, type SheetRequest } from "@/components/meal/MealSheet";
import { addSample, removeSampleForLog } from "@/lib/comparison-store";
import { EatenToday } from "@/components/EatenToday";
import { ScorePanel, StreakPanel } from "@/components/ProgressPanels";
import { ProteinPanel } from "@/components/ProteinPanel";
import { Regulars } from "@/components/Regulars";
import { TargetsSheet } from "@/components/TargetsSheet";
import { Toast, type UndoNotice } from "@/components/Toast";
import { useToday } from "@/lib/day";
import { prepareForAnalysis, shelfThumbnail } from "@/lib/image";
import { itemsFromRegular } from "@/lib/items";
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
  resetDemoData,
  saveMeal,
  setDemoMode,
  setKeepForComparison,
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

const DEVELOPER_KEY = "mycalorie:developer";
const SECRET_TAPS = 5;
const SECRET_TAP_WINDOW_MS = 2500;

function readDeveloperShown(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(DEVELOPER_KEY) === "on";
  } catch {
    return false;
  }
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
  const [sheet, setSheet] = useState<SheetRequest | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [developerShown, setDeveloperShown] = useState(readDeveloperShown);
  const dateTaps = useRef<number[]>([]);

  /** Five taps on the date within a couple of seconds reveal the developer options. */
  const tapDate = (event: MouseEvent) => {
    const now = event.timeStamp;
    dateTaps.current = [...dateTaps.current.filter((at) => now - at < SECRET_TAP_WINDOW_MS), now];
    if (dateTaps.current.length < SECRET_TAPS || developerShown) return;
    dateTaps.current = [];
    showDeveloper(true);
    setNotice({ key: `dev-${now}`, message: "Developer options unlocked, at the bottom" });
  };

  const showDeveloper = (shown: boolean) => {
    setDeveloperShown(shown);
    try {
      if (shown) window.localStorage.setItem(DEVELOPER_KEY, "on");
      else window.localStorage.removeItem(DEVELOPER_KEY);
    } catch {
      // Without storage the panel just won't stay revealed after a reload.
    }
  };
  const [comparisonRevision, setComparisonRevision] = useState(0);
  const refreshComparison = () => setComparisonRevision((value) => value + 1);
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
    setNotice({
      key: log.id,
      message: `logged ${log.name} +${log.macros.protein} g`,
      undo: () => {
        removeLog(log.id);
        void removeSampleForLog(log.id).then(refreshComparison);
      },
    });

  /** Keeps the photo, Gemini's first answer and what was finally logged, for comparing models later. */
  const keepSample = async (capture: PhotoCapture, log: MealLog) => {
    try {
      const photo = await (await fetch(capture.image.dataUrl)).blob();
      await addSample({
        id: crypto.randomUUID(),
        logId: log.id,
        takenAt: log.eatenAt,
        photo,
        hint: capture.hint,
        outside: capture.outside,
        estimate: capture.estimate,
        logged: { name: log.name, macros: log.macros, items: log.items },
      });
      refreshComparison();
    } catch (error) {
      console.warn("Couldn't keep this photo for comparison", error);
    }
  };

  const logRegular = (meal: SavedMeal, portion: number) =>
    announceLog(
      logMeal({ name: meal.name, macros: meal.macros, portion, savedMealId: meal.id, items: itemsFromRegular(meal) }),
    );

  const openPhoto = async (file: File) => {
    try {
      setSheet({ kind: "photo", image: await prepareForAnalysis(file), file });
    } catch {
      setSheet({ kind: "text", failure: "unreadable" });
    }
  };

  const logEntry = async ({ name, macros, items, savedMealId, photoFile, saveAs, capture }: LogEntry) => {
    setSheet(null);
    let regularId = savedMealId;
    if (saveAs) {
      const photo = photoFile ? await shelfThumbnail(photoFile).catch(() => undefined) : undefined;
      regularId = saveMeal({ ...saveAs, photo }).id;
    }
    // After the sheet has released the page, so the scroll isn't undone by the restore.
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    const log = logMeal({ name, macros, items, savedMealId: regularId });
    announceLog(log);
    // Demo meals are not real meals, so they never join the comparison set.
    if (capture && state?.settings.keepForComparison && !isDemo()) void keepSample(capture, log);
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
      <LaunchScreen ready={view !== null} />
      <main className={styles.page} aria-busy={view === null}>
        <header className={`mono ${styles.status}`}>
          <span className={styles.statusLeft}>
            <span onClick={tapDate}>{view && formatStatusDate(today)}</span>
            {view && isDemo() && (
              <button type="button" className={styles.demo} onClick={() => setDemoMode(false)}>
                demo data · exit
              </button>
            )}
          </span>
          {view && <StreakStatus current={view.streaks.current} hitToday={view.streaks.hitToday} hasTarget={remaining !== null} />}
        </header>
        <h1 className="visually-hidden">Today</h1>

        {view ? (
          <>
            <ProteinPanel totals={view.totals} targets={view.targets} onEditTargets={() => setEditingTargets(true)} />
            <div className={styles.split}>
              <ScorePanel score={view.score} recent={view.recentScores} />
              <StreakPanel
                graph={view.graph}
                streaks={view.streaks}
                milestone={view.milestone}
                today={today}
                onOpenDay={setOpenDay}
              />
            </div>
            <Regulars meals={view.regulars} onLog={logRegular} onAdjust={(regular) => setSheet({ kind: "adjust", regular })} />
            <EatenToday logs={view.todaysLogs} onRemove={removeFromToday} onSaveToRegulars={addToRegulars} />
            <ComparisonPanel
              enabled={Boolean(state?.settings.keepForComparison)}
              onToggle={setKeepForComparison}
              revision={comparisonRevision}
            />
            {(developerShown || isDemo()) && (
              <DeveloperPanel
                demo={isDemo()}
                onDemoChange={setDemoMode}
                onResetDemo={resetDemoData}
                onHide={() => {
                  setDemoMode(false);
                  showDeveloper(false);
                }}
              />
            )}
          </>
        ) : (
          <div className={styles.loading} aria-hidden="true">
            <span />
            <span />
          </div>
        )}
      </main>

      <Toast notice={notice} onDismiss={dismissNotice} />
      <Dock onPhoto={openPhoto} onTypeIn={() => setSheet({ kind: "text" })} />
      <MealSheet
        request={sheet}
        regulars={view?.regulars ?? []}
        onLog={logEntry}
        onLogRegular={(regular) => {
          setSheet(null);
          logRegular(regular, 1);
        }}
        onClose={() => setSheet(null)}
      />
      {state && (
        <DaySheet
          day={openDay}
          today={today}
          logs={state.logs}
          targets={state.settings.targets}
          onNavigate={setOpenDay}
          onClose={() => setOpenDay(null)}
        />
      )}
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
