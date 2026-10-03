"use client";

import { useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { formatQuantity, formatUnit, isWeightUnit, itemMacros, stepFor } from "@/lib/items";
import type { MealItem } from "@/lib/types";
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
        <span className={`mono ${styles.itemProtein}`}>{Math.round(itemMacros(item).protein)} g</span>
      </div>
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
