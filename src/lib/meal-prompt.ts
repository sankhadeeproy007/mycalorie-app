import { AnalysisError } from "./analysis-error";
import type { Analysis, EstimatedItem, Macros } from "./types";

/**
 * What every AI provider is asked and how its answer is cleaned up. Shared by
 * the app and scripts/compare-models.ts, so a comparison tests exactly what
 * the app would send. No provider calls and nothing server-only here.
 */

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
For cooked dishes, list the cooking oil, ghee or butter as its own item named "Oil / ghee" with unit "tsp" and cookingFat true, and leave that fat out of the dish's own numbers. Use moderate home-cooking amounts unless the food was eaten out.
Bone-in meat and fish (tandoori chicken, chicken or mutton curry, fish fry, biryani pieces): count pieces and name the cut ("Tandoori chicken leg piece", "drumstick", "breast piece", "mutton curry piece"). Base grams and every macro on the edible meat only, never the bone: roughly a chicken leg piece or thigh is about 30% bone, a drumstick about 35%, a bone-in mutton or goat curry piece about 30%, and a whole or steak-cut fish about 40%. Boneless items (chicken tikka, boneless curry, fillets, kebabs) have no bone. If you can't tell whether pieces are bone-in, assume the dish's usual style and set uncertain to true.`;

export const PHOTO_PROMPT = `You read a photo for a personal nutrition tracker. The owner lives in India and mostly eats Indian food: home-cooked North and South Indian meals, thalis, tiffin, street food and restaurant dishes.

First decide what the photo shows:
- "meal": food. Give the meal a short name of at most four words, like "Rajma chawal", and list the items.
- "label": a nutrition facts panel on packaging. Read the exact values; do not estimate. Give the serving as printed (servingLabel such as "scoop", "bar", "serving", "glass"; servingSize; servingUnit "g" or "ml"), the values per serving, and per 100 g/ml when printed (otherwise null). Give the product name only if the brand or product name is visible, otherwise null. Leave items empty.
- "not_food": anything else.

${ITEM_RULES}`;

const TEXT_PROMPT = `You estimate nutrition from a short description of food someone in India ate, for a personal nutrition tracker. Treat stated quantities as fact and assume typical home portions for anything unstated. Give the meal a short name of at most four words.

${ITEM_RULES}`;

export function photoInstructions({ hint, outside, regulars }: MealContext): string {
  const lines = [PHOTO_PROMPT, ""];
  lines.push(
    outside
      ? "The owner says this was eaten out (restaurant, dhaba, street food or delivery): assume restaurant amounts of oil, ghee, butter and portion size."
      : "Judge from the photo whether it is home-cooked or restaurant food, and size the oil and portions accordingly.",
  );
  if (hint) lines.push(`The owner added this note, treat it as fact and only estimate what it leaves out: "${hint}"`);
  if (regulars?.length) {
    lines.push(
      "The owner's saved regular meals are listed below. If the photo is clearly one of them, set matchedRegularId to its id; otherwise null.",
      ...regulars.map((regular) => `- id ${regular.id}: ${regular.name} (${regular.summary}; ${regular.protein} g protein)`),
    );
  } else {
    lines.push("Set matchedRegularId to null.");
  }
  return lines.join("\n");
}

export function textInstructions(description: string, outside: boolean): string {
  const setting = outside
    ? "It was eaten out: assume restaurant amounts of oil, ghee and portions."
    : "Assume home cooking unless the description says otherwise.";
  return `${TEXT_PROMPT}\n\n${setting}\n\nDescription: "${description}"`;
}

/* Answer shape, as standard JSON Schema. Every object is closed and every field required (nullable where optional), which both Gemini and Claude accept. */

type JsonSchema = Record<string, unknown>;

const object = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const NUMBER: JsonSchema = { type: "number" };
const STRING: JsonSchema = { type: "string" };
const BOOLEAN: JsonSchema = { type: "boolean" };
const nullable = (schema: JsonSchema): JsonSchema => ({ ...schema, type: [schema.type, "null"] });

const MACROS = object({ protein: NUMBER, kcal: NUMBER, carbs: NUMBER, fat: NUMBER });

const ITEMS: JsonSchema = {
  type: "array",
  items: object({
    name: STRING,
    quantity: NUMBER,
    unit: STRING,
    grams: NUMBER,
    isLiquid: BOOLEAN,
    uncertain: BOOLEAN,
    cookingFat: BOOLEAN,
    protein: NUMBER,
    kcal: NUMBER,
    carbs: NUMBER,
    fat: NUMBER,
  }),
};

export const PHOTO_SCHEMA = object({
  kind: { type: "string", enum: ["meal", "label", "not_food"] },
  name: STRING,
  items: ITEMS,
  matchedRegularId: nullable(STRING),
  label: nullable(
    object({
      productName: nullable(STRING),
      servingLabel: STRING,
      servingSize: NUMBER,
      servingUnit: { type: "string", enum: ["g", "ml"] },
      perServing: MACROS,
      per100: nullable(MACROS),
    }),
  ),
});

export const TEXT_SCHEMA = object({ name: STRING, items: ITEMS });

/** Gemini's responseSchema dialect: upper-case types and `nullable` instead of a type list. */
export function toGeminiSchema(schema: JsonSchema): JsonSchema {
  const types = Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string];
  const type = types.find((entry) => entry !== "null")!;
  const converted: JsonSchema = { type: type.toUpperCase() };
  if (types.includes("null")) converted.nullable = true;
  if (schema.enum) Object.assign(converted, { format: "enum", enum: schema.enum });
  if (schema.items) converted.items = toGeminiSchema(schema.items as JsonSchema);
  if (schema.properties) {
    converted.properties = Object.fromEntries(
      Object.entries(schema.properties as Record<string, JsonSchema>).map(([key, value]) => [key, toGeminiSchema(value)]),
    );
    converted.required = schema.required;
  }
  return converted;
}

/* Cleaning up an answer. */

type RawItem = {
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  isLiquid?: boolean;
  uncertain: boolean;
  cookingFat: boolean;
} & Macros;

export type RawPhoto = {
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

export type RawText = { name: string; items: RawItem[] };

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

export function interpretPhoto(raw: RawPhoto, context: MealContext): Analysis {
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

export function interpretText(raw: RawText): { name: string; items: EstimatedItem[] } {
  const items = raw.items.map(normaliseItem);
  if (items.length === 0) throw new AnalysisError("unreadable", "Couldn't find food in that description");
  return { name: raw.name.trim() || "Meal", items };
}
