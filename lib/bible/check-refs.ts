// Finds Bible references in generated text and checks each one against real
// chapter and verse counts, so an explanation never cites a verse that doesn't exist.

import { BOOKS } from "./books";
import verseCounts from "./verse-counts.json";
import type { ChapterRef } from "./types";

const counts = verseCounts as Record<string, number[]>;

export interface RefProblem {
  /** The text as written, e.g. "Matthew 19:40". */
  text: string;
  reason: string;
}

// Full names plus common alternatives ("Psalm 23", "Song of Songs"), longest first so
// "1 John" wins over "John".
const NAMES: [string, string][] = (
  [...BOOKS.map((b) => [b.name, b.code]), ["Psalm", "PSA"], ["Song of Songs", "SNG"], ["Song", "SNG"]] as [string, string][]
).sort((a, b) => b[0].length - a[0].length);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const DASH = "[-–—]";
const NUM = "\\d{1,3}";
// "19:4–6", "19:4–20:3", "19", "19:4, 6" - and further "; 22:2" parts that keep the book.
const PART = `${NUM}(?::${NUM}(?:${DASH}${NUM}(?::${NUM})?)?(?:,\\s?${NUM}(?:${DASH}${NUM})?)*)?`;
const BOOK_REF = new RegExp(`\\b(${NAMES.map(([n]) => esc(n)).join("|")})\\s+(${PART}(?:;\\s?${PART})*)`, "g");
// "(v. 7)", "(vv. 1–3, 8)", "verse 24", "verses 4–6" - always the chapter being explained.
const LOCAL_REF = new RegExp(`\\b(?:vv?\\.|verses?)\\s?(${NUM}(?:${DASH}${NUM})?(?:,\\s?${NUM}(?:${DASH}${NUM})?)*)`, "gi");

function checkRange(code: string, chapter: number, a: number, b: number | undefined): string | null {
  const verses = counts[code];
  if (!verses) return "unknown book";
  const n = verses[chapter - 1];
  if (!n) return `the book has ${verses.length} chapters`;
  if (a < 1 || a > n || (b !== undefined && (b < a || b > n))) return `the chapter has ${n} verses`;
  return null;
}

/** Every reference in the text that points at a chapter or verse that doesn't exist. */
export function checkRefs(text: string, current: ChapterRef): RefProblem[] {
  const problems: RefProblem[] = [];
  const add = (t: string, reason: string | null) => reason && problems.push({ text: t, reason });

  for (const m of text.matchAll(BOOK_REF)) {
    const code = NAMES.find(([n]) => n === m[1])![1];
    let lastChapter = 0;
    for (const part of m[2].split(/;\s?/)) {
      // "19:4–20:3" crosses chapters.
      const cross = part.match(new RegExp(`^(${NUM}):(${NUM})${DASH}(${NUM}):(${NUM})$`));
      if (cross) {
        add(`${m[1]} ${part}`, checkRange(code, +cross[1], +cross[2], undefined));
        add(`${m[1]} ${part}`, checkRange(code, +cross[3], +cross[4], undefined));
        continue;
      }
      const [chapterText, versesText] = part.split(":");
      const chapter = Number(chapterText) || lastChapter;
      lastChapter = chapter;
      if (!versesText) {
        const total = counts[code]?.length ?? 0;
        if (chapter < 1 || chapter > total) add(`${m[1]} ${part}`, `the book has ${total} chapters`);
        continue;
      }
      for (const piece of versesText.split(/,\s?/)) {
        const [a, b] = piece.split(new RegExp(DASH)).map(Number);
        add(`${m[1]} ${chapter}:${piece}`, checkRange(code, chapter, a, b));
      }
    }
  }

  for (const m of text.matchAll(LOCAL_REF)) {
    for (const piece of m[1].split(/,\s?/)) {
      const [a, b] = piece.split(new RegExp(DASH)).map(Number);
      add(m[0], checkRange(current.book, current.chapter, a, b));
    }
  }
  return problems;
}

/** Removes whole lines that still contain a bad reference (the last resort after asking for a fix). */
export function dropBadLines(text: string, problems: RefProblem[]): string {
  if (!problems.length) return text;
  return text
    .split("\n")
    .filter((line) => !problems.some((p) => line.includes(p.text)))
    .join("\n");
}
