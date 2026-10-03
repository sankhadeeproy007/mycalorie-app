"use client";

import { useEffect } from "react";
import styles from "./Toast.module.css";

export type UndoNotice = { key: string; message: string; undo?: () => void };

const VISIBLE_MS = 5000;

type ToastProps = {
  notice: UndoNotice | null;
  onDismiss: () => void;
};

export function Toast({ notice, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  return (
    <div className={styles.dock} aria-live="polite">
      {notice && (
        <div key={notice.key} className={styles.toast}>
          <span className={styles.message}>{notice.message}</span>
          {notice.undo && (
            <button
              type="button"
              className={styles.undo}
              onClick={() => {
                notice.undo?.();
                onDismiss();
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
