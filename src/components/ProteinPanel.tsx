"use client";

import { SlidersHorizontal } from "lucide-react";
import { formatAmount } from "@/lib/format";
import type { Macros, Targets } from "@/lib/types";
import { useRolledNumber } from "@/lib/use-rolled-number";
import { Panel } from "./Panel";
import styles from "./ProteinPanel.module.css";

type ProteinPanelProps = {
  totals: Macros;
  targets: Targets;
  onEditTargets: () => void;
};

const SECONDARY = [
  { key: "kcal", label: "kcal", unit: "" },
  { key: "carbs", label: "carbs", unit: " g" },
  { key: "fat", label: "fat", unit: " g" },
] as const;

/** The first answer on the screen: protein to go, then what's left of everything else. */
export function ProteinPanel({ totals, targets, onEditTargets }: ProteinPanelProps) {
  const target = targets.protein;
  const eaten = useRolledNumber(totals.protein);

  const editButton = (
    <button type="button" className={styles.edit} onClick={onEditTargets}>
      <SlidersHorizontal size={14} strokeWidth={2} aria-hidden="true" />
      <span className="visually-hidden">Edit daily targets</span>
    </button>
  );

  if (target === null) {
    return (
      <Panel title="protein" meta={editButton} headingId="protein-heading">
        <p className={styles.empty}>Set daily targets for protein, calories, carbs and fat to see what&apos;s left as you eat.</p>
        <button type="button" className={styles.setTargets} onClick={onEditTargets}>
          Set targets
        </button>
      </Panel>
    );
  }

  const remaining = target - eaten;
  return (
    <Panel
      title="protein"
      headingId="protein-heading"
      meta={
        <>
          <span>
            {eaten} / {target} g
          </span>
          {editButton}
        </>
      }
    >
      <p className={styles.hero}>
        <span className={`mono ${styles.heroValue}`}>
          {remaining >= 0 ? remaining : `+${-remaining}`}
          <span className={styles.heroUnit}>g</span>
        </span>
        <span className={styles.heroLabel}>{remaining >= 0 ? "to go" : "past target"}</span>
      </p>
      <Meter ratio={eaten / target} colour="var(--protein)" className={styles.bar} />

      <dl className={`mono ${styles.rows}`}>
        {SECONDARY.map(({ key, label, unit }) => (
          <MacroRow key={key} label={label} unit={unit} colour={`var(--${key})`} eaten={totals[key]} target={targets[key]} />
        ))}
      </dl>
    </Panel>
  );
}

type MacroRowProps = { label: string; unit: string; colour: string; eaten: number; target: number | null };

function MacroRow({ label, unit, colour, eaten, target }: MacroRowProps) {
  const remaining = target === null ? null : target - eaten;
  return (
    <div className={styles.row}>
      <dt className={styles.rowLabel}>{label}</dt>
      <dd>{target !== null && <Meter ratio={eaten / target} colour={colour} className={styles.mini} />}</dd>
      <dd className={styles.rowValue}>
        {remaining === null ? (
          <>
            {formatAmount(eaten)}
            {unit} <span className={styles.rowState}>eaten</span>
          </>
        ) : (
          <>
            {remaining >= 0 ? formatAmount(remaining) : `+${formatAmount(-remaining)}`}
            {unit} <span className={styles.rowState}>{remaining >= 0 ? "left" : "over"}</span>
          </>
        )}
      </dd>
      <dd className={styles.rowTarget}>{target !== null && `/${formatAmount(target)}`}</dd>
    </div>
  );
}

function Meter({ ratio, colour, className }: { ratio: number; colour: string; className: string }) {
  return (
    <span className={className} aria-hidden="true">
      <span style={{ scale: `${Math.min(1, Math.max(0, ratio))} 1`, background: colour }} />
    </span>
  );
}
