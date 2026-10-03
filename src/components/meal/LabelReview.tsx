"use client";

import { useState, type FormEvent } from "react";
import { formatAmount } from "@/lib/format";
import { roundMacros, scaleMacros } from "@/lib/items";
import type { LabelReading, Macros, MealItem } from "@/lib/types";
import { blurOnEnter } from "@/lib/keyboard";
import { ItemRow } from "./ItemRow";
import type { LogEntry } from "./MealSheet";
import styles from "./MealSheet.module.css";

type LabelReviewProps = {
  reading: LabelReading;
  photoFile?: File;
  photoUrl?: string;
  onLog: (entry: LogEntry) => void;
};

const FACTS: { key: keyof Macros; label: string; unit: string }[] = [
  { key: "protein", label: "Protein", unit: "g" },
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
];

/** A nutrition label read exactly: name it, choose servings, and keep it as a product. */
export function LabelReview({ reading, photoFile, photoUrl, onLog }: LabelReviewProps) {
  const [name, setName] = useState(reading.productName ?? "");
  const [saveProduct, setSaveProduct] = useState(true);
  const [serving, setServing] = useState<MealItem>(() => ({
    id: "serving",
    name: "Servings",
    quantity: 1,
    unit: reading.servingLabel,
    baseQuantity: 1,
    baseMacros: reading.perServing,
    gramsPerUnit: reading.servingSize,
    weightUnit: reading.servingUnit,
  }));

  const macros = roundMacros(scaleMacros(reading.perServing, serving.quantity));
  const valid = name.trim() !== "";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const productName = name.trim();
    const product = {
      servingLabel: reading.servingLabel,
      servingSize: reading.servingSize,
      servingUnit: reading.servingUnit,
      per100: reading.per100,
    };
    onLog({
      name: productName,
      macros,
      items: [{ ...serving, name: productName }],
      photoFile,
      saveAs: saveProduct ? { name: productName, macros: roundMacros(reading.perServing), product } : undefined,
    });
  };

  return (
    <form className={styles.stage} onSubmit={submit}>
      <div className={styles.identity}>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL
          <img src={photoUrl} alt="The label you photographed" className={styles.thumb} />
        )}
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Product name</span>
          <input
            className={styles.textInput}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. MuscleBlaze whey"
            autoComplete="off"
            enterKeyHint="done"
            onKeyDown={blurOnEnter}
            data-autofocus={reading.productName ? undefined : ""}
            required
          />
        </label>
      </div>

      <section className={styles.block} aria-labelledby="label-facts">
        <h3 id="label-facts" className={styles.blockTitle}>
          per {reading.servingLabel} · {formatAmount(reading.servingSize)} {reading.servingUnit}
        </h3>
        <dl className={`mono ${styles.facts}`}>
          {FACTS.map(({ key, label, unit }) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                {formatAmount(Math.round(reading.perServing[key] * 10) / 10)} {unit}
                {reading.per100 && (
                  <span className={styles.per100}>
                    {" "}
                    · {formatAmount(Math.round(reading.per100[key] * 10) / 10)}/100{reading.servingUnit}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <ul className={styles.items}>
        <ItemRow item={serving} onChange={setServing} />
      </ul>

      <label className={styles.save}>
        <input type="checkbox" checked={saveProduct} onChange={(event) => setSaveProduct(event.target.checked)} />
        <span>
          <span className={styles.saveLabel}>Save to regulars</span>
          <span className={styles.saveHint}>Log it in one tap next time, or add it to a meal as an ingredient.</span>
        </span>
      </label>

      <button type="submit" className={styles.primary} disabled={!valid}>
        Log {macros.protein} g protein
      </button>
    </form>
  );
}
