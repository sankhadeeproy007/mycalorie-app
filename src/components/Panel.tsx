"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./Panel.module.css";

type PanelProps = {
  title: string;
  /** Right side of the header: a figure, a count, an action. */
  meta?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  headingId?: string;
  /** Makes the header a toggle that folds the panel down to just its header. */
  collapsible?: { collapsed: boolean; onToggle: () => void };
};

/** A console panel: small-caps header, hairline seams, one elevation step. */
export function Panel({ title, meta, footer, children, className, headingId, collapsible }: PanelProps) {
  const contentId = useId();
  const collapsed = collapsible?.collapsed ?? false;

  return (
    <section
      className={`${styles.panel} ${className ?? ""}`}
      aria-labelledby={headingId}
      data-collapsed={collapsed ? "" : undefined}
    >
      <header className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          {collapsible ? (
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={!collapsed}
              aria-controls={contentId}
              onClick={collapsible.onToggle}
            >
              {title}
              <ChevronDown size={14} strokeWidth={2} className={styles.chevron} aria-hidden="true" />
            </button>
          ) : (
            title
          )}
        </h2>
        {meta && <div className={styles.meta}>{meta}</div>}
      </header>
      <div id={contentId} className={styles.content} inert={collapsed || undefined}>
        <div className={styles.contentInner}>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      </div>
    </section>
  );
}
