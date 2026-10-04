export type Macros = {
  protein: number;
  kcal: number;
  carbs: number;
  fat: number;
};

/**
 * One line of a meal, in the unit it was eaten in ("roti", "katori", "tsp",
 * "g"). Macros scale linearly from the estimate the item started with.
 */
export type MealItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  /** The quantity `baseMacros` describe; usually the AI's original estimate. */
  baseQuantity: number;
  baseMacros: Macros;
  /** Grams (or ml) per one `unit`, when known, so the item can be shown by weight. */
  gramsPerUnit?: number;
  /** "ml" for liquids; grams otherwise. */
  weightUnit?: "g" | "ml";
  /** The AI couldn't see the quantity clearly (folded eggs, hidden rotis). */
  uncertain?: boolean;
  /** Cooking oil, ghee or butter: adjusted in teaspoons. */
  cookingFat?: boolean;
  /** Set when the item came from a saved product or regular. */
  sourceId?: string;
};

/** Serving details read from a nutrition label. */
export type ProductInfo = {
  /** What one serving is called on the pack: "scoop", "bar", "glass". */
  servingLabel: string;
  servingSize: number;
  servingUnit: "g" | "ml";
  /** Values per 100 g or 100 ml, when the label gives them. */
  per100?: Macros;
};

export type SavedMeal = {
  id: string;
  name: string;
  /** Compressed JPEG data URL; only saved meals keep a photo. */
  photo?: string;
  /** Macros for one 1× portion (one serving, for a product). */
  macros: Macros;
  /** What the regular is made of; absent on regulars saved before items existed. */
  items?: MealItem[];
  /** Present when this regular is a packaged product read from a label. */
  product?: ProductInfo;
  createdAt: number;
};

export type MealLog = {
  id: string;
  name: string;
  /** Macros as eaten, already multiplied by `portion`. */
  macros: Macros;
  portion: number;
  eatenAt: number;
  /** Local calendar day (YYYY-MM-DD) the meal counts toward. */
  day: string;
  savedMealId?: string;
  items?: MealItem[];
};

/** Daily targets; `null` means no target set for that value. */
export type Targets = { [K in keyof Macros]: number | null };

export type Settings = {
  targets: Targets;
  /** Keep each analysed photo with its estimate and the logged result, for comparing AI models. */
  keepForComparison?: boolean;
  /** Which AI reads meals first; the owner's default is Claude. Others always use Gemini. */
  readWith?: PhotoModel;
  /** When any setting last changed, so a sync merge keeps the newest settings rather than this device's. */
  changedAt?: number;
};

export type AppState = {
  settings: Settings;
  saved: SavedMeal[];
  logs: MealLog[];
};

/** An item as the AI returns it, before it gets an id. */
export type EstimatedItem = Omit<MealItem, "id" | "baseQuantity" | "baseMacros" | "sourceId"> & { macros: Macros };

export type LabelReading = {
  productName: string | null;
  perServing: Macros;
} & ProductInfo;

/** Which AI read a photo. */
export type PhotoModel = "gemini" | "claude";

export type Analysis =
  | { kind: "meal"; name: string; items: EstimatedItem[]; matchedRegularId: string | null }
  | { kind: "label"; label: LabelReading };

export const ZERO_MACROS: Macros = { protein: 0, kcal: 0, carbs: 0, fat: 0 };

export const NO_TARGETS: Targets = { protein: null, kcal: null, carbs: null, fat: null };
