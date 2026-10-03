import "server-only";
import type { Analysis, EstimatedItem, Macros } from "./types";

/**
 * The only place that talks to an AI provider. Swap this file to change
 * providers; the routes and UI only see `Analysis` and `EstimatedItem`.
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

export type RegularSummary = { id: string; name: string; summary: string; protein: number };

export type MealContext = {
  hint?: string;
  /** The owner said this was eaten out: assume restaurant oil, ghee and portions. */
  outside?: boolean;
  regulars?: RegularSummary[];
};

const ITEM_RULES = `Write each item the way an Indian home cook would ("Dal tadka", "Jeera rice", "Aloo gobi", "Masala dosa").
For every item give:
- quantity and unit in Indian household measures as eaten: "roti", "paratha", "idli", "egg", "piece", "katori", "ladle", "cup", "glass", "scoop", "plate", "slice"; use "g" or "ml" only for things measured by weight or volume. A steel katori holds about 150 ml; a home roti is about 35–40 g.
- grams: the item's total weight (ml for drinks), and isLiquid for drinks.
- protein, kcal, carbs and fat for the whole item at that quantity, based on the Indian Food Composition Tables (IFCT 2017, NIN) where you can.
- uncertain: true when the quantity can't be seen clearly (eggs folded into an omelette, rotis stacked out of sight, pieces under gravy, sugar in tea).
For cooked dishes, list the cooking oil, ghee or butter as its own item named "Oil / ghee" with unit "tsp" and cookingFat true, and leave that fat out of the dish's own numbers. Use moderate home-cooking amounts unless the food was eaten out.`;

function contextLines({ hint, outside, regulars }: MealContext): string {
  const lines: string[] = [];
  if (outside) {
    lines.push("The owner says this was eaten out (restaurant, dhaba, street food or delivery): assume restaurant amounts of oil, ghee, butter and portion size.");
  } else {
    lines.push("Judge from the photo whether it is home-cooked or restaurant food, and size the oil and portions accordingly.");
  }
  if (hint) lines.push(`The owner added this note, treat it as fact and only estimate what it leaves out: "${hint}"`);
  if (regulars?.length) {
    lines.push(
      "The owner's saved regular meals are listed below. If the photo is clearly one of them, set matchedRegularId to its id; otherwise null.",
      ...regulars.map((regular) => `- id ${regular.id}: ${regular.name} (${regular.summary}; ${regular.protein} g protein)`),
    );
  }
  return lines.join("\n");
}

const PHOTO_PROMPT = `You read a photo for a personal nutrition tracker. The owner lives in India and mostly eats Indian food: home-cooked North and South Indian meals, thalis, tiffin, street food and restaurant dishes.

First decide what the photo shows:
- "meal": food. Give the meal a short name of at most four words, like "Rajma chawal", and list the items.
- "label": a nutrition facts panel on packaging. Read the exact values; do not estimate. Give the serving as printed (servingLabel such as "scoop", "bar", "serving", "glass"; servingSize; servingUnit "g" or "ml"), the values per serving, and per 100 g/ml when printed. Give the product name only if the brand or product name is visible, otherwise null. Leave items empty.
- "not_food": anything else.

${ITEM_RULES}`;

const TEXT_PROMPT = `You estimate nutrition from a short description of food someone in India ate, for a personal nutrition tracker. Treat stated quantities as fact and assume typical home portions for anything unstated. Give the meal a short name of at most four words.

${ITEM_RULES}`;

const NUMBER = { type: "NUMBER" } as const;
const MACROS_SCHEMA = {
  type: "OBJECT",
  properties: { protein: NUMBER, kcal: NUMBER, carbs: NUMBER, fat: NUMBER },
  required: ["protein", "kcal", "carbs", "fat"],
};

const ITEMS_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      name: { type: "STRING" },
      quantity: NUMBER,
      unit: { type: "STRING" },
      grams: NUMBER,
      isLiquid: { type: "BOOLEAN" },
      uncertain: { type: "BOOLEAN" },
      cookingFat: { type: "BOOLEAN" },
      protein: NUMBER,
      kcal: NUMBER,
      carbs: NUMBER,
      fat: NUMBER,
    },
    required: ["name", "quantity", "unit", "grams", "uncertain", "cookingFat", "protein", "kcal", "carbs", "fat"],
  },
};

const PHOTO_SCHEMA = {
  type: "OBJECT",
  properties: {
    kind: { type: "STRING", format: "enum", enum: ["meal", "label", "not_food"] },
    name: { type: "STRING" },
    items: ITEMS_SCHEMA,
    matchedRegularId: { type: "STRING", nullable: true },
    label: {
      type: "OBJECT",
      nullable: true,
      properties: {
        productName: { type: "STRING", nullable: true },
        servingLabel: { type: "STRING" },
        servingSize: NUMBER,
        servingUnit: { type: "STRING", format: "enum", enum: ["g", "ml"] },
        perServing: MACROS_SCHEMA,
        per100: { ...MACROS_SCHEMA, nullable: true },
      },
      required: ["servingLabel", "servingSize", "servingUnit", "perServing"],
    },
  },
  required: ["kind", "name", "items"],
};

const TEXT_SCHEMA = {
  type: "OBJECT",
  properties: { name: { type: "STRING" }, items: ITEMS_SCHEMA },
  required: ["name", "items"],
};

type RawItem = {
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  isLiquid?: boolean;
  uncertain: boolean;
  cookingFat: boolean;
} & Macros;

type RawPhoto = {
  kind: "meal" | "label" | "not_food";
  name: string;
  items: RawItem[];
  matchedRegularId?: string | null;
  label?: {
    productName?: string | null;
    servingLabel: string;
    servingSize: number;
    servingUnit: "g" | "ml";
    perServing: Macros;
    per100?: Macros | null;
  } | null;
};

const positive = (value: number, fallback: number) => (Number.isFinite(value) && value > 0 ? value : fallback);
const nonNegative = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);
const cleanMacros = (macros: Macros): Macros => ({
  protein: nonNegative(macros.protein),
  kcal: nonNegative(macros.kcal),
  carbs: nonNegative(macros.carbs),
  fat: nonNegative(macros.fat),
});

function normaliseItem(raw: RawItem): EstimatedItem {
  const quantity = positive(raw.quantity, 1);
  const unit = raw.cookingFat ? "tsp" : raw.unit.trim().toLowerCase() || "serving";
  const grams = nonNegative(raw.grams);
  return {
    name: raw.name.trim() || "Item",
    quantity,
    unit,
    gramsPerUnit: grams > 0 ? grams / quantity : undefined,
    weightUnit: raw.isLiquid ? "ml" : "g",
    uncertain: raw.uncertain || undefined,
    cookingFat: raw.cookingFat || undefined,
    macros: cleanMacros(raw),
  };
}

async function generate<T>(parts: unknown[], schema: unknown): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AnalysisError("not_configured", "GEMINI_API_KEY is not set");

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
    }),
  });

  if (response.status === 429) throw new AnalysisError("quota", "The free Gemini quota is used up for now");
  if (!response.ok) {
    throw new AnalysisError("upstream", `Gemini returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const text = ((await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
    .candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new AnalysisError("upstream", "Gemini returned no answer");
  return JSON.parse(text) as T;
}

export async function analyzePhoto(base64: string, mimeType: string, context: MealContext): Promise<Analysis> {
  const raw = await generate<RawPhoto>(
    [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: `${PHOTO_PROMPT}\n\n${contextLines(context)}` }],
    PHOTO_SCHEMA,
  );

  if (raw.kind === "label" && raw.label) {
    const { label } = raw;
    return {
      kind: "label",
      label: {
        productName: label.productName?.trim() || null,
        servingLabel: label.servingLabel.trim().toLowerCase() || "serving",
        servingSize: positive(label.servingSize, 1),
        servingUnit: label.servingUnit === "ml" ? "ml" : "g",
        perServing: cleanMacros(label.perServing),
        per100: label.per100 ? cleanMacros(label.per100) : undefined,
      },
    };
  }

  const items = raw.kind === "meal" ? raw.items.map(normaliseItem) : [];
  if (items.length === 0) throw new AnalysisError("unreadable", "No food or label found in the photo");
  const knownIds = new Set(context.regulars?.map((regular) => regular.id));
  return {
    kind: "meal",
    name: raw.name.trim() || "Meal",
    items,
    matchedRegularId: raw.matchedRegularId && knownIds.has(raw.matchedRegularId) ? raw.matchedRegularId : null,
  };
}

export async function estimateFromText(description: string, outside: boolean): Promise<{ name: string; items: EstimatedItem[] }> {
  const prompt = `${TEXT_PROMPT}\n\n${outside ? "It was eaten out: assume restaurant amounts of oil, ghee and portions." : "Assume home cooking unless the description says otherwise."}\n\nDescription: "${description}"`;
  const raw = await generate<{ name: string; items: RawItem[] }>([{ text: prompt }], TEXT_SCHEMA);
  const items = raw.items.map(normaliseItem);
  if (items.length === 0) throw new AnalysisError("unreadable", "Couldn't find food in that description");
  return { name: raw.name.trim() || "Meal", items };
}
