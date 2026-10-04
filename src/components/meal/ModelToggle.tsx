"use client";

import type { AnalyzeFailure } from "@/lib/meal-api";
import type { PhotoModel } from "@/lib/types";
import { CLAUDE_FAILURE_COPY } from "./failure-copy";
import styles from "./MealSheet.module.css";

/** Where Claude's answer stands: not asked yet, being read, answered (with its cost), or failed. */
export type ClaudeState =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "answered"; costUsd: number | null }
  | { kind: "failed"; reason: AnalyzeFailure; detail?: string };

type ModelToggleProps = {
  active: PhotoModel;
  /** Gemini's answer exists; false when Gemini failed and Claude was asked instead. */
  geminiAnswered: boolean;
  claude: ClaudeState;
  onShow: (model: PhotoModel) => void;
  onAskClaude: () => void;
};

const cents = (usd: number) => `${(usd * 100).toFixed(usd < 0.1 ? 1 : 0)}¢`;

/** Two answers to one photo: flip between them and log whichever is closer. */
export function ModelToggle({ active, geminiAnswered, claude, onShow, onAskClaude }: ModelToggleProps) {
  const claudeLabel =
    claude.kind === "idle" ? "Try Claude" : claude.kind === "reading" ? "Claude reading…" : claude.kind === "failed" ? "Retry Claude" : "Claude";

  return (
    <div className={styles.models}>
      <div className={styles.modelSwitch} role="group" aria-label="Which AI's answer to show">
        <button
          type="button"
          className={styles.modelOption}
          aria-pressed={active === "gemini"}
          disabled={!geminiAnswered}
          onClick={() => onShow("gemini")}
        >
          Gemini
          <span className={`mono ${styles.modelNote}`}>{geminiAnswered ? "free" : "failed"}</span>
        </button>
        <button
          type="button"
          className={styles.modelOption}
          aria-pressed={active === "claude"}
          aria-busy={claude.kind === "reading"}
          disabled={claude.kind === "reading"}
          onClick={() => (claude.kind === "answered" ? onShow("claude") : onAskClaude())}
        >
          {claudeLabel}
          {claude.kind === "answered" && claude.costUsd !== null && (
            <span className={`mono ${styles.modelNote}`}>{cents(claude.costUsd)}</span>
          )}
          {claude.kind === "idle" && <span className={`mono ${styles.modelNote}`}>~2¢</span>}
        </button>
      </div>
      {claude.kind === "failed" && (
        <p className={styles.inlineFailure} role="alert">
          {CLAUDE_FAILURE_COPY[claude.reason]}
          {claude.detail && <span className={`mono ${styles.failureDetail}`}>details: {claude.detail}</span>}
        </p>
      )}
    </div>
  );
}
