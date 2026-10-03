"use client";

import { useState, type FormEvent } from "react";
import { formatAmount } from "@/lib/format";
import type { Targets } from "@/lib/types";
import { MacroFields, parseAmount, Sheet, SheetHeader, sheetStyles, type MacroValues } from "./Sheet";
import styles from "./TargetsSheet.module.css";

/** Energy per gram (Atwater factors). */
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;
/** Below this gap between entered and computed calories, the suggestion stays hidden. */
const KCAL_MATCH_TOLERANCE = 0.02;

type TargetsSheetProps = {
  open: boolean;
  targets: Targets;
  onSave: (targets: Targets) => void;
  onClose: () => void;
};

export function TargetsSheet({ open, targets, onSave, onClose }: TargetsSheetProps) {
  return (
    <Sheet open={open} labelledBy="targets-heading" onClose={onClose}>
      <TargetsForm targets={targets} onSave={onSave} onClose={onClose} />
    </Sheet>
  );
}

const toValue = (amount: number | null) => (amount === null ? "" : String(amount));

function caloriesFromMacros(values: MacroValues): number | null {
  const protein = parseAmount(values.protein);
  const carbs = parseAmount(values.carbs);
  const fat = parseAmount(values.fat);
  if (protein === null || carbs === null || fat === null) return null;
  return protein * KCAL_PER_GRAM.protein + carbs * KCAL_PER_GRAM.carbs + fat * KCAL_PER_GRAM.fat;
}

type TargetsFormProps = Omit<TargetsSheetProps, "open">;

function TargetsForm({ targets, onSave, onClose }: TargetsFormProps) {
  const [values, setValues] = useState<MacroValues>({
    protein: toValue(targets.protein),
    kcal: toValue(targets.kcal),
    carbs: toValue(targets.carbs),
    fat: toValue(targets.fat),
  });

  const computed = caloriesFromMacros(values);
  const entered = parseAmount(values.kcal);
  const showSuggestion =
    computed !== null && computed > 0 && (entered === null || Math.abs(entered - computed) / computed > KCAL_MATCH_TOLERANCE);
  const valid = (parseAmount(values.protein) ?? 0) > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    onSave({
      protein: parseAmount(values.protein),
      kcal: parseAmount(values.kcal),
      carbs: parseAmount(values.carbs),
      fat: parseAmount(values.fat),
    });
  };

  return (
    <form className={sheetStyles.form} onSubmit={submit}>
      <SheetHeader id="targets-heading" title="Daily targets" onClose={onClose} />

      <p className={styles.intro}>
        What you aim to eat each day. Protein is required; leave any of the others blank to just track them.
      </p>

      <MacroFields legend="Daily targets" values={values} onChange={setValues} autofocus="protein" required={["protein"]} />

      {showSuggestion && (
        <div className={styles.suggestion} role="status">
          <p>
            Protein, carbs and fat add up to about <strong>{formatAmount(computed)} kcal</strong>
            {entered !== null && <> ({formatAmount(entered)} entered)</>}.
          </p>
          <button
            type="button"
            className={styles.useCalories}
            onClick={() => setValues({ ...values, kcal: String(computed) })}
          >
            Use {formatAmount(computed)} kcal
          </button>
        </div>
      )}

      <button type="submit" className={sheetStyles.submit} disabled={!valid}>
        Save targets
      </button>
    </form>
  );
}
