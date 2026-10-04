"use client";

/**
 * Hands a file to the share sheet (Save to Files, AirDrop) when the phone supports it, else downloads it.
 * Rejects with an `AbortError` DOMException when the share sheet is dismissed.
 */
export async function deliverFile(file: File, title: string) {
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title });
    return;
  }
  const url = URL.createObjectURL(file);
  const link = Object.assign(document.createElement("a"), { href: url, download: file.name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";
