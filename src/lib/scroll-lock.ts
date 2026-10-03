"use client";

/**
 * Freezes the page behind a modal sheet. iOS Safari keeps scrolling the page
 * under a modal <dialog>, and overflow: hidden alone doesn't stop touch
 * scrolling there, so the body is pinned in place and restored on release.
 * Counted, so stacked sheets share one lock.
 */

let holders = 0;
let savedScrollY = 0;

export function lockPageScroll(): () => void {
  if (holders++ === 0) {
    savedScrollY = window.scrollY;
    Object.assign(document.body.style, {
      position: "fixed",
      top: `-${savedScrollY}px`,
      left: "0",
      right: "0",
      width: "100%",
      overflow: "hidden",
    });
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--holders > 0) return;
    Object.assign(document.body.style, { position: "", top: "", left: "", right: "", width: "", overflow: "" });
    window.scrollTo({ top: savedScrollY, behavior: "instant" });
  };
}
