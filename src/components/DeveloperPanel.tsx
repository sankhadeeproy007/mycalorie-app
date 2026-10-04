"use client";

import { useState } from "react";
import { RotateCcw, Share } from "lucide-react";
import { dayKey } from "@/lib/day";
import { dailyCsv, mealsCsv } from "@/lib/export-csv";
import { deliverFile, isAbort } from "@/lib/share-file";
import type { MealLog, Targets } from "@/lib/types";
import { Panel } from "./Panel";
import { SwitchRow } from "./SwitchRow";
import styles from "./DeveloperPanel.module.css";

type DeveloperPanelProps = {
  /** What's on screen now (demo data while demo is on), for the exports. */
  logs: MealLog[];
  targets: Targets;
  demo: boolean;
  onDemoChange: (on: boolean) => void;
  onResetDemo: () => void;
  /** Turns demo data off and tucks the panel away again. */
  onHide: () => void;
};

/** Testing aids. Demo data lives in its own storage, so real logs are never touched. */
export function DeveloperPanel({ logs, targets, demo, onDemoChange, onResetDemo, onHide }: DeveloperPanelProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  /** Hands a CSV to the share sheet (Save to Files, Numbers, Sheets) or downloads it. */
  const exportCsv = async (kind: "meals" | "daily") => {
    const name = `mycalorie-${demo ? "demo-" : ""}${kind}-${dayKey()}.csv`;
    const text = kind === "meals" ? mealsCsv(logs) : dailyCsv(logs, targets);
    try {
      await deliverFile(new File([text], name, { type: "text/csv" }), "Mycalorie export");
      setExportNote(`Exported ${name}`);
    } catch (error) {
      if (!isAbort(error)) setExportNote("Couldn’t export. Try again.");
    }
  };

  return (
    <Panel
      title="developer"
      headingId="developer-heading"
      meta={
        <button type="button" className={styles.hide} onClick={onHide}>
          hide
        </button>
      }
    >
      <SwitchRow
        label="Demo data"
        hint="Sample Indian meals, regulars and 12 weeks of history to try things on. Your real logs stay as they are and come back when you switch this off."
        on={demo}
        onChange={(on) => {
          setConfirmingReset(false);
          onDemoChange(on);
        }}
      />
      {demo && (
        <button
          type="button"
          className={styles.reset}
          onClick={() => {
            if (!confirmingReset) return setConfirmingReset(true);
            setConfirmingReset(false);
            onResetDemo();
          }}
        >
          <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
          {confirmingReset ? "Tap again to reset demo data" : "Reset demo data"}
        </button>
      )}

      <section className={styles.export} aria-labelledby="export-heading">
        <h3 id="export-heading" className={styles.exportTitle}>
          Export {demo ? "demo" : "your"} data
        </h3>
        <p className={styles.exportHint}>
          Spreadsheet files (CSV) for Numbers, Excel or Google Sheets: every meal with its macros and items, or one row per
          day against your targets.
        </p>
        <div className={styles.exportButtons}>
          <button type="button" className={styles.exportButton} onClick={() => void exportCsv("meals")} disabled={logs.length === 0}>
            <Share size={15} strokeWidth={2} aria-hidden="true" />
            Meals
          </button>
          <button type="button" className={styles.exportButton} onClick={() => void exportCsv("daily")} disabled={logs.length === 0}>
            <Share size={15} strokeWidth={2} aria-hidden="true" />
            Daily totals
          </button>
        </div>
        {exportNote && (
          <p className={`mono ${styles.exportNote}`} role="status">
            {exportNote}
          </p>
        )}
      </section>
    </Panel>
  );
}
