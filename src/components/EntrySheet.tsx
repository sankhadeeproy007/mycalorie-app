"use client";

import { useState, type FormEvent } from "react";
import type { AnalyzeFailure } from "@/lib/meal-api";
import type { Analysis, Macros } from "@/lib/types";
import { EMPTY_MACRO_VALUES, MacroFields, parseAmount, Sheet, SheetHeader, sheetStyles, type MacroValues } from "./Sheet";
import styles from "./EntrySheet.module.css";

export type EntryDraft = {
  photo?: { dataUrl: string; file: File };
  analysis?: Analysis;
  failure?: AnalyzeFailure;
};

export type EntryResult = {
  name: string;
  macros: Macros;
  saveToShelf: boolean;
  photoFile?: File;
};

const FAILURE_COPY: Record<AnalyzeFailure, string> = {
  not_configured: "Photo reading isn’t set up yet (the Gemini key is missing). Enter this one by hand.",
  quota: "Today’s free photo-reading allowance is used up. Enter this one by hand, or try again later.",
  unreadable: "Couldn’t find food in that photo. Enter it by hand, or close this and try another photo.",
  offline: "You’re offline, so the photo can’t be read. Enter it by hand.",
  failed: "Something went wrong reading the photo. Enter it by hand, or close this and try again.",
};

type EntrySheetProps = {
  draft: EntryDraft | null;
  onLog: (result: EntryResult) => void;
  onClose: () => void;
};

export function EntrySheet({ draft, onLog, onClose }: EntrySheetProps) {
  return (
    <Sheet open={draft !== null} labelledBy="entry-heading" onClose={onClose}>
      {draft && <EntryForm key={draft.photo?.dataUrl ?? "manual"} draft={draft} onLog={onLog} onClose={onClose} />}
    </Sheet>
  );
}

type EntryFormProps = { draft: EntryDraft; onLog: (result: EntryResult) => void; onClose: () => void };

function EntryForm({ draft, onLog, onClose }: EntryFormProps) {
  const { analysis, photo, failure } = draft;
  const [name, setName] = useState(analysis?.name ?? "");
  const [values, setValues] = useState<MacroValues>(() =>
    analysis
      ? {
          protein: String(analysis.totals.protein),
          kcal: String(analysis.totals.kcal),
          carbs: String(analysis.totals.carbs),
          fat: String(analysis.totals.fat),
        }
      : EMPTY_MACRO_VALUES,
  );
  const [saveToShelf, setSaveToShelf] = useState(false);

  const protein = parseAmount(values.protein);
  const valid = name.trim() !== "" && protein !== null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const amount = (key: keyof Macros) => parseAmount(values[key]) ?? 0;
    onLog({
      name: name.trim(),
      macros: { protein: amount("protein"), kcal: amount("kcal"), carbs: amount("carbs"), fat: amount("fat") },
      saveToShelf,
      photoFile: photo?.file,
    });
  };

  return (
    <form className={sheetStyles.form} onSubmit={submit}>
      <SheetHeader id="entry-heading" title={analysis ? "Check the estimate" : "Add a meal"} onClose={onClose} />

      {failure && (
        <p className={styles.failure} role="alert">
          {FAILURE_COPY[failure]}
        </p>
      )}

      <div className={styles.identity}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL
          <img src={photo.dataUrl} alt="Your meal" className={styles.photo} />
        )}
        <label className={sheetStyles.field}>
          <span className={sheetStyles.fieldLabel}>Meal name</span>
          <input
            className={sheetStyles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Rajma chawal"
            autoComplete="off"
            enterKeyHint="next"
            data-autofocus={analysis ? undefined : ""}
            required
          />
        </label>
      </div>

      {analysis && (
        <details className={styles.items}>
          <summary>What the photo shows ({analysis.items.length})</summary>
          <ul>
            {analysis.items.map((item, index) => (
              <li key={index}>
                <span>
                  {item.name}
                  <span className={styles.itemPortion}>
                    {item.portion ? `${item.portion} · ` : ""}
                    {item.grams} g
                  </span>
                </span>
                <span className={styles.itemNumbers}>{item.protein} g protein</span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            Portion size is the usual error (an extra roti, a bigger katori). Adjust the totals below if it looks off.
          </p>
        </details>
      )}

      <MacroFields legend="Nutrition for this meal" values={values} onChange={setValues} required={["protein"]} />

      <label className={styles.save}>
        <input type="checkbox" checked={saveToShelf} onChange={(event) => setSaveToShelf(event.target.checked)} />
        <span>
          <span className={styles.saveLabel}>Save to regulars</span>
          <span className={styles.saveHint}>
            {photo ? "Keeps a small copy of the photo. " : ""}Log it again later with one tap.
          </span>
        </span>
      </label>

      <button
        type="submit"
        className={sheetStyles.submit}
        disabled={!valid}
        data-autofocus={analysis ? "" : undefined}
      >
        Log {protein !== null ? `${protein} g protein` : "meal"}
      </button>
    </form>
  );
}
