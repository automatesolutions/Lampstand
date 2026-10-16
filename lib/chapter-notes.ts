import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import type { ChapterRef } from "@/lib/bible/types";

/** "In this chapter": a short explanation per chapter, from content/chapters/<BOOK>.json. */
export interface ChapterNote {
  status: "draft" | "reviewed";
  title: string;
  summary: string;
  /** A verse worth stopping on. */
  key: number;
}

async function loadBook(code: string): Promise<{ status: ChapterNote["status"]; chapters: Omit<ChapterNote, "status">[] } | null> {
  "use cache";
  cacheLife("max");
  try {
    return JSON.parse(await readFile(join(process.cwd(), "content", "chapters", `${code}.json`), "utf8"));
  } catch {
    return null;
  }
}

export async function chapterNote({ book, chapter }: ChapterRef): Promise<ChapterNote | null> {
  const data = await loadBook(book);
  const c = data?.chapters[chapter - 1];
  return c ? { status: data.status, ...c } : null;
}

