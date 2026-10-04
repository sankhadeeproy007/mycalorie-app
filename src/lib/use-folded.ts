"use client";

import { useState } from "react";

function readFolded(key: string): boolean | null {
  try {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(key);
    return stored === "1" ? true : stored === "0" ? false : null;
  } catch {
    return null;
  }
}

/**
 * Whether a panel is folded, as the owner last left it on this phone; `null` until they first fold or
 * open it, so the caller picks the default.
 */
export function useFolded(key: string): [boolean | null, (folded: boolean) => void] {
  const [folded, setFolded] = useState(() => readFolded(key));
  const set = (next: boolean) => {
    setFolded(next);
    try {
      window.localStorage.setItem(key, next ? "1" : "0");
    } catch {
      // Not remembered without storage; the panel still folds.
    }
  };
  return [folded, set];
}
