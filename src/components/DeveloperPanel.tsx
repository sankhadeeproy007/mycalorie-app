"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Panel } from "./Panel";
import { SwitchRow } from "./SwitchRow";
import styles from "./DeveloperPanel.module.css";

type DeveloperPanelProps = {
  demo: boolean;
  onDemoChange: (on: boolean) => void;
  onResetDemo: () => void;
  /** Turns demo data off and tucks the panel away again. */
  onHide: () => void;
};

/** Testing aids. Demo data lives in its own storage, so real logs are never touched. */
export function DeveloperPanel({ demo, onDemoChange, onResetDemo, onHide }: DeveloperPanelProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);

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
    </Panel>
  );
}
