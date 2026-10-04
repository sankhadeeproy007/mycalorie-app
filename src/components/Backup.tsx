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
import { dayKey, formatClock, formatDayHeading } from "@/lib/day";
import { formatAmount } from "@/lib/format";
import { deliverFile, isAbort } from "@/lib/share-file";
import { readRealState, replaceRealState } from "@/lib/store";
import { useSyncStatus, type SyncStatus } from "@/lib/sync";
import { useFolded } from "@/lib/use-folded";
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

/** The cloud copy is set up, whether or not this moment's sync went through. */
const cloudOn = (sync: SyncStatus | null) => sync !== null && sync.phase !== "off" && sync.phase !== "checking";

/** Spells out what a restore will replace before it happens. */
function ConfirmRestore({ actions, replacing, cloud }: { actions: Actions; replacing: boolean; cloud: boolean }) {
  const { pending } = actions;
  if (!pending) return null;
  const from = pending.exportedAt ? formatDayHeading(dayKey(new Date(pending.exportedAt))) : "an unknown day";
  return (
    <div className={styles.confirm} role="group" aria-label="Restore backup">
      <p className={styles.confirmText}>
        Backup from <strong>{from}</strong>: {formatAmount(pending.meals)} meals, {pending.regulars} regulars.
        {replacing && ` It replaces everything on this phone${cloud ? " and in the cloud" : ""}.`}
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
 * it offers to restore one instead. While the cloud copy is in sync it stays away: that copy
 * already covers a reinstall, and a fresh install fills itself from it.
 */
export function BackupPrompt({ today, hasData, onNotice }: PromptProps) {
  const backup = useBackupStatus();
  const sync = useSyncStatus();
  const actions = useBackupActions(onNotice);
  const cloudCovers = sync === null || sync.phase === "checking" || sync.phase === "syncing" || sync.phase === "synced";
  if (!backup || cloudCovers || !promptDue(backup, today)) return null;

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
        <ConfirmRestore actions={actions} replacing={hasData} cloud={cloudOn(sync)} />
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

const SYNC_META: Record<SyncStatus["phase"], string> = {
  checking: "checking…",
  off: "",
  syncing: "syncing…",
  synced: "synced",
  offline: "offline",
  error: "sync failed",
};

function syncText(sync: SyncStatus): string {
  const at = sync.syncedAt ? ` Last synced ${formatClock(sync.syncedAt)}.` : "";
  switch (sync.phase) {
    case "synced":
    case "syncing":
      return `Your data is kept in the cloud as well as on this phone, so a reinstall or a new phone gets it back after the access code.${at}`;
    case "offline":
      return `Offline. Changes stay on this phone and go to the cloud when you’re back online.${at}`;
    case "error":
      return `Couldn’t reach the cloud copy. Changes stay on this phone and are sent on the next try.${at}`;
    default:
      return "Your data lives only on this phone. A backup file in Files brings it back after a reinstall or on a new phone.";
  }
}

/** Cloud sync status, plus backup files and restore whenever wanted. */
export function BackupPanel({ today, demo, hasData, onNotice }: PanelProps) {
  const backup = useBackupStatus();
  const sync = useSyncStatus();
  const actions = useBackupActions(onNotice);
  const cloud = cloudOn(sync);
  // With sync running there's rarely anything to do here, so it starts folded to its status line.
  const [folded, setFolded] = useFolded("mycalorie:backup-collapsed");
  const collapsed = folded ?? (sync !== null && sync.phase !== "off");
  const lastFile = backup ? `last: ${sinceLast(backup.lastAt, today)}` : undefined;

  return (
    <Panel
      title={cloud ? "sync & backup" : "backup"}
      meta={cloud && sync ? SYNC_META[sync.phase] : lastFile}
      headingId="backup-heading"
      collapsible={{ collapsed, onToggle: () => setFolded(!collapsed) }}
    >
      {actions.input}
      <p className={styles.text}>
        {demo ? "Sync and backups cover your real data. Switch off demo data to back up or restore." : sync && syncText(sync)}
      </p>
      {cloud && !demo && lastFile && <p className={`mono ${styles.fileLine}`}>backup file · {lastFile}</p>}
      {!demo &&
        (actions.pending ? (
          <ConfirmRestore actions={actions} replacing={hasData} cloud={cloud} />
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
