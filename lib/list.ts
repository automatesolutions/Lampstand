// Lists in sentences (DESIGN.md §9).

/** Names as a sentence list with the Oxford comma: "A", "A and B", "A, B, and C". */
export function listNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
