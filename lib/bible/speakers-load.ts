import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import type { ChapterRef } from "./types";
import type { SpeakerBook, SpeakerSpan } from "./speakers";

// Speaker ranges for one chapter, from content/speakers/<BOOK>.json (KJV only).

async function loadBook(code: string): Promise<SpeakerBook | null> {
  "use cache";
  cacheLife("max");
  try {
    return JSON.parse(await readFile(join(process.cwd(), "content", "speakers", `${code}.json`), "utf8"));
  } catch {
    return null; // no speech marked in this book (yet)
  }
}

/** verse -> spans for this chapter, or null when nothing is marked. */
export async function chapterSpeakers({ book, chapter }: ChapterRef): Promise<Record<number, SpeakerSpan[]> | null> {
  const data = await loadBook(book);
  const c = data?.chapters[String(chapter)];
  return c && Object.keys(c).length ? Object.fromEntries(Object.entries(c).map(([v, s]) => [Number(v), s])) : null;
}
