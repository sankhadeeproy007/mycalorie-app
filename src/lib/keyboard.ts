import type { KeyboardEvent } from "react";

/** Return pressed to finish typing, not mid-composition in an IME (Hindi, emoji, predictive keyboards). */
const isFinalEnter = (event: KeyboardEvent) => event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing;

/** "Done": closes the keyboard instead of submitting the form underneath. */
export function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (!isFinalEnter(event)) return;
  event.preventDefault();
  event.currentTarget.blur();
}

/** "Go" in a text area: submits its form; Shift+Return still adds a new line. */
export function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (!isFinalEnter(event)) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

/** "Next": moves to the following field in the same group; the last field submits as usual. */
export function nextOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (!isFinalEnter(event)) return;
  const group = event.currentTarget.closest("fieldset");
  const fields = group ? [...group.querySelectorAll<HTMLInputElement>("input")] : [];
  const next = fields[fields.indexOf(event.currentTarget) + 1];
  if (!next) return;
  event.preventDefault();
  next.focus();
}

/** Brings a focused field into view once the keyboard has finished sliding up. */
export function revealWhenFocused(target: EventTarget) {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  window.setTimeout(() => target.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
}
