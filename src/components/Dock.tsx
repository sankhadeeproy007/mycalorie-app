"use client";

import { useRef, type ChangeEvent } from "react";
import { Camera, PenLine } from "lucide-react";
import styles from "./Dock.module.css";

type DockProps = {
  /** Photo being read right now, if any. */
  readingPhoto: string | null;
  onPhoto: (file: File) => void;
  onTypeIn: () => void;
};

/** Fixed in the thumb zone: the screen's one primary action, and typing as the quiet alternative. */
export function Dock({ readingPhoto, onPhoto, onTypeIn }: DockProps) {
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

        {readingPhoto ? (
          <div className={styles.reading} role="status">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
            <img src={readingPhoto} alt="" className={styles.thumb} />
            <span className={styles.readingText}>
              <span className="mono">reading photo…</span>
              <span className={styles.progress} aria-hidden="true">
                <span />
              </span>
            </span>
          </div>
        ) : (
          <button type="button" className={styles.primary} onClick={() => inputRef.current?.click()}>
            <Camera size={18} strokeWidth={2} aria-hidden="true" />
            Log a meal
          </button>
        )}

        <button type="button" className={styles.secondary} onClick={onTypeIn} disabled={readingPhoto !== null}>
          <PenLine size={16} strokeWidth={2} aria-hidden="true" />
          Type
          <span className="visually-hidden"> a meal in by hand</span>
        </button>
      </div>
    </div>
  );
}
