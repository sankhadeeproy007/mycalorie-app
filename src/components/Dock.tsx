"use client";

import { Camera, PenLine } from "lucide-react";
import { usePhotoPicker } from "./usePhotoPicker";
import styles from "./Dock.module.css";

type DockProps = {
  onPhoto: (file: File) => void;
  /** Opens the log sheet (photo, describe, or a regular). Without it, the button goes straight to the camera. */
  onLog?: () => void;
  onTypeIn: () => void;
};

/** Fixed in the thumb zone: the screen's one primary action, and typing as the quiet alternative. */
export function Dock({ onPhoto, onLog, onTypeIn }: DockProps) {
  const photo = usePhotoPicker(onPhoto);

  return (
    <div className={styles.dock}>
      <div className={styles.inner}>
        {photo.input}

        <button type="button" className={styles.primary} onClick={onLog ?? photo.pick}>
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
