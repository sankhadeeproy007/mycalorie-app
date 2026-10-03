"use client";

import { totalMacros, formatQuantity, formatUnit } from "./items";
import type { PreparedImage } from "./image";
import type { Analysis, EstimatedItem, SavedMeal } from "./types";

export type AnalyzeFailure = "not_configured" | "quota" | "unreadable" | "offline" | "failed";

export type ApiResult<T> = { ok: true; value: T } | { ok: false; reason: AnalyzeFailure };

const KNOWN_FAILURES = new Set<AnalyzeFailure>(["not_configured", "quota", "unreadable"]);

async function post<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, reason: "offline" };
  }

  if (response.ok) return { ok: true, value: (await response.json()) as T };
  const { error } = (await response.json().catch(() => ({}))) as { error?: string };
  return { ok: false, reason: KNOWN_FAILURES.has(error as AnalyzeFailure) ? (error as AnalyzeFailure) : "failed" };
}

/** A one-line description of each regular, so the AI can recognise it in a photo. */
function summarise(regular: SavedMeal): string {
  if (regular.product) return `packaged product, 1 ${regular.product.servingLabel} = ${regular.product.servingSize} ${regular.product.servingUnit}`;
  if (!regular.items?.length) return "saved meal";
  return regular.items.map((item) => `${formatQuantity(item.quantity)} ${formatUnit(item.unit, item.quantity)} ${item.name}`).join(", ");
}

export type PhotoContext = { hint: string; outside: boolean; regulars: SavedMeal[] };

export function requestAnalysis(image: PreparedImage, { hint, outside, regulars }: PhotoContext) {
  return post<Analysis>("/api/analyze", {
    image: image.base64,
    mimeType: image.mimeType,
    hint,
    outside,
    regulars: regulars.map((regular) => ({
      id: regular.id,
      name: regular.name,
      summary: summarise(regular),
      protein: regular.items ? totalMacros(regular.items).protein : regular.macros.protein,
    })),
  });
}

export function requestEstimate(text: string, outside: boolean) {
  return post<{ name: string; items: EstimatedItem[] }>("/api/estimate", { text, outside });
}
