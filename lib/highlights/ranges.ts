// Highlights as verse ranges (pure, so it can be tested). Shared by the reader (lib/store)
// and account sync (lib/sync/merge).
//
// Rules:
// - Highlights in a chapter never overlap. Placing one trims or splits whatever it covers,
//   so one verse always has at most one color.
// - A highlight keeps its id only while it covers exactly the same verses (so a new color
//   keeps the id, and a share of it in a Circle stays). A piece split off gets an id derived
//   from its parent's, so two devices that make the same split agree on the id.
// - A summary describes exact verses: a highlight whose verses change loses its summary,
//   and the background writer asks for a new one (cached per range for every reader).

import type { ChapterRef } from "@/lib/bible/types";
import type { Highlight, HighlightColor } from "@/lib/store";

/** Summaries are written for ranges up to this many verses (app/api/highlight-summary). */
export const MAX_SUMMARY_VERSES = 20;

export interface Span {
  start: number;
  end: number;
}

const inChapter = (h: Highlight, ref: ChapterRef) => h.book === ref.book && h.chapter === ref.chapter;
const overlaps = (h: Highlight, s: Span) => h.verseStart <= s.end && h.verseEnd >= s.start;

/** An id made from another id and a verse number: the same inputs always give the same id. */
export function derivedId(id: string, verse: number): string {
  // Two 53-bit string hashes (cyrb53), written as a UUID (version 8, "custom").
  const hash = (seed: number) => {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (const ch of `${id}:${verse}`) {
      const c = ch.codePointAt(0)!;
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
  };
  const hex = hash(1) + hash(2);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Removes the verses of `span` from every highlight in that chapter, splitting where needed. */
export function erase(list: Highlight[], ref: ChapterRef, span: Span): Highlight[] {
  const out: Highlight[] = [];
  for (const h of list) {
    if (!inChapter(h, ref) || !overlaps(h, span)) {
      out.push(h);
      continue;
    }
    // The part before keeps the id (it starts at the same verse); the part after gets a derived one.
    if (h.verseStart < span.start) out.push({ ...h, verseEnd: span.start - 1, summary: null });
    if (h.verseEnd > span.end) out.push({ ...h, id: derivedId(h.id, span.end + 1), verseStart: span.end + 1, summary: null });
  }
  return out;
}

/** Puts `h` in the list as it is, trimming or splitting anything it overlaps. */
export function place(list: Highlight[], h: Highlight): Highlight[] {
  return [...erase(list, h, { start: h.verseStart, end: h.verseEnd }).filter((x) => x.id !== h.id), h];
}

/** The highlight covering a verse, if any. */
export const highlightAt = (list: Highlight[], ref: ChapterRef, verse: number) => list.find((h) => inChapter(h, ref) && h.verseStart <= verse && h.verseEnd >= verse);

/** The one color every verse of `span` has, or null when they differ or some have none. */
export function colorOf(list: Highlight[], ref: ChapterRef, span: Span): HighlightColor | null {
  let color: HighlightColor | null = null;
  for (let v = span.start; v <= span.end; v++) {
    const c = highlightAt(list, ref, v)?.color ?? null;
    if (!c || (color && c !== color)) return null;
    color = c;
  }
  return color;
}

/**
 * What tapping a color does to the selected verses: if every one of them already has
 * that color, the color comes off them; otherwise they all get it, as one highlight.
 */
export function applyColor(list: Highlight[], ref: ChapterRef, span: Span, color: HighlightColor, now: string, newId: () => string): Highlight[] {
  if (colorOf(list, ref, span) === color) return erase(list, ref, span);
  // The same verses highlighted before: a new color keeps the id and the summary.
  const same = list.find((h) => inChapter(h, ref) && h.verseStart === span.start && h.verseEnd === span.end);
  return place(list, {
    id: same?.id ?? newId(),
    book: ref.book,
    chapter: ref.chapter,
    verseStart: span.start,
    verseEnd: span.end,
    color,
    createdAt: now,
    summary: same?.summary ?? null,
  });
}

/**
 * Settles overlaps after two devices' highlights are joined (lib/sync/merge): the newer
 * highlight wins the verses both cover, and the older one is trimmed around it.
 */
export function withoutOverlaps(list: Highlight[]): Highlight[] {
  const ordered = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  let out: Highlight[] = [];
  for (const h of ordered) out = place(out, h);
  return out;
}
