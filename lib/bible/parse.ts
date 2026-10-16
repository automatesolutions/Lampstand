import { BOOKS } from "./books";
import type { Book } from "./types";
import verseCounts from "./verse-counts.json";

export interface RefMatch {
  book: Book;
  chapter: number | null;
  verse: number | null;
}

const counts = verseCounts as Record<string, number[]>;
const norm = (s: string) => s.toLowerCase().replace(/[.\s]/g, "");

export function versesIn(book: string, chapter: number): number {
  return counts[book]?.[chapter - 1] ?? 0;
}

/**
 * Reads a reference the way people type it: "jn 3:16", "ps 23", "1cor 13", "rom".
 * A book matches when its name or short form starts with the query, or when the
 * letters appear in order with the same first letter. Starts rank first, then
 * shorter names, so "jn" is John before Jonah. Chapters and verses must exist.
 */
export function parseRef(query: string, limit = 4): RefMatch[] {
  const m = query.trim().match(/^(\d?\s*[a-z][a-z.\s]*?)\s*(\d+)?(?:\s*[:.\s]\s*(\d+))?$/i);
  if (!m) return [];
  const key = norm(m[1]);
  if (!key) return [];
  const chapter = m[2] ? Number(m[2]) : null;
  const verse = m[3] ? Number(m[3]) : null;

  const inOrder = (name: string) => {
    if (name[0] !== key[0]) return false;
    let i = 0;
    for (const c of name) if (c === key[i]) i++;
    return i === key.length;
  };
  const score = (b: Book) => {
    const name = norm(b.name);
    if (name.startsWith(key) || norm(b.short).startsWith(key)) return 2;
    return inOrder(name) ? 1 : 0;
  };

  return BOOKS.map((book) => ({ book, s: score(book) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.book.name.length - b.book.name.length)
    .map((x) => x.book)
    .filter((b) => chapter == null || (chapter >= 1 && chapter <= b.chapters))
    .filter((b) => verse == null || (chapter != null && verse >= 1 && verse <= versesIn(b.code, chapter)))
    .slice(0, limit)
    .map((book) => ({ book, chapter, verse }));
}
