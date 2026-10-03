"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BRAND_LEVELS, BRAND_RAMP } from "@/app/brand-mark";
import styles from "./LaunchScreen.module.css";

/** Long enough for the wave to cross the mark once, so a fast load doesn't just flash. */
const MIN_VISIBLE_MS = 700;

/**
 * The app mark while the app gets ready: its cells light up in a diagonal wave
 * and pulse, then the whole screen fades. It is in the server HTML, so it shows
 * before any JavaScript runs, instead of a blank screen.
 */
export function LaunchScreen({ ready }: { ready: boolean }) {
  const shownAt = useRef<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    shownAt.current ??= performance.now();
    if (!ready) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt.current));
    const timer = window.setTimeout(() => setLeaving(true), wait);
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (gone) return null;

  return (
    <div
      className={styles.screen}
      data-leaving={leaving ? "" : undefined}
      onTransitionEnd={(event) => event.target === event.currentTarget && leaving && setGone(true)}
      role="status"
      aria-label="Loading Mycalorie"
    >
      <div className={styles.mark} aria-hidden="true">
        {BRAND_LEVELS.flatMap((row, rowIndex) =>
          row.map((level, columnIndex) => (
            <span
              key={`${rowIndex}-${columnIndex}`}
              className={styles.cell}
              style={
                {
                  "--lit": BRAND_RAMP[level],
                  "--delay": `${(rowIndex + columnIndex) * 70}ms`,
                } as CSSProperties
              }
            />
          )),
        )}
      </div>
      <span className={`mono ${styles.name}`}>mycalorie</span>
    </div>
  );
}
