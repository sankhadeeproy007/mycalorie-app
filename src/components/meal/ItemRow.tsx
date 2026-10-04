"use client";

import { useState } from "react";
import { Minus, Pencil, Plus, X } from "lucide-react";
import { blurOnEnter } from "@/lib/keyboard";
import { formatQuantity, formatUnit, isWeightUnit, itemMacros, roundMacros, stepFor } from "@/lib/items";
import type { Macros, MealItem } from "@/lib/types";
import styles from "./MealSheet.module.css";

type ItemRowProps = {
  item: MealItem;
  onChange: (item: MealItem) => void;
  /** Omitted when the item can't be removed, like a label's servings. */
  onRemove?: () => void;
};

/** One item: its quantity in the unit it was eaten in, or by weight when that's known. */
export function ItemRow({ item, onChange, onRemove }: ItemRowProps) {
  const canShowWeight = item.gramsPerUnit !== undefined && !isWeightUnit(item.unit) && !item.cookingFat;
  const [byWeight, setByWeight] = useState(false);
  const [editing, setEditing] = useState(false);
  const macros = roundMacros(itemMacros(item));
  const showingWeight = byWeight && canShowWeight;

  const step = stepFor(item, showingWeight);
  const quantityStep = showingWeight ? step / item.gramsPerUnit! : step;
  const display = showingWeight
    ? `${Math.round(item.quantity * item.gramsPerUnit!)} ${item.weightUnit ?? "g"}`
    : `${formatQuantity(item.quantity)} ${formatUnit(item.unit, item.quantity)}`;

  const adjust = (direction: 1 | -1) => {
    const next = Math.round((item.quantity + direction * quantityStep) * 1000) / 1000;
    if (next <= 0) return;
    onChange({ ...item, quantity: next, uncertain: undefined });
  };

  return (
    <li className={styles.item}>
      <div className={styles.itemHead}>
        <span className={styles.itemName}>
          {item.name}
          {item.uncertain && <span className={styles.check}>check</span>}
        </span>
        <button
          type="button"
          className={`mono ${styles.itemFigures}`}
          aria-expanded={editing}
          onClick={() => setEditing((open) => !open)}
        >
          <span className={styles.itemProtein}>{macros.protein} g</span>
          <span className={styles.itemKcal}>{macros.kcal} kcal</span>
          <Pencil size={12} strokeWidth={2} aria-hidden="true" />
          <span className="visually-hidden">, correct the numbers for {item.name}</span>
        </button>
      </div>
      {editing && (
        <ItemNumbers
          key={item.quantity}
          item={item}
          amount={display}
          onChange={(baseMacros) => onChange({ ...item, baseQuantity: item.quantity, baseMacros, uncertain: undefined })}
          onDone={() => setEditing(false)}
        />
      )}
      <div className={styles.itemControls}>
        <div className={styles.stepper} role="group" aria-label={`${item.name} quantity`}>
          <button
            type="button"
            className={styles.stepButton}
            onClick={() => adjust(-1)}
            disabled={item.quantity - quantityStep <= 0}
            aria-label={`Less ${item.name}`}
          >
            <Minus size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <output className={`mono ${styles.stepValue}`} aria-live="polite">
            {display}
          </output>
          <button type="button" className={styles.stepButton} onClick={() => adjust(1)} aria-label={`More ${item.name}`}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        {canShowWeight && (
          <button
            type="button"
            className={`mono ${styles.unitToggle}`}
            aria-pressed={showingWeight}
            onClick={() => setByWeight((value) => !value)}
            title={showingWeight ? `Show in ${item.unit}s` : `Show in ${item.weightUnit ?? "g"}`}
          >
            {item.weightUnit ?? "g"}
          </button>
        )}
        {onRemove && (
          <button type="button" className={styles.removeItem} onClick={onRemove} aria-label={`Remove ${item.name}`}>
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}

const FIELDS: { key: keyof Macros; label: string }[] = [
  { key: "protein", label: "protein g" },
  { key: "kcal", label: "kcal" },
  { key: "carbs", label: "carbs g" },
  { key: "fat", label: "fat g" },
];

type ItemNumbersProps = {
  item: MealItem;
  /** The quantity the numbers are for, as shown in the stepper. */
  amount: string;
  /** New macros for the current quantity; quantity changes then scale from these. */
  onChange: (macros: Macros) => void;
  onDone: () => void;
};

/** Corrects an item's numbers for the amount eaten, keeping it an item so its quantity still steps. */
function ItemNumbers({ item, amount, onChange, onDone }: ItemNumbersProps) {
  const [values, setValues] = useState(() => {
    const current = roundMacros(itemMacros(item));
    return Object.fromEntries(FIELDS.map(({ key }) => [key, String(current[key])])) as Record<keyof Macros, string>;
  });

  const update = (key: keyof Macros, raw: string) => {
    const next = { ...values, [key]: raw.replace(/[^\d.]/g, "").slice(0, 5) };
    setValues(next);
    const parsed = FIELDS.map(({ key: field }) => Number(next[field] || 0));
    if (parsed.every(Number.isFinite)) {
      onChange({ protein: parsed[0], kcal: parsed[1], carbs: parsed[2], fat: parsed[3] });
    }
  };

  return (
    <fieldset className={styles.itemNumbers}>
      <legend className={styles.itemNumbersLegend}>
        Numbers for <span className="mono">{amount}</span>
      </legend>
      <div className={styles.itemNumbersGrid}>
        {FIELDS.map(({ key, label }) => (
          <label key={key} className={styles.itemNumberField}>
            <input
              inputMode="decimal"
              value={values[key]}
              onChange={(event) => update(key, event.target.value)}
              enterKeyHint="done"
              onKeyDown={blurOnEnter}
              aria-label={`${item.name} ${label}`}
            />
            <span className="mono">{label}</span>
          </label>
        ))}
      </div>
      <button type="button" className={styles.itemNumbersDone} onClick={onDone}>
        Done
      </button>
    </fieldset>
  );
}
