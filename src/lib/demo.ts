import { dayKey } from "./day";
import type { AppState, MealLog, SavedMeal } from "./types";

/**
 * Synthetic data for `/?demo`, stored under its own key so it never mixes
 * with real logs. Photos are Unsplash stock images, not the owner's meals,
 * and the macros are rough typical values for home portions.
 */

const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?w=360&h=360&fit=crop&q=70&auto=format`;

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
    macros: { protein: 38, kcal: 560, carbs: 42, fat: 22 },
    createdAt: 6,
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
function demoHistory(y: number, m: number, d: number): MealLog[] {
  const random = seeded(7);
  const history: MealLog[] = [];
  for (let back = 1; back <= HISTORY_DAYS; back++) {
    const date = new Date(y, m - 1, d - back, 21, 0);
    const roll = random();
    const onRun = back <= CURRENT_STREAK || (back >= BEST_RUN.from && back <= BEST_RUN.to);
    if (!onRun && roll < 0.12) continue;
    const ratio = onRun ? 1 + roll * 0.2 : back === CURRENT_STREAK + 1 ? 0.78 : 0.45 + roll * 0.5;
    const protein = Math.round(100 * ratio);
    history.push({
      id: `demo-history-${back}`,
      name: "Day's meals",
      macros: {
        protein,
        kcal: Math.round(1700 + random() * 500),
        carbs: Math.round(190 + random() * 80),
        fat: Math.round(45 + random() * 25),
      },
      portion: 1,
      eatenAt: date.getTime(),
      day: dayKey(date),
    });
  }
  return history.reverse();
}

export function demoState(today: string): AppState {
  const [y, m, d] = today.split("-").map(Number);
  const at = (hour: number, minute: number) => new Date(y, m - 1, d, hour, minute).getTime();
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
      ...demoHistory(y, m, d),
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
