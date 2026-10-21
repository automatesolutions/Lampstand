import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife, cacheTag } from "next/cache";
import type { ChapterRef } from "@/lib/bible/types";

// Pre-written "In depth" explanations (scripts/generate-explanations.mts), and the
// chapter inputs the live fallback needs.

export interface SavedExplanation {
  status: "draft" | "reviewed";
  text: string;
  model: string;
  generatedAt: string;
  reviewedBy?: string;
}

/** Cache tag for one book's explanations; the review page clears it after a change. */
export const explanationsTag = (code: string) => `explanations:${code}`;

async function loadBook(code: string): Promise<Record<string, SavedExplanation>> {
  "use cache";
  cacheLife("hours");
  cacheTag(explanationsTag(code));
  try {
    return JSON.parse(await readFile(join(process.cwd(), "content", "explanations", `${code}.json`), "utf8")).chapters ?? {};
  } catch {
    return {};
  }
}

export async function savedExplanation({ book, chapter }: ChapterRef): Promise<SavedExplanation | null> {
  return (await loadBook(book))[String(chapter)] ?? null;
}

async function loadXrefs(code: string): Promise<[number, string, number][][]> {
  "use cache";
  cacheLife("max");
  try {
    return JSON.parse(await readFile(join(process.cwd(), "content", "xrefs", `${code}.json`), "utf8")).chapters;
  } catch {
    return [];
  }
}

export async function chapterXrefs({ book, chapter }: ChapterRef) {
  return (await loadXrefs(book))[chapter - 1] ?? [];
}
