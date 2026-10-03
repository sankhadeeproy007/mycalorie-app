import "server-only";
import type { Analysis, EstimatedItem } from "./types";

/** Canned answers for MOCK_GEMINI=1 in development. Not real estimates. */

const item = (fields: Partial<EstimatedItem> & Pick<EstimatedItem, "name" | "quantity" | "unit" | "macros">): EstimatedItem => ({
  weightUnit: "g",
  ...fields,
});

export function mockPhotoAnalysis(hint: string): Analysis {
  if (hint.toLowerCase().includes("label")) {
    return {
      kind: "label",
      label: {
        productName: null,
        servingLabel: "scoop",
        servingSize: 33,
        servingUnit: "g",
        perServing: { protein: 24, kcal: 130, carbs: 3, fat: 2 },
        per100: { protein: 72.7, kcal: 394, carbs: 9.1, fat: 6.1 },
      },
    };
  }
  return {
    kind: "meal",
    name: "Masala omelette, toast",
    matchedRegularId: null,
    items: [
      item({ name: "Masala omelette", quantity: 2, unit: "egg", gramsPerUnit: 60, uncertain: true, macros: { protein: 12.6, kcal: 160, carbs: 3, fat: 10 } }),
      item({ name: "Oil / ghee", quantity: 1, unit: "tsp", gramsPerUnit: 4.5, cookingFat: true, macros: { protein: 0, kcal: 40, carbs: 0, fat: 4.5 } }),
      item({ name: "Brown bread toast", quantity: 2, unit: "slice", gramsPerUnit: 28, macros: { protein: 6, kcal: 150, carbs: 26, fat: 2 } }),
      item({ name: "Green chutney", quantity: 1, unit: "tbsp", gramsPerUnit: 15, macros: { protein: 0.5, kcal: 15, carbs: 2, fat: 0.5 } }),
    ],
  };
}

export function mockTextEstimate(description: string): { name: string; items: EstimatedItem[] } {
  const words = description.replace(/^\d+\s*/, "");
  const name = words.charAt(0).toUpperCase() + words.slice(1) || "Gulab jamun";
  return {
    name,
    items: [item({ name, quantity: 1, unit: "piece", gramsPerUnit: 40, macros: { protein: 2, kcal: 150, carbs: 22, fat: 6 } })],
  };
}
