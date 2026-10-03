"use client";

import { useRef, type ChangeEvent } from "react";
import { Camera, PenLine } from "lucide-react";
import styles from "./Dock.module.css";

type DockProps = {
  onPhoto: (file: File) => void;
  onTypeIn: () => void;
};

/** Fixed in the thumb zone: the screen's one primary action, and typing as the quiet alternative. */
export function Dock({ onPhoto, onTypeIn }: DockProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPhoto(file);
  };

  return (
    <div className={styles.dock}>
      <div className={styles.inner}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={onChange}
        />

        <button type="button" className={styles.primary} onClick={() => inputRef.current?.click()}>
          <Camera size={18} strokeWidth={2} aria-hidden="true" />
          Log a meal
        </button>

        <button type="button" className={styles.secondary} onClick={onTypeIn}>
          <PenLine size={16} strokeWidth={2} aria-hidden="true" />
          Type
          <span className="visually-hidden"> or describe a meal</span>
        </button>
      </div>
    </div>
  );
}
