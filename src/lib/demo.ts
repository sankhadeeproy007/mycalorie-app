import { dayKey } from "./day";
import type { AppState, Macros, MealItem, MealLog, SavedMeal } from "./types";

/**
 * Synthetic data for `/?demo`, stored under its own key so it never mixes
 * with real logs. Photos are Unsplash stock images, not the owner's meals,
 * and the macros are rough typical values for home portions.
 */

const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?w=360&h=360&fit=crop&q=70&auto=format`;

const demoItem = (id: string, name: string, quantity: number, unit: string, macros: Macros, extra: Partial<MealItem> = {}): MealItem => ({
  id,
  name,
  quantity,
  unit,
  baseQuantity: quantity,
  baseMacros: macros,
  ...extra,
});

const DEMO_MEALS: SavedMeal[] = [
  {
    id: "demo-idli",
    name: "Idli sambar",
    photo: unsplash("photo-1741376509047-66dae5df90f9"),
    macros: { protein: 13, kcal: 330, carbs: 60, fat: 4 },
    createdAt: 1,
  },
  {
    id: "demo-dosa",
    name: "Masala dosa",
    photo: unsplash("photo-1668236543090-82eba5ee5976"),
    macros: { protein: 9, kcal: 410, carbs: 58, fat: 16 },
    createdAt: 2,
  },
  {
    id: "demo-thali",
    name: "Dal, rice, roti thali",
    photo: unsplash("photo-1680993032090-1ef7ea9b51e5"),
    macros: { protein: 22, kcal: 720, carbs: 105, fat: 22 },
    createdAt: 3,
  },
  {
    id: "demo-chicken-rice",
    name: "Chicken curry rice",
    photo: unsplash("photo-1742599361539-f096753d1100"),
    macros: { protein: 36, kcal: 530, carbs: 54, fat: 19 },
    createdAt: 4,
  },
  {
    id: "demo-paneer",
    name: "Paneer butter masala, 2 roti",
    photo: unsplash("photo-1631452180519-c014fe946bc7"),
    macros: { protein: 21, kcal: 590, carbs: 54, fat: 33 },
    createdAt: 5,
  },
  {
    id: "demo-chicken-roti",
    name: "Chicken curry, 2 roti",
    photo: unsplash("photo-1708782344490-9026aaa5eec7"),
    macros: { protein: 38, kcal: 600, carbs: 42, fat: 22 },
    items: [
      demoItem("demo-i1", "Chicken curry", 1, "katori", { protein: 31, kcal: 290, carbs: 6, fat: 11 }, { gramsPerUnit: 180 }),
      demoItem("demo-i2", "Roti", 2, "roti", { protein: 7, kcal: 230, carbs: 36, fat: 2 }, { gramsPerUnit: 38 }),
      demoItem("demo-i3", "Oil / ghee", 2, "tsp", { protein: 0, kcal: 80, carbs: 0, fat: 9 }, { cookingFat: true, gramsPerUnit: 4.5 }),
    ],
    createdAt: 6,
  },
  {
    id: "demo-whey",
    name: "Whey protein",
    macros: { protein: 24, kcal: 130, carbs: 3, fat: 2 },
    product: { servingLabel: "scoop", servingSize: 33, servingUnit: "g", per100: { protein: 72.7, kcal: 394, carbs: 9.1, fat: 6.1 } },
    createdAt: 7,
  },
];

const HISTORY_DAYS = 83;
const CURRENT_STREAK = 18;
const BEST_RUN = { from: 30, to: 55 };

/** A repeatable pseudo-random sequence, so the demo graph looks the same on every load. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

/** One summary entry per past day: a recent 18-day streak, a best run of 26 and a patchy rest. */
/* Past days: three or four real meals each, built from typical Indian meals with their items. */

type Slot = "breakfast" | "lunch" | "snack" | "dinner";

type MealTemplate = {
  key: string;
  name: string;
  slot: Slot;
  /** Linked regular, so shelf ordering learns from history like real use would. */
  regularId?: string;
  items: [name: string, quantity: number, unit: string, macros: Macros, extra?: Partial<MealItem>][];
};

const m = (protein: number, kcal: number, carbs: number, fat: number): Macros => ({ protein, kcal, carbs, fat });
const OIL = (tsp: number): [string, number, string, Macros, Partial<MealItem>] => [
  "Oil / ghee",
  tsp,
  "tsp",
  m(0, 40 * tsp, 0, 4.5 * tsp),
  { cookingFat: true, gramsPerUnit: 4.5 },
];
const ROTI: [string, number, string, Macros, Partial<MealItem>] = ["Roti", 2, "roti", m(7, 230, 36, 2), { gramsPerUnit: 38 }];

const TEMPLATES: MealTemplate[] = [
  { key: "idli", name: "Idli sambar", slot: "breakfast", regularId: "demo-idli",
    items: [["Idli", 4, "idli", m(8, 230, 48, 1), { gramsPerUnit: 40 }], ["Sambar", 1, "katori", m(5, 100, 12, 3), { gramsPerUnit: 150, weightUnit: "ml" }]] },
  { key: "bhurji", name: "Egg bhurji, toast", slot: "breakfast",
    items: [["Egg bhurji", 3, "egg", m(19, 210, 2, 15), { gramsPerUnit: 55 }], OIL(1), ["Brown bread toast", 2, "slice", m(6, 150, 26, 2), { gramsPerUnit: 28 }]] },
  { key: "poha", name: "Poha, chai", slot: "breakfast",
    items: [["Poha", 1, "plate", m(6, 270, 45, 7), { gramsPerUnit: 180 }], ["Masala chai", 1, "cup", m(3, 90, 11, 3), { gramsPerUnit: 150, weightUnit: "ml" }]] },
  { key: "dosa", name: "Masala dosa", slot: "breakfast",
    items: [["Masala dosa", 1, "dosa", m(6, 300, 44, 11), { gramsPerUnit: 180 }], ["Sambar", 1, "katori", m(5, 100, 12, 3), { gramsPerUnit: 150, weightUnit: "ml" }]] },
  { key: "chicken-rice", name: "Chicken curry rice", slot: "lunch", regularId: "demo-chicken-rice",
    items: [["Chicken curry", 1, "katori", m(31, 280, 8, 13), { gramsPerUnit: 180 }], ["Steamed rice", 1, "cup", m(5, 210, 46, 1), { gramsPerUnit: 160 }], OIL(1.5)] },
  { key: "thali", name: "Dal, rice, roti thali", slot: "lunch", regularId: "demo-thali",
    items: [["Dal tadka", 1, "katori", m(9, 180, 24, 5), { gramsPerUnit: 150 }], ["Jeera rice", 1, "cup", m(4, 220, 42, 4), { gramsPerUnit: 160 }], ROTI, ["Aloo gobi", 1, "katori", m(3, 130, 14, 7), { gramsPerUnit: 120 }], OIL(1)] },
  { key: "rajma", name: "Rajma chawal", slot: "lunch",
    items: [["Rajma", 1, "katori", m(10, 210, 30, 5), { gramsPerUnit: 150 }], ["Steamed rice", 1, "cup", m(5, 210, 46, 1), { gramsPerUnit: 160 }], OIL(1)] },
  { key: "sprouts", name: "Moong sprouts chaat", slot: "snack",
    items: [["Moong sprouts chaat", 1, "katori", m(14, 210, 30, 4), { gramsPerUnit: 150 }]] },
  { key: "whey", name: "Whey shake", slot: "snack",
    items: [["Whey protein", 1, "scoop", m(24, 130, 3, 2), { gramsPerUnit: 33, sourceId: "demo-whey" }], ["Milk", 200, "ml", m(6.5, 130, 10, 7)]] },
  { key: "chana", name: "Roasted chana", slot: "snack",
    items: [["Roasted chana", 40, "g", m(8, 150, 23, 2)]] },
  { key: "dahi", name: "Dahi, banana", slot: "snack",
    items: [["Dahi", 1, "katori", m(6, 90, 7, 4), { gramsPerUnit: 150 }], ["Banana", 1, "piece", m(1, 105, 27, 0.4), { gramsPerUnit: 118 }]] },
  { key: "chicken-roti", name: "Chicken curry, 2 roti", slot: "dinner", regularId: "demo-chicken-roti",
    items: [["Chicken curry", 1, "katori", m(31, 290, 6, 11), { gramsPerUnit: 180 }], ROTI, OIL(2)] },
  { key: "paneer", name: "Paneer butter masala, 2 roti", slot: "dinner", regularId: "demo-paneer",
    items: [["Paneer butter masala", 1, "katori", m(14, 320, 12, 24), { gramsPerUnit: 150 }], ROTI, OIL(1)] },
  { key: "egg-curry", name: "Egg curry, 2 roti", slot: "dinner",
    items: [["Egg curry", 2, "egg", m(13, 220, 8, 15), { gramsPerUnit: 90 }], ROTI] },
  { key: "khichdi", name: "Dal khichdi", slot: "dinner",
    items: [["Dal khichdi", 1, "plate", m(12, 350, 55, 8), { gramsPerUnit: 300 }], OIL(1)] },
];

/** The higher-protein choice for each slot, used to lift a streak day over the target. */
const PROTEIN_UPGRADE: Record<Slot, string> = { breakfast: "bhurji", lunch: "chicken-rice", snack: "whey", dinner: "chicken-roti" };
/** The lighter choice for each slot, used to keep a non-streak day under the target. */
const PROTEIN_DOWNGRADE: Record<Slot, string> = { breakfast: "poha", lunch: "rajma", snack: "dahi", dinner: "khichdi" };

const SLOT_TIMES: Record<Slot, [hour: number, minute: number]> = { breakfast: [8, 15], lunch: [13, 20], snack: [17, 10], dinner: [20, 45] };
const SLOTS: Slot[] = ["breakfast", "lunch", "snack", "dinner"];
const DEMO_PROTEIN_TARGET = 100;

const template = (key: string) => TEMPLATES.find((entry) => entry.key === key)!;
const proteinOf = (keys: string[]) =>
  keys.reduce((sum, key) => sum + template(key).items.reduce((total, [, , , macros]) => total + macros.protein, 0), 0);

function mealLog(meal: MealTemplate, id: string, at: Date): MealLog {
  const items = meal.items.map(([name, quantity, unit, macros, extra], index) =>
    demoItem(`${id}-${index}`, name, quantity, unit, macros, extra),
  );
  const total = items.reduce(
    (sum, item) => ({
      protein: sum.protein + item.baseMacros.protein,
      kcal: sum.kcal + item.baseMacros.kcal,
      carbs: sum.carbs + item.baseMacros.carbs,
      fat: sum.fat + item.baseMacros.fat,
    }),
    m(0, 0, 0, 0),
  );
  return {
    id,
    name: meal.name,
    macros: { protein: Math.round(total.protein), kcal: Math.round(total.kcal), carbs: Math.round(total.carbs), fat: Math.round(total.fat) },
    portion: 1,
    eatenAt: at.getTime(),
    day: dayKey(at),
    savedMealId: meal.regularId,
    items,
  };
}

/** A recent 18-day streak, a best run of 26, and a patchy rest; most days skip the snack. */
function demoHistory(y: number, mo: number, d: number): MealLog[] {
  const random = seeded(7);
  const pick = <T,>(options: T[]) => options[Math.floor(random() * options.length)];
  const history: MealLog[] = [];

  for (let back = HISTORY_DAYS; back >= 1; back--) {
    const onRun = back <= CURRENT_STREAK || (back >= BEST_RUN.from && back <= BEST_RUN.to);
    if (!onRun && random() < 0.12) continue;

    const slots = SLOTS.filter((slot) => slot !== "snack" || onRun || random() < 0.5);
    const meals: Partial<Record<Slot, string>> = Object.fromEntries(
      slots.map((slot) => [slot, pick(TEMPLATES.filter((entry) => entry.slot === slot)).key]),
    );
    const keys = () => Object.values(meals) as string[];

    // Streak days must reach the target, the rest must not; swap meals one slot at a time, in a random order, until true.
    const swapOrder = [...SLOTS].sort(() => random() - 0.5);
    for (const slot of swapOrder) {
      if (onRun && proteinOf(keys()) >= DEMO_PROTEIN_TARGET) break;
      if (!onRun && proteinOf(keys()) < DEMO_PROTEIN_TARGET) break;
      if (onRun) meals[slot] = PROTEIN_UPGRADE[slot];
      else if (meals[slot]) meals[slot] = PROTEIN_DOWNGRADE[slot];
    }
    if (onRun && proteinOf(keys()) < DEMO_PROTEIN_TARGET) meals.snack = "whey";

    for (const slot of SLOTS) {
      const key = meals[slot];
      if (!key) continue;
      const [hour, minute] = SLOT_TIMES[slot];
      const at = new Date(y, mo - 1, d - back, hour, minute + Math.floor(random() * 40));
      history.push(mealLog(template(key), `demo-history-${back}-${slot}`, at));
    }
  }
  return history;
}

export function demoState(today: string): AppState {
  const [y, mo, d] = today.split("-").map(Number);
  const at = (hour: number, minute: number) => new Date(y, mo - 1, d, hour, minute).getTime();
  const meal = (id: string) => DEMO_MEALS.find((entry) => entry.id === id)!;
  const fromShelf = (id: string, logId: string, hour: number, minute: number) => ({
    id: logId,
    name: meal(id).name,
    macros: meal(id).macros,
    portion: 1,
    eatenAt: at(hour, minute),
    day: today,
    savedMealId: id,
  });

  return {
    settings: { targets: { protein: 100, kcal: 2000, carbs: 240, fat: 60 } },
    saved: DEMO_MEALS,
    logs: [
      ...demoHistory(y, mo, d),
      fromShelf("demo-idli", "demo-log-1", 8, 15),
      {
        id: "demo-log-2",
        name: "Moong sprouts chaat",
        macros: { protein: 14, kcal: 210, carbs: 30, fat: 4 },
        portion: 1,
        eatenAt: at(11, 10),
        day: today,
      },
      fromShelf("demo-chicken-rice", "demo-log-3", 13, 30),
    ],
  };
}
