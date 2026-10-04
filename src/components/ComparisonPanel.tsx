"use client";

import { useEffect, useState } from "react";
import { Share } from "lucide-react";
import { buildExport, clearSamples, sampleStats } from "@/lib/comparison-store";
import { deliverFile, isAbort } from "@/lib/share-file";
import { Panel } from "./Panel";
import { SwitchRow } from "./SwitchRow";
import styles from "./ComparisonPanel.module.css";

type ComparisonPanelProps = {
  enabled: boolean;
  onToggle: (on: boolean) => void;
  /** Bumped after each kept photo so the count refreshes. */
  revision: number;
};

type Status = { kind: "idle" } | { kind: "working"; label: string } | { kind: "message"; text: string };

const fileSize = (bytes: number) => (bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`);

export function ComparisonPanel({ enabled, onToggle, revision }: ComparisonPanelProps) {
  const [stats, setStats] = useState<{ count: number; bytes: number } | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    let live = true;
    sampleStats()
      .then((next) => live && setStats(next))
      .catch(() => live && setStats({ count: 0, bytes: 0 }));
    return () => {
      live = false;
    };
  }, [revision]);

  const toggle = (on: boolean) => {
    onToggle(on);
    // Ask the browser not to evict the photos when space runs low; it may say no.
    if (on) void navigator.storage?.persist?.();
  };

  const exportSamples = async () => {
    setStatus({ kind: "working", label: "Preparing…" });
    try {
      const data = await buildExport();
      const stamp = new Date().toISOString().slice(0, 10);
      const file = new File([JSON.stringify(data)], `mycalorie-comparison-${stamp}.json`, { type: "application/json" });
      await deliverFile(file, "Mycalorie comparison photos");
      setStatus({ kind: "message", text: `Exported ${data.samples.length} photos. On your Mac: npm run compare -- --from <that file>` });
    } catch (error) {
      if (isAbort(error)) return setStatus({ kind: "idle" });
      setStatus({ kind: "message", text: "Couldn’t export. Try again, or free some space on the phone." });
    }
  };

  const clear = async () => {
    if (!confirmingClear) return setConfirmingClear(true);
    setConfirmingClear(false);
    await clearSamples();
    setStats({ count: 0, bytes: 0 });
    setStatus({ kind: "message", text: "Kept photos deleted." });
  };

  const count = stats?.count ?? 0;

  return (
    <Panel title="model comparison" meta={count > 0 ? `${count} kept` : undefined} headingId="comparison-heading">
      <SwitchRow
        label="Keep meal photos for comparison"
        hint="Saves each photo you log with each AI’s first answer and what you logged after fixing it. Stays on this phone."
        on={enabled}
        onChange={toggle}
      />

      {count > 0 && (
        <div className={styles.actions}>
          <span className={`mono ${styles.size}`}>
            {count} photos · {fileSize(stats!.bytes)}
          </span>
          <button type="button" className={styles.clear} onClick={() => void clear()} disabled={status.kind === "working"}>
            {confirmingClear ? `Tap again to delete ${count}` : "Clear"}
          </button>
          <button type="button" className={styles.export} onClick={() => void exportSamples()} disabled={status.kind === "working"}>
            <Share size={15} strokeWidth={2} aria-hidden="true" />
            {status.kind === "working" ? status.label : "Export"}
          </button>
        </div>
      )}

      {status.kind === "message" && (
        <p className={styles.message} role="status">
          {status.text}
        </p>
      )}
    </Panel>
  );
}
