"use client";

// Any screen can open the Prayer sheet. The reader passes the chapter on screen
// so it is prayed over even before it is marked read.

import type { ChapterRef } from "@/lib/bible/types";
import type { ChapterRead } from "@/lib/store";

const OPEN_EVENT = "lampstand:pray";
export const PRAYER_CHAPTERS = 3;

export function openPrayer(current?: ChapterRef) {
  window.dispatchEvent(new CustomEvent<ChapterRef | undefined>(OPEN_EVENT, { detail: current }));
}

export function onOpenPrayer(fn: (current?: ChapterRef) => void) {
  const h = (e: Event) => fn((e as CustomEvent<ChapterRef | undefined>).detail);
  window.addEventListener(OPEN_EVENT, h);
  return () => window.removeEventListener(OPEN_EVENT, h);
}

/** The chapters to pray over: the one on screen first, then the most recently read, without repeats. */
export function recentChapters(reads: ChapterRead[], current?: ChapterRef, limit = PRAYER_CHAPTERS): ChapterRef[] {
  const out: ChapterRef[] = [];
  const add = (r: ChapterRef) => {
    if (out.length < limit && !out.some((x) => x.book === r.book && x.chapter === r.chapter)) out.push({ book: r.book, chapter: r.chapter });
  };
  if (current) add(current);
  [...reads].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).forEach(add);
  return out;
}
