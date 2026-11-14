import { BOOKS, bookByCode, bookIndex } from "./books";
import type { ChapterRef, VersionId } from "./types";
import { listNames } from "@/lib/list";
import { versionSlug } from "./provider";

export function chapterKey({ book, chapter }: ChapterRef): string {
  return `${book}.${chapter}`;
}

export function formatRef(ref: ChapterRef & { verse?: number; verseEnd?: number }): string {
  const name = bookByCode(ref.book)?.name ?? ref.book;
  if (ref.verse == null) return `${name} ${ref.chapter}`;
  if (ref.verseEnd != null && ref.verseEnd !== ref.verse) return `${name} ${ref.chapter}:${ref.verse}–${ref.verseEnd}`;
  return `${name} ${ref.chapter}:${ref.verse}`;
}

/** The reader at a chapter; with a verse (or verses) it opens with them selected (#v16, #v16-18). */
export function readerHref(version: VersionId, ref: ChapterRef, verse?: number, verseEnd?: number): string {
  const slug = bookByCode(ref.book)?.slug ?? ref.book.toLowerCase();
  const hash = verse ? `#v${verse}${verseEnd && verseEnd > verse ? `-${verseEnd}` : ""}` : "";
  return `/read/${versionSlug(version)}/${slug}/${ref.chapter}${hash}`;
}

export function nextChapter(ref: ChapterRef): ChapterRef | null {
  const book = bookByCode(ref.book);
  if (!book) return null;
  if (ref.chapter < book.chapters) return { book: ref.book, chapter: ref.chapter + 1 };
  const next = BOOKS[bookIndex(ref.book) + 1];
  return next ? { book: next.code, chapter: 1 } : null;
}

export function prevChapter(ref: ChapterRef): ChapterRef | null {
  if (ref.chapter > 1) return { book: ref.book, chapter: ref.chapter - 1 };
  const prev = BOOKS[bookIndex(ref.book) - 1];
  return prev ? { book: prev.code, chapter: prev.chapters } : null;
}

/** Every chapter from `from` to `to`, inclusive, in canon order. */
export function chapterRange(from: ChapterRef, to: ChapterRef): ChapterRef[] {
  const out: ChapterRef[] = [];
  let cur: ChapterRef | null = from;
  while (cur) {
    out.push(cur);
    if (cur.book === to.book && cur.chapter === to.chapter) break;
    cur = nextChapter(cur);
  }
  return out;
}

/**
 * Chapters as a sentence list with the Oxford comma (DESIGN.md §9):
 * "John 3", "John 3 and John 2", "John 3, John 2, and John 1".
 */
export function listChapters(refs: ChapterRef[]): string {
  return listNames(refs.map((r) => formatRef(r)));
}
