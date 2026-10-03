"use client";

import { useRef, useState, type FormEvent } from "react";
import styles from "./unlock.module.css";

type Status = "idle" | "checking" | "wrong" | "too_many" | "not_configured" | "offline";

const MESSAGES: Partial<Record<Status, string>> = {
  wrong: "That code didn’t work. Try again.",
  too_many: "Too many wrong tries. Wait 15 minutes, then try again.",
  not_configured: "No access code is set on the server yet. Add ACCESS_CODE and SESSION_SECRET in Vercel.",
  offline: "Couldn’t reach the server. Check your connection.",
};

const ERROR_BY_STATUS: Record<number, Status> = { 401: "wrong", 429: "too_many", 503: "not_configured" };

type CodeFormProps = { length: number; destination: string };

/**
 * One real input (so paste and iOS one-time-code autofill work) drawn as a row of
 * mono cells. It submits by itself once every digit is in.
 */
export function CodeForm({ length, destination }: CodeFormProps) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (value: string) => {
    setStatus("checking");
    let response: Response;
    try {
      response = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
    } catch {
      setStatus("offline");
      return;
    }
    if (response.ok) {
      window.location.replace(destination);
      return;
    }
    setStatus(ERROR_BY_STATUS[response.status] ?? "offline");
    setCode("");
    inputRef.current?.focus();
  };

  const onChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, length);
    setCode(digits);
    if (status !== "checking" && status !== "too_many") setStatus("idle");
    if (digits.length === length) void submit(digits);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (code.length === length) void submit(code);
  };

  const message = MESSAGES[status];
  const activeIndex = Math.min(code.length, length - 1);

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.cells} data-state={status}>
        <span className="visually-hidden">Access code, {length} digits</span>
        <input
          ref={inputRef}
          className={styles.input}
          value={code}
          onChange={(event) => onChange(event.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={length}
          autoFocus
          disabled={status === "checking" || status === "too_many"}
          aria-invalid={status === "wrong"}
          aria-describedby="unlock-message"
        />
        {Array.from({ length }, (_, index) => (
          <span
            key={index}
            className={`mono ${styles.cell}`}
            data-filled={index < code.length ? "" : undefined}
            data-active={index === activeIndex && status !== "checking" ? "" : undefined}
            aria-hidden="true"
          >
            {code[index] ?? ""}
          </span>
        ))}
      </label>

      <p id="unlock-message" className={styles.message} role={message ? "alert" : undefined} data-state={status}>
        {status === "checking" ? "Checking…" : (message ?? "")}
      </p>

      <button type="submit" className={styles.submit} disabled={code.length !== length || status === "checking"}>
        Unlock
      </button>
    </form>
  );
}
