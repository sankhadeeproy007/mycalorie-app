import "server-only";
import {
  interpretPhoto,
  interpretText,
  PHOTO_SCHEMA,
  photoInstructions,
  TEXT_SCHEMA,
  textInstructions,
  type MealContext,
  type RawPhoto,
  type RawText,
} from "./meal-prompt";
import { callClaude } from "./providers/claude";
import { callGemini } from "./providers/gemini";
import type { Analysis, EstimatedItem, PhotoModel } from "./types";

export { AnalysisError } from "./analysis-error";
export type { RegularSummary } from "./meal-prompt";

/**
 * The app's AI entry points. Gemini reads photos and descriptions; Claude reads a photo when asked
 * for a second opinion. The routes and UI only see `Analysis` and `EstimatedItem`.
 */

const gemini = () => ({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || undefined });

type ImageType = "image/jpeg" | "image/png" | "image/webp";

/** Claude's answers carry what they cost, so the app can show it. */
export async function analyzePhoto(
  image: { base64: string; mimeType: ImageType },
  context: MealContext,
  model: PhotoModel = "gemini",
): Promise<Analysis & { costUsd?: number }> {
  if (model === "claude") {
    const { data, costUsd } = await callClaude<RawPhoto>(image, photoInstructions(context), PHOTO_SCHEMA);
    return { ...interpretPhoto(data, context), costUsd };
  }
  const { base64, mimeType } = image;
  const { data } = await callGemini<RawPhoto>(
    [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: photoInstructions(context) }],
    PHOTO_SCHEMA,
    gemini(),
  );
  return interpretPhoto(data, context);
}

export async function estimateFromText(description: string, outside: boolean): Promise<{ name: string; items: EstimatedItem[] }> {
  const { data } = await callGemini<RawText>([{ text: textInstructions(description, outside) }], TEXT_SCHEMA, gemini());
  return interpretText(data);
}
