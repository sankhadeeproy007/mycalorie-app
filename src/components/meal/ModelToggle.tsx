"use client";

import type { AnalyzeFailure } from "@/lib/meal-api";
import type { PhotoModel } from "@/lib/types";
import { CLAUDE_FAILURE_COPY, FAILURE_COPY } from "./failure-copy";
import styles from "./MealSheet.module.css";

/** Where one AI's answer stands: not asked yet, being read, answered (with its cost), or failed. */
export type ModelState =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "answered"; costUsd: number | null }
  | { kind: "failed"; reason: AnalyzeFailure; detail?: string };

export const IDLE_MODELS: Record<PhotoModel, ModelState> = { gemini: { kind: "idle" }, claude: { kind: "idle" } };

const NAMES: Record<PhotoModel, string> = { gemini: "Gemini", claude: "Claude" };
/** What an answer will cost before it's asked for. */
const EXPECTED: Record<PhotoModel, string> = { gemini: "free", claude: "~2¢" };

const cents = (usd: number) => `${(usd * 100).toFixed(usd < 0.1 ? 1 : 0)}¢`;

export const failureCopy = (model: PhotoModel, reason: AnalyzeFailure) =>
  (model === "claude" ? CLAUDE_FAILURE_COPY : FAILURE_COPY)[reason];

type ModelToggleProps = {
  /** The preferred AI first. */
  order: [PhotoModel, PhotoModel];
  active: PhotoModel;
  states: Record<PhotoModel, ModelState>;
  onShow: (model: PhotoModel) => void;
  onAsk: (model: PhotoModel) => void;
};

function label(model: PhotoModel, state: ModelState): string {
  if (state.kind === "idle") return `Try ${NAMES[model]}`;
  if (state.kind === "reading") return `${NAMES[model]} reading…`;
  if (state.kind === "failed") return `Retry ${NAMES[model]}`;
  return NAMES[model];
}

function note(model: PhotoModel, state: ModelState): string | null {
  if (state.kind === "answered") return model === "gemini" ? "free" : state.costUsd === null ? null : cents(state.costUsd);
  return state.kind === "reading" ? null : EXPECTED[model];
}

/** Two answers to one photo: flip between them and log whichever is closer. */
export function ModelToggle({ order, active, states, onShow, onAsk }: ModelToggleProps) {
  const failed = order.filter((model) => states[model].kind === "failed");

  return (
    <div className={styles.models}>
      <div className={styles.modelSwitch} role="group" aria-label="Which AI's answer to show">
        {order.map((model) => {
          const state = states[model];
          const extra = note(model, state);
          return (
            <button
              key={model}
              type="button"
              className={styles.modelOption}
              aria-pressed={active === model && state.kind === "answered"}
              aria-busy={state.kind === "reading"}
              disabled={state.kind === "reading"}
              onClick={() => (state.kind === "answered" ? onShow(model) : onAsk(model))}
            >
              {label(model, state)}
              {extra && <span className={`mono ${styles.modelNote}`}>{extra}</span>}
            </button>
          );
        })}
      </div>
      {failed.map((model) => {
        const state = states[model] as Extract<ModelState, { kind: "failed" }>;
        return (
          <p key={model} className={styles.inlineFailure} role="alert">
            {failureCopy(model, state.reason)}
            {state.detail && <span className={`mono ${styles.failureDetail}`}>details: {state.detail}</span>}
          </p>
        );
      })}
    </div>
  );
}
