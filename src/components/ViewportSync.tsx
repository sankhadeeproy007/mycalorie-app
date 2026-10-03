"use client";

import { useEffect } from "react";

/** Below this, a shrinking visible area is browser chrome moving, not a keyboard. */
const KEYBOARD_THRESHOLD = 80;

/**
 * Publishes how much of the screen the on-screen keyboard covers as CSS
 * variables (--keyboard-inset, --visual-height) and a data-keyboard flag on
 * <html>, so bottom sheets can sit above the keyboard. iOS Safari doesn't
 * resize the page for the keyboard; the visual viewport is the only signal.
 */
export function ViewportSync() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
        root.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
        root.style.setProperty("--visual-height", `${Math.round(viewport.height)}px`);
        root.toggleAttribute("data-keyboard", inset > KEYBOARD_THRESHOLD);
      });
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return null;
}
