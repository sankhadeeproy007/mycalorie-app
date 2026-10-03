export const PORTIONS = [
  { factor: 0.5, label: "½" },
  { factor: 1, label: "1" },
  { factor: 1.5, label: "1½" },
  { factor: 2, label: "2" },
] as const;

export const portionLabel = (portion: number) =>
  PORTIONS.find((entry) => entry.factor === portion)?.label ?? String(portion);
