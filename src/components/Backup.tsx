"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileUp, Share } from "lucide-react";
import {
  backupFile,
  dismissPromptFor,
  markBackedUp,
  parseBackup,
  promptDue,
  useBackupStatus,
  type ParsedBackup,
} from "@/lib/backup";
import { dayKey, formatDayHeading } from "@/lib/day";
import { formatAmount } from "@/lib/format";
import { deliverFile, isAbort } from "@/lib/share-file";
import { readRealState, replaceRealState } from "@/lib/store";
import { Panel } from "./Panel";
import styles from "./Backup.module.css";

type Notify = (message: string) => void;

/** "today", "yesterday", "4 days ago", or "never". */
function sinceLast(lastAt: number | null, today: string): string {
  if (lastAt === null) return "never";
  const [y, m, d] = today.split("-").map(Number);
  const last = new Date(lastAt);
  const days = Math.round(
    (new Date(y, m - 1, d).getTime() - new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime()) / 86_400_000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** Saving a backup and restoring one, shared by the daily prompt and the backup panel. */
function useBackupActions(notify: Notify) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const backUp = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await deliverFile(backupFile(readRealState()), "Mycalorie backup");
      markBackedUp();
      notify("backup saved");
    } catch (error) {
      if (!isAbort(error)) setProblem("Couldn’t make the backup. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const pick = () => {
    setProblem(null);
    fileInput.current?.click();
  };

  const read = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed) return setProblem("That file isn’t a Mycalorie backup, or it’s damaged.");
    setPending(parsed);
  };

  const confirm = () => {
    if (!pending) return;
    try {
      replaceRealState(pending.state);
      // The restored data is already safe in that file, so today needs no further prompt.
      markBackedUp(pending.exportedAt || Date.now());
      dismissPromptFor(dayKey());
      notify(`restored ${formatAmount(pending.meals)} meals`);
      setPending(null);
    } catch {
      setProblem("Not enough room on this phone to restore that backup.");
    }
  };

  const input = (
    <input ref={fileInput} type="file" accept=".json,application/json" className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={read} />
  );

  return { busy, pending, problem, backUp, pick, confirm, cancel: () => setPending(null), input };
}

type Actions = ReturnType<typeof useBackupActions>;

/** Spells out what a restore will replace before it happens. */
function ConfirmRestore({ actions, replacing }: { actions: Actions; replacing: boolean }) {
  const { pending } = actions;
  if (!pending) return null;
  const from = pending.exportedAt ? formatDayHeading(dayKey(new Date(pending.exportedAt))) : "an unknown day";
  return (
    <div className={styles.confirm} role="group" aria-label="Restore backup">
      <p className={styles.confirmText}>
        Backup from <strong>{from}</strong>: {formatAmount(pending.meals)} meals, {pending.regulars} regulars.
        {replacing && " It replaces everything on this phone."}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.quiet} onClick={actions.cancel}>
          Cancel
        </button>
        <button type="button" className={styles.strong} onClick={actions.confirm}>
          {replacing ? "Replace" : "Restore"}
        </button>
      </div>
    </div>
  );
}

type PromptProps = { today: string; hasData: boolean; onNotice: Notify };

/**
 * Asks once a day, until acted on, to save a backup. On a fresh install with nothing in it,
 * it offers to restore one instead.
 */
export function BackupPrompt({ today, hasData, onNotice }: PromptProps) {
  const backup = useBackupStatus();
  const actions = useBackupActions(onNotice);
  if (!backup || !promptDue(backup, today)) return null;

  const dismiss = () => dismissPromptFor(today);

  return (
    <section className={styles.prompt} aria-labelledby="backup-prompt-heading">
      {actions.input}
      <div className={styles.promptHead}>
        <h2 id="backup-prompt-heading" className={styles.promptTitle}>
          {hasData ? "Back up today" : "Restore a backup?"}
        </h2>
        {hasData && <span className={`mono ${styles.since}`}>last: {sinceLast(backup.lastAt, today)}</span>}
      </div>
      <p className={styles.promptText}>
        {hasData
          ? "Save a copy of your meals, regulars and targets to Files. If the app is ever reinstalled, restore it from there."
          : "If you’ve used Mycalorie before, pick your latest backup file to bring your meals and regulars back."}
      </p>

      {actions.pending ? (
        <ConfirmRestore actions={actions} replacing={hasData} />
      ) : (
        <div className={styles.actions}>
          <button type="button" className={styles.quiet} onClick={dismiss}>
            {hasData ? "Not today" : "Start fresh"}
          </button>
          {hasData ? (
            <button type="button" className={styles.strong} onClick={() => void actions.backUp()} disabled={actions.busy}>
              <Share size={15} strokeWidth={2} aria-hidden="true" />
              {actions.busy ? "Preparing…" : "Save backup"}
            </button>
          ) : (
            <button type="button" className={styles.strong} onClick={actions.pick}>
              <FileUp size={15} strokeWidth={2} aria-hidden="true" />
              Choose file
            </button>
          )}
        </div>
      )}
      {actions.problem && (
        <p className={styles.problem} role="alert">
          {actions.problem}
        </p>
      )}
    </section>
  );
}

type PanelProps = { today: string; demo: boolean; hasData: boolean; onNotice: Notify };

/** Backup and restore whenever wanted, with when the last backup was made. */
export function BackupPanel({ today, demo, hasData, onNotice }: PanelProps) {
  const backup = useBackupStatus();
  const actions = useBackupActions(onNotice);

  return (
    <Panel title="backup" meta={backup ? `last: ${sinceLast(backup.lastAt, today)}` : undefined} headingId="backup-heading">
      {actions.input}
      <p className={styles.text}>
        {demo
          ? "Backups cover your real data. Switch off demo data to back up or restore."
          : "Your data lives only on this phone. A backup file in Files brings it back after a reinstall or on a new phone."}
      </p>
      {!demo &&
        (actions.pending ? (
          <ConfirmRestore actions={actions} replacing={hasData} />
        ) : (
          <div className={styles.actions}>
            <button type="button" className={styles.quiet} onClick={actions.pick}>
              <FileUp size={15} strokeWidth={2} aria-hidden="true" />
              Restore
            </button>
            <button type="button" className={styles.strong} onClick={() => void actions.backUp()} disabled={actions.busy}>
              <Share size={15} strokeWidth={2} aria-hidden="true" />
              {actions.busy ? "Preparing…" : "Back up now"}
            </button>
          </div>
        ))}
      {actions.problem && (
        <p className={styles.problem} role="alert">
          {actions.problem}
        </p>
      )}
    </Panel>
  );
}
