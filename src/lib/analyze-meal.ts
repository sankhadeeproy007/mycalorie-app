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
import { callGemini } from "./providers/gemini";
import type { Analysis, EstimatedItem } from "./types";

export { AnalysisError } from "./analysis-error";
export type { RegularSummary } from "./meal-prompt";

/**
 * The app's AI entry points. Gemini answers today; swap the provider call here
 * to change that. The routes and UI only see `Analysis` and `EstimatedItem`.
 */

const gemini = () => ({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || undefined });

export async function analyzePhoto(base64: string, mimeType: string, context: MealContext): Promise<Analysis> {
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
