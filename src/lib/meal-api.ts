"use client";

import type { Analysis } from "./types";
import type { PreparedImage } from "./image";

export type AnalyzeFailure = "not_configured" | "quota" | "unreadable" | "offline" | "failed";

export type AnalyzeResult = { ok: true; analysis: Analysis } | { ok: false; reason: AnalyzeFailure };

export async function requestAnalysis(image: PreparedImage): Promise<AnalyzeResult> {
  let response: Response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: image.base64, mimeType: image.mimeType }),
    });
  } catch {
    return { ok: false, reason: "offline" };
  }

  if (response.ok) return { ok: true, analysis: (await response.json()) as Analysis };

  const { error } = (await response.json().catch(() => ({}))) as { error?: string };
  if (error === "not_configured" || error === "quota" || error === "unreadable") return { ok: false, reason: error };
  return { ok: false, reason: "failed" };
}
