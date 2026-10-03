/** Indian digit grouping (1,00,000), which matches the owner's locale. */
export function formatAmount(value: number): string {
  return value.toLocaleString("en-IN");
}
