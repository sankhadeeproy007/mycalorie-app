"use client";

import { useState } from "react";
import { Camera, PenLine, Search, SlidersHorizontal, UtensilsCrossed } from "lucide-react";
import { blurOnEnter } from "@/lib/keyboard";
import type { SavedMeal } from "@/lib/types";
import { Sheet, SheetHeader, sheetStyles } from "./Sheet";
import { usePhotoPicker } from "./usePhotoPicker";
import styles from "./LogSheet.module.css";

/** Past this many regulars the list gets a filter. */
const FILTER_FROM = 8;

type LogSheetProps = {
  open: boolean;
  /** Already in shelf order: what's usually eaten at this time of day first. */
  regulars: SavedMeal[];
  onPhoto: (file: File) => void;
  onDescribe: () => void;
  onLogRegular: (meal: SavedMeal) => void;
  onAdjustRegular: (meal: SavedMeal) => void;
  onClose: () => void;
};

/** Where "Log a meal" starts once there are regulars: a new meal by photo or words, or one of the regulars. */
export function LogSheet({ open, onClose, ...rest }: LogSheetProps) {
  return (
    <Sheet open={open} labelledBy="log-heading" onClose={onClose}>
      {open && <LogChoices onClose={onClose} {...rest} />}
    </Sheet>
  );
}

function LogChoices({ regulars, onPhoto, onDescribe, onLogRegular, onAdjustRegular, onClose }: Omit<LogSheetProps, "open">) {
  const [filter, setFilter] = useState("");
  const photo = usePhotoPicker(onPhoto);
  const query = filter.trim().toLowerCase();
  const shown = query ? regulars.filter((meal) => meal.name.toLowerCase().includes(query)) : regulars;

  return (
    <div className={sheetStyles.form}>
      <SheetHeader id="log-heading" title="Log a meal" onClose={onClose} />
      {photo.input}

      <div className={styles.new}>
        <button type="button" className={styles.photo} onClick={photo.pick}>
          <Camera size={18} strokeWidth={2} aria-hidden="true" />
          Photo
        </button>
        <button type="button" className={styles.describe} onClick={onDescribe}>
          <PenLine size={16} strokeWidth={2} aria-hidden="true" />
          Describe
        </button>
      </div>

      <section className={styles.regulars} aria-labelledby="log-regulars-heading">
        <h3 id="log-regulars-heading" className={styles.heading}>
          or a regular
        </h3>
        {regulars.length > FILTER_FROM && (
          <label className={styles.filter}>
            <Search size={15} strokeWidth={2} aria-hidden="true" />
            <span className="visually-hidden">Find a regular</span>
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Find a regular"
              autoComplete="off"
              enterKeyHint="search"
              onKeyDown={blurOnEnter}
            />
          </label>
        )}
        {shown.length === 0 ? (
          <p className={styles.none}>No regular matches “{filter.trim()}”.</p>
        ) : (
          <ul className={styles.list}>
            {shown.map((meal) => (
              <li key={meal.id} className={styles.row}>
                <button type="button" className={styles.log} onClick={() => onLogRegular(meal)}>
                  {meal.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- saved data URL or demo stock photo
                    <img src={meal.photo} alt="" className={styles.thumb} />
                  ) : (
                    <span className={styles.thumb}>
                      <UtensilsCrossed size={16} strokeWidth={1.6} aria-hidden="true" />
                    </span>
                  )}
                  <span className={styles.name}>{meal.name}</span>
                  <span className={`mono ${styles.protein}`}>{meal.macros.protein} g</span>
                  <span className="visually-hidden">, log 1×</span>
                </button>
                <button type="button" className={styles.adjust} onClick={() => onAdjustRegular(meal)}>
                  <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
                  <span className="visually-hidden">Adjust {meal.name} before logging</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
