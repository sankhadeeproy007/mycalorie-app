import "server-only";
import type { Analysis, AnalyzedItem } from "./types";

/**
 * The only place that talks to an AI provider. Swap this file to change
 * providers; the route and UI only see `Analysis`.
 */

const DEFAULT_MODEL = "gemini-flash-latest";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export class AnalysisError extends Error {
  constructor(
    readonly code: "not_configured" | "quota" | "unreadable" | "upstream",
    message: string,
  ) {
    super(message);
  }
}

const PROMPT = `You estimate nutrition from a photo of a single meal. The person lives in India and mostly eats Indian food:
home-cooked North and South Indian meals, thalis, tiffin, street food and restaurant dishes.

- Name each dish the way an Indian home cook would ("Dal tadka", "Jeera rice", "Aloo gobi", "Rajma chawal", "Masala dosa"),
  not with generic Western names. Give the meal a short overall name of at most four words, like "Rajma chawal".
- For each item, give the portion in Indian household measures as eaten ("2 rotis", "1 katori", "1 ladle", "4 idlis",
  "1 plate", "2 pieces") and your estimate in grams. A steel katori holds about 150 ml; a home roti is about 35–40 g.
- Count countable items carefully: rotis, parathas, puris, idlis, eggs, pieces of chicken or paneer.
- Base values on the Indian Food Composition Tables (IFCT 2017, NIN) where you can.
  Account for the oil or ghee in tadka and gravies: moderate for home cooking, more for restaurant and street food.
- Include visible sides such as chutney, sambar, raita, pickle, papad, salad and sweets.
- If the photo does not show food, return an empty items list and the name "Not food".`;

const NUMBER = { type: "NUMBER" } as const;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          portion: { type: "STRING" },
          grams: NUMBER,
          protein: NUMBER,
          kcal: NUMBER,
          carbs: NUMBER,
          fat: NUMBER,
        },
        required: ["name", "portion", "grams", "protein", "kcal", "carbs", "fat"],
      },
    },
  },
  required: ["name", "items"],
};

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

const round = (value: number) => Math.max(0, Math.round(value));

function normalise(raw: { name: string; items: AnalyzedItem[] }): Analysis {
  const items = raw.items.map((item) => ({
    name: item.name,
    portion: item.portion?.trim() ?? "",
    grams: round(item.grams),
    protein: round(item.protein),
    kcal: round(item.kcal),
    carbs: round(item.carbs),
    fat: round(item.fat),
  }));
  const sum = (key: "protein" | "kcal" | "carbs" | "fat") => items.reduce((total, item) => total + item[key], 0);
  return {
    name: raw.name.trim() || "Meal",
    items,
    totals: { protein: sum("protein"), kcal: sum("kcal"), carbs: sum("carbs"), fat: sum("fat") },
  };
}

export async function analyzeMeal(base64: string, mimeType: string): Promise<Analysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AnalysisError("not_configured", "GEMINI_API_KEY is not set");

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: PROMPT }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, temperature: 0.2 },
    }),
  });

  if (response.status === 429) throw new AnalysisError("quota", "The free Gemini quota is used up for now");
  if (!response.ok) {
    throw new AnalysisError("upstream", `Gemini returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const text = ((await response.json()) as GeminiResponse).candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new AnalysisError("upstream", "Gemini returned no answer");

  const analysis = normalise(JSON.parse(text));
  if (analysis.items.length === 0) throw new AnalysisError("unreadable", "No food found in the photo");
  return analysis;
}
