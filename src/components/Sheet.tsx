"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { nextOnEnter, revealWhenFocused } from "@/lib/keyboard";
import { lockPageScroll } from "@/lib/scroll-lock";
import type { Macros } from "@/lib/types";
import styles from "./Sheet.module.css";

type SheetProps = {
  open: boolean;
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
};

/** A bottom sheet on the native modal dialog: Escape, backdrop tap and focus trapping come with it. */
export function Sheet({ open, labelledBy, onClose, children }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  /** Whether the app still wants the sheet open; a close it asked for itself isn't a dismissal. */
  const wantedOpen = useRef(open);

  useEffect(() => {
    wantedOpen.current = open;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal focuses the first control (Close); start where the task starts instead.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Layout effect: the page is pinned before paint and released in the same commit that closes the sheet.
  useLayoutEffect(() => (open ? lockPageScroll() : undefined), [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      aria-labelledby={labelledBy}
      // `onClose` means the person dismissed it (Escape, the backdrop, Close). When the app closes the
      // sheet to hand over to another one, reporting that as a dismissal would undo the hand-over.
      onClose={() => wantedOpen.current && onClose()}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      onFocus={(event) => revealWhenFocused(event.target)}
    >
      {open && children}
    </dialog>
  );
}

export function SheetHeader({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  return (
    <header className={styles.header}>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      <button type="button" className={styles.close} onClick={onClose}>
        <X size={20} strokeWidth={2} aria-hidden="true" />
        <span className="visually-hidden">Close</span>
      </button>
    </header>
  );
}

export type MacroValues = Record<keyof Macros, string>;

export const EMPTY_MACRO_VALUES: MacroValues = { protein: "", kcal: "", carbs: "", fat: "" };

const MACRO_FIELDS: { key: keyof Macros; label: string; unit: string }[] = [
  { key: "protein", label: "Protein", unit: "g" },
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
];

const MAX_DIGITS = 5;

type MacroFieldsProps = {
  legend: string;
  values: MacroValues;
  onChange: (values: MacroValues) => void;
  /** Which field the sheet opens on, if any. */
  autofocus?: keyof Macros;
  required?: (keyof Macros)[];
};

/** Protein large on its own row, then calories, carbs and fat. */
export function MacroFields({ legend, values, onChange, autofocus, required = [] }: MacroFieldsProps) {
  return (
    <fieldset className={styles.macros}>
      <legend className="visually-hidden">{legend}</legend>
      {MACRO_FIELDS.map(({ key, label, unit }, index) => (
        <label key={key} className={`${styles.field} ${key === "protein" ? styles.primaryField : ""}`}>
          <span className={styles.fieldLabel}>{label}</span>
          <span className={styles.unitInput}>
            <input
              className={styles.input}
              inputMode="decimal"
              value={values[key]}
              onChange={(event) =>
                onChange({ ...values, [key]: event.target.value.replace(/[^\d.]/g, "").slice(0, MAX_DIGITS) })
              }
              required={required.includes(key)}
              data-autofocus={autofocus === key ? "" : undefined}
              enterKeyHint={index < MACRO_FIELDS.length - 1 ? "next" : "done"}
              onKeyDown={nextOnEnter}
            />
            <span className={styles.unit}>{unit}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Parses a field to a whole, non-negative number, or `null` when left empty. */
export function parseAmount(value: string): number | null {
  if (value.trim() === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : null;
}

export { styles as sheetStyles };
