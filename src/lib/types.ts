export type Macros = {
  protein: number;
  kcal: number;
  carbs: number;
  fat: number;
};

export type SavedMeal = {
  id: string;
  name: string;
  /** Compressed JPEG data URL; only saved meals keep a photo. */
  photo?: string;
  /** Macros for one 1× portion. */
  macros: Macros;
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
};

/** Daily targets; `null` means no target set for that value. */
export type Targets = { [K in keyof Macros]: number | null };

export type Settings = {
  targets: Targets;
};

export type AppState = {
  settings: Settings;
  saved: SavedMeal[];
  logs: MealLog[];
};

export type AnalyzedItem = {
  name: string;
  /** Household measure as eaten, e.g. "2 rotis" or "1 katori". */
  portion: string;
  grams: number;
} & Macros;

export type Analysis = {
  name: string;
  items: AnalyzedItem[];
  totals: Macros;
};

export const ZERO_MACROS: Macros = { protein: 0, kcal: 0, carbs: 0, fat: 0 };

export const NO_TARGETS: Targets = { protein: null, kcal: null, carbs: null, fat: null };
