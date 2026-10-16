import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import type { BibleProvider } from "../provider";
import type { Chapter, ChapterRef } from "../types";
import { bookByCode } from "../books";

async function loadBook(code: string): Promise<string[][]> {
  "use cache";
  cacheLife("max");
  const file = join(process.cwd(), "content", "kjv", `${code}.json`);
  const data = JSON.parse(await readFile(file, "utf8")) as { chapters: string[][] };
  return data.chapters;
}

export const kjvLocal: BibleProvider = {
  id: "KJV",
  async chapter({ book, chapter }: ChapterRef): Promise<Chapter | null> {
    const meta = bookByCode(book);
    if (!meta || chapter < 1 || chapter > meta.chapters) return null;
    const verses = (await loadBook(book))[chapter - 1];
    if (!verses) return null;
    return {
      version: "KJV",
      book,
      chapter,
      verses: verses.map((text, i) => ({ number: i + 1, text })),
    };
  },
};
