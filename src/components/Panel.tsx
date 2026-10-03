import type { ReactNode } from "react";
import styles from "./Panel.module.css";

type PanelProps = {
  title: string;
  /** Right side of the header: a figure, a count, an action. */
  meta?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  headingId?: string;
};

/** A console panel: small-caps header, hairline seams, one elevation step. */
export function Panel({ title, meta, footer, children, className, headingId }: PanelProps) {
  return (
    <section className={`${styles.panel} ${className ?? ""}`} aria-labelledby={headingId}>
      <header className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
        {meta && <div className={styles.meta}>{meta}</div>}
      </header>
      <div className={styles.body}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </section>
  );
}
