import "server-only";
import { cacheLife } from "next/cache";
import type { BibleProvider } from "../provider";
import type { Chapter, ChapterRef, Verse } from "../types";
import { bookByCode } from "../books";

// New Living Translation from Tyndale's NLT API (api.nlt.to). Key-based terms:
// at most 500 verses per request and 5,000 requests a day, non-commercial.
// One chapter is one request, and each chapter is cached so repeat reads are free.

const ENDPOINT = "https://api.nlt.to/api/passages";

// The API wants its own names for a few books.
const NAMES: Record<string, string> = { SNG: "Song of Songs", PSA: "Psalm" };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Plain verse text from the API's HTML: no headings, verse numbers or translator notes. */
export function parseNltHtml(html: string): Verse[] {
  const out = new Map<number, string>();
  for (const m of html.matchAll(/<verse_export\b[^>]*\bvn="(\d+)(?:-\d+)?"[^>]*>([\s\S]*?)<\/verse_export>/g)) {
    const text = decode(
      m[2]
        .replace(/<h\d\b[\s\S]*?<\/h\d>/g, " ")
        .replace(/<span class="tn">(?:<span class="tn-ref">[^<]*<\/span>)?[\s\S]*?<\/span>/g, "")
        .replace(/<a class="a-tn">[\s\S]*?<\/a>/g, "")
        .replace(/<span class="vn">[^<]*<\/span>/g, "")
        .replace(/<[^>]+>/g, " "),
    )
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;:!?’”)])/g, "$1")
      .replace(/([“‘(])\s+/g, "$1")
      .trim();
    const n = Number(m[1]);
    out.set(n, out.has(n) ? `${out.get(n)} ${text}` : text);
  }
  if (!out.size) return [];
  // Keep one entry per verse number so verses[n - 1] is verse n. A verse the NLT
  // joins with its neighbor stays as an empty entry.
  const last = Math.max(...out.keys());
  return Array.from({ length: last }, (_, i) => ({ number: i + 1, text: out.get(i + 1) ?? "" }));
}

async function fetchChapter(book: string, chapter: number): Promise<Verse[] | null> {
  "use cache";
  cacheLife("days");
  const key = process.env.NLT_API_KEY;
  const meta = bookByCode(book);
  if (!key || !meta) return null;
  const ref = encodeURIComponent(`${NAMES[book] ?? meta.name} ${chapter}`);
  const res = await fetch(`${ENDPOINT}?ref=${ref}&version=NLT&key=${encodeURIComponent(key)}`);
  // Throw rather than return null so a failed request is not cached.
  if (!res.ok) throw new Error(`NLT API ${res.status} for ${meta.name} ${chapter}`);
  const verses = parseNltHtml(await res.text());
  if (!verses.length) throw new Error(`NLT API returned no verses for ${meta.name} ${chapter}`);
  return verses;
}

export const nltApi: BibleProvider = {
  id: "NLT",
  async chapter({ book, chapter }: ChapterRef): Promise<Chapter | null> {
    const meta = bookByCode(book);
    if (!meta || chapter < 1 || chapter > meta.chapters) return null;
    const verses = await fetchChapter(book, chapter);
    return verses ? { version: "NLT", book, chapter, verses } : null;
  },
};
