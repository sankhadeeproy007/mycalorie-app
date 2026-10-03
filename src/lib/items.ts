import { ZERO_MACROS, type EstimatedItem, type Macros, type MealItem, type SavedMeal } from "./types";

/** Step sizes agreed with the owner: halves for anything counted or ladled, ½ tsp for fat, 25 by weight. */
const COUNT_STEP = 0.5;
const FAT_STEP = 0.5;
const WEIGHT_STEP = 25;
const WEIGHT_UNITS = new Set(["g", "gram", "grams", "ml"]);

export const isWeightUnit = (unit: string) => WEIGHT_UNITS.has(unit.toLowerCase());

export function stepFor(item: MealItem, byWeight: boolean): number {
  if (byWeight || isWeightUnit(item.unit)) return WEIGHT_STEP;
  return item.cookingFat ? FAT_STEP : COUNT_STEP;
}

export function scaleMacros(macros: Macros, factor: number): Macros {
  return {
    protein: macros.protein * factor,
    kcal: macros.kcal * factor,
    carbs: macros.carbs * factor,
    fat: macros.fat * factor,
  };
}

export function roundMacros(macros: Macros): Macros {
  return {
    protein: Math.round(macros.protein),
    kcal: Math.round(macros.kcal),
    carbs: Math.round(macros.carbs),
    fat: Math.round(macros.fat),
  };
}

/** An item's macros at its current quantity, unrounded so totals round once. */
export function itemMacros(item: MealItem): Macros {
  if (item.baseQuantity <= 0) return ZERO_MACROS;
  return scaleMacros(item.baseMacros, item.quantity / item.baseQuantity);
}

export function totalMacros(items: MealItem[]): Macros {
  const sum = items.reduce(
    (total, item) => {
      const macros = itemMacros(item);
      return {
        protein: total.protein + macros.protein,
        kcal: total.kcal + macros.kcal,
        carbs: total.carbs + macros.carbs,
        fat: total.fat + macros.fat,
      };
    },
    ZERO_MACROS,
  );
  return roundMacros(sum);
}

const newId = () => crypto.randomUUID();

export function fromEstimate(estimate: EstimatedItem): MealItem {
  const { macros, ...rest } = estimate;
  return { ...rest, id: newId(), baseQuantity: estimate.quantity, baseMacros: macros };
}

/** The items a regular contributes: a product as one serving, a meal as its saved items, an old regular as one portion. */
export function itemsFromRegular(regular: SavedMeal): MealItem[] {
  if (regular.product) {
    return [
      {
        id: newId(),
        name: regular.name,
        quantity: 1,
        unit: regular.product.servingLabel,
        baseQuantity: 1,
        baseMacros: regular.macros,
        gramsPerUnit: regular.product.servingSize,
        weightUnit: regular.product.servingUnit,
        sourceId: regular.id,
      },
    ];
  }
  if (regular.items?.length) return regular.items.map((item) => ({ ...item, id: newId() }));
  return [
    {
      id: newId(),
      name: regular.name,
      quantity: 1,
      unit: "portion",
      baseQuantity: 1,
      baseMacros: regular.macros,
      sourceId: regular.id,
    },
  ];
}

export function scaleItems(items: MealItem[], factor: number): MealItem[] {
  return items.map((item) => ({ ...item, quantity: item.quantity * factor }));
}

const FRACTIONS: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

/** 1.5 → "1½", 0.5 → "½", 150 → "150". */
export function formatQuantity(value: number): string {
  const whole = Math.floor(value);
  const fraction = Math.round((value - whole) * 100) / 100;
  if (fraction === 0) return String(whole);
  const glyph = FRACTIONS[fraction];
  if (glyph) return whole === 0 ? glyph : `${whole}${glyph}`;
  return value.toFixed(1);
}

/** "2 rotis" reads better than "2 roti"; units the AI already pluralised stay as they are. */
export function formatUnit(unit: string, quantity: number): string {
  if (isWeightUnit(unit) || quantity <= 1 || unit.endsWith("s") || unit === "tsp" || unit === "tbsp") return unit;
  return `${unit}s`;
}
