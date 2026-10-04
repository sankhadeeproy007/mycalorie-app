"use client";

import { totalMacros, formatQuantity, formatUnit } from "./items";
import type { PreparedImage } from "./image";
import { isOwner } from "./current-user";
import { readSettings } from "./store";
import type { Analysis, EstimatedItem, PhotoModel, SavedMeal } from "./types";

export type AnalyzeFailure = "not_configured" | "quota" | "unreadable" | "offline" | "failed";

/** `detail` is the server's short technical reason, shown small under the error to help diagnose it. */
export type ApiResult<T> = { ok: true; value: T } | { ok: false; reason: AnalyzeFailure; detail?: string };

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
  const { error, detail } = (await response.json().catch(() => ({}))) as { error?: string; detail?: string };
  return {
    ok: false,
    reason: KNOWN_FAILURES.has(error as AnalyzeFailure) ? (error as AnalyzeFailure) : "failed",
    detail: detail ?? (error ? undefined : `HTTP ${response.status}`),
  };
}

/** A one-line description of each regular, so the AI can recognise it in a photo. */
function summarise(regular: SavedMeal): string {
  if (regular.product) return `packaged product, 1 ${regular.product.servingLabel} = ${regular.product.servingSize} ${regular.product.servingUnit}`;
  if (!regular.items?.length) return "saved meal";
  return regular.items.map((item) => `${formatQuantity(item.quantity)} ${formatUnit(item.unit, item.quantity)} ${item.name}`).join(", ");
}

export type PhotoContext = { hint: string; outside: boolean; regulars: SavedMeal[] };

/** Claude's answers come back with what they cost. */
export function requestAnalysis(image: PreparedImage, { hint, outside, regulars }: PhotoContext, model: PhotoModel = "gemini") {
  return post<Analysis & { costUsd?: number }>("/api/analyze", {
    model,
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

/** Which AI reads a meal first: the owner's choice (Claude unless switched off), Gemini for everyone else. */
export function preferredModel(): PhotoModel {
  return isOwner() && (readSettings().readWith ?? "claude") === "claude" ? "claude" : "gemini";
}

export const otherModel = (model: PhotoModel): PhotoModel => (model === "claude" ? "gemini" : "claude");

type Estimate = { name: string; items: EstimatedItem[]; costUsd?: number };

function requestEstimate(text: string, outside: boolean, model: PhotoModel) {
  return post<Estimate>("/api/estimate", { text, outside, model });
}

/** A description, read by the preferred AI; if Claude can't answer (no credit, say), free Gemini does. */
export async function estimateDescription(text: string, outside: boolean): Promise<ApiResult<Estimate>> {
  const model = preferredModel();
  const result = await requestEstimate(text, outside, model);
  return result.ok || model === "gemini" ? result : requestEstimate(text, outside, "gemini");
}
