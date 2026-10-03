import styles from "./SwitchRow.module.css";

type SwitchRowProps = {
  label: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
};

/** A whole-row on/off switch: the label, a line of explanation, and the toggle. */
export function SwitchRow({ label, hint, on, onChange }: SwitchRowProps) {
  return (
    <button type="button" role="switch" aria-checked={on} className={styles.row} onClick={() => onChange(!on)}>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        <span className={styles.hint}>{hint}</span>
      </span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </button>
  );
}
