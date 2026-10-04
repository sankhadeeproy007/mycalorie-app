"use client";

import { useState, type KeyboardEvent } from "react";
import { totalMacros } from "@/lib/items";
import { estimateDescription, type AnalyzeFailure } from "@/lib/meal-api";
import type { EstimatedItem, SavedMeal } from "@/lib/types";
import { FAILURE_COPY } from "./failure-copy";
import styles from "./MealSheet.module.css";

type AddItemPanelProps = {
  regulars: SavedMeal[];
  outside: boolean;
  onAddRegular: (regular: SavedMeal) => void;
  onAddEstimated: (items: EstimatedItem[]) => void;
};

/** Adds what the photo missed: a saved product or regular, or a few words the AI estimates. */
export function AddItemPanel({ regulars, outside, onAddRegular, onAddEstimated }: AddItemPanelProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ reason: AnalyzeFailure; detail?: string } | null>(null);

  /** Not a form: this panel sits inside the review form, and forms can't nest. */
  const describe = async () => {
    const description = text.trim();
    if (!description || busy) return;
    setBusy(true);
    setFailure(null);
    const result = await estimateDescription(description, outside);
    setBusy(false);
    if (!result.ok) {
      setFailure({ reason: result.reason, detail: result.detail });
      return;
    }
    onAddEstimated(result.value.items);
    setText("");
  };

  return (
    <div className={styles.addPanel}>
      <div className={styles.describe} role="group" aria-label="Describe something to add">
        <label className="visually-hidden" htmlFor="add-describe">
          Describe something to add
        </label>
        <input
          id="add-describe"
          className={styles.textInput}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="e.g. 1 gulab jamun, cutting chai"
          autoComplete="off"
          enterKeyHint="done"
          autoFocus
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            void describe();
          }}
        />
        <button type="button" className={styles.secondaryButton} disabled={!text.trim() || busy} onClick={() => void describe()}>
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {failure && (
        <p className={styles.inlineFailure}>
          {FAILURE_COPY[failure.reason]}
          {failure.detail && <span className={`mono ${styles.failureDetail}`}>details: {failure.detail}</span>}
        </p>
      )}

      {regulars.length > 0 && (
        <>
          <p className={styles.addLabel}>From your regulars</p>
          <ul className={styles.chips}>
            {regulars.map((regular) => (
              <li key={regular.id}>
                <button type="button" className={styles.chip} onClick={() => onAddRegular(regular)}>
                  <span className={styles.chipName}>{regular.name}</span>
                  <span className={`mono ${styles.chipProtein}`}>
                    {regular.items ? totalMacros(regular.items).protein : regular.macros.protein} g
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
