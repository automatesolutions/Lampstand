import { BOOKS, bookIndex } from "./books";
import type { Book } from "./types";

// Six kinds of book, each with one manuscript pigment (DESIGN.md §2).
export interface BookKind {
  id: "law" | "history" | "poetry" | "prophets" | "gospels" | "letters";
  name: string;
  /** CSS custom property holding the pigment. */
  pigment: string;
  from: string;
  to: string;
}

export const KINDS: readonly BookKind[] = [
  { id: "law", name: "Law", pigment: "var(--pg-law)", from: "GEN", to: "DEU" },
  { id: "history", name: "History", pigment: "var(--pg-history)", from: "JOS", to: "EST" },
  { id: "poetry", name: "Poetry and Wisdom", pigment: "var(--pg-poetry)", from: "JOB", to: "SNG" },
  { id: "prophets", name: "Prophets", pigment: "var(--pg-prophets)", from: "ISA", to: "MAL" },
  { id: "gospels", name: "Gospels and Acts", pigment: "var(--pg-gospels)", from: "MAT", to: "ACT" },
  { id: "letters", name: "Letters and Revelation", pigment: "var(--pg-letters)", from: "ROM", to: "REV" },
];

export function kindOf(code: string): BookKind {
  const i = bookIndex(code);
  return KINDS.find((k) => i >= bookIndex(k.from) && i <= bookIndex(k.to)) ?? KINDS[0];
}

export function booksOfKind(kind: BookKind): Book[] {
  return BOOKS.slice(bookIndex(kind.from), bookIndex(kind.to) + 1);
}
