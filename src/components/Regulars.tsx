"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, SlidersHorizontal, UtensilsCrossed, X } from "lucide-react";
import { PORTIONS } from "@/lib/portions";
import type { SavedMeal } from "@/lib/types";
import { Panel } from "./Panel";
import styles from "./Regulars.module.css";

type RegularsProps = {
  meals: SavedMeal[];
  onLog: (meal: SavedMeal, portion: number) => void;
  onAdjust: (meal: SavedMeal) => void;
  onEdit: (meal: SavedMeal) => void;
};

const COLLAPSED_KEY = "mycalorie:regulars-collapsed";

function readCollapsed(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Saved meals as photo tiles: one tap logs a 1× portion, the corner chip picks another. */
export function Regulars({ meals, onLog, onAdjust, onEdit }: RegularsProps) {
  const [portionFor, setPortionFor] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = () => {
    setPortionFor(null);
    setCollapsed((was) => {
      try {
        if (was) window.localStorage.removeItem(COLLAPSED_KEY);
        else window.localStorage.setItem(COLLAPSED_KEY, "1");
      } catch {
        // Not remembered without storage; the panel still folds.
      }
      return !was;
    });
  };

  return (
    <Panel
      title="regulars"
      meta={meals.length > 0 ? meals.length : undefined}
      headingId="regulars-heading"
      collapsible={{ collapsed, onToggle: toggle }}
    >
      {meals.length === 0 ? (
        <p className={styles.empty}>
          Meals you save show up here as one-tap tiles. Tick “Save to regulars” when you log a meal.
        </p>
      ) : (
        <ul className={styles.grid}>
          {meals.map((meal) => (
            <RegularTile
              key={meal.id}
              meal={meal}
              choosing={portionFor === meal.id}
              onChoosePortion={(open) => setPortionFor(open ? meal.id : null)}
              onLog={(portion) => {
                setPortionFor(null);
                onLog(meal, portion);
              }}
              onAdjust={() => {
                setPortionFor(null);
                onAdjust(meal);
              }}
              onEdit={() => {
                setPortionFor(null);
                onEdit(meal);
              }}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

type RegularTileProps = {
  meal: SavedMeal;
  choosing: boolean;
  onChoosePortion: (open: boolean) => void;
  onLog: (portion: number) => void;
  onAdjust: () => void;
  onEdit: () => void;
};

function RegularTile({ meal, choosing, onChoosePortion, onLog, onAdjust, onEdit }: RegularTileProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const protein = meal.macros.protein;

  useEffect(() => {
    if (!choosing) return;
    panelRef.current?.querySelector<HTMLButtonElement>("[data-default]")?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onChoosePortion(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [choosing, onChoosePortion]);

  return (
    <li className={styles.tile}>
      <button
        type="button"
        className={styles.logButton}
        onClick={() => onLog(1)}
        aria-label={`Log ${meal.name}, ${protein} grams of protein`}
        tabIndex={choosing ? -1 : undefined}
      >
        {meal.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- saved data URL or demo stock photo
          <img src={meal.photo} alt="" className={styles.photo} />
        ) : (
          <span className={styles.noPhoto}>
            <UtensilsCrossed size={20} strokeWidth={1.6} aria-hidden="true" />
          </span>
        )}
        <span className={styles.name}>{meal.name}</span>
      </button>
      <span className={styles.meta}>
        <span className={`mono ${styles.protein}`}>{protein} g</span>
        <button
          type="button"
          className={`mono ${styles.portionTab}`}
          onClick={() => onChoosePortion(true)}
          aria-label={`Choose a portion of ${meal.name}`}
          tabIndex={choosing ? -1 : undefined}
        >
          1×
        </button>
      </span>

      {choosing && (
        <div ref={panelRef} className={styles.picker} role="group" aria-label={`Portion of ${meal.name}`}>
          <span className={styles.pickerHead}>
            <span className="visually-hidden">{meal.product ? `${meal.product.servingLabel}s` : "Portion"}</span>
            <button type="button" className={styles.close} onClick={onEdit} aria-label={`Edit or remove ${meal.name}`}>
              <Pencil size={13} strokeWidth={2} aria-hidden="true" />
            </button>
            <button type="button" className={styles.close} onClick={onAdjust} aria-label={`Adjust ${meal.name} before logging`}>
              <SlidersHorizontal size={14} strokeWidth={2} aria-hidden="true" />
            </button>
            <button type="button" className={styles.close} onClick={() => onChoosePortion(false)} aria-label="Close portions">
              <X size={14} strokeWidth={2.25} aria-hidden="true" />
            </button>
          </span>
          {PORTIONS.map(({ factor, label }) => (
            <button
              key={factor}
              type="button"
              className={`mono ${styles.portion}`}
              data-default={factor === 1 ? "" : undefined}
              onClick={() => onLog(factor)}
            >
              <span>{label}×</span>
              <span className={styles.portionGrams}>{Math.round(protein * factor)} g</span>
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
