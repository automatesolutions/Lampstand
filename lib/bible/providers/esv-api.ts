import "server-only";
import type { BibleProvider } from "../provider";
import type { Chapter, ChapterRef, Verse } from "../types";
import { bookByCode } from "../books";

// English Standard Version from Crossway's ESV API (api.esv.org/docs/passage-text/).
// Terms: non-commercial; 5,000 queries a day, 1,000 an hour, 60 a minute; and no more
// than 500 verses stored at once. So chapters are kept in a small in-memory cache that
// never holds more than 500 verses, not in the long-lived Next.js cache.

const ENDPOINT = "https://api.esv.org/v3/passage/text/";
const MAX_CACHED_VERSES = 500;

const OPTIONS = new URLSearchParams({
  "include-passage-references": "false",
  "include-verse-numbers": "true",
  "include-first-verse-numbers": "true",
  "include-footnotes": "false",
  "include-footnote-body": "false",
  "include-headings": "false",
  "include-short-copyright": "false",
  "include-copyright": "false",
  "indent-poetry": "false",
  "indent-paragraphs": "0",
});

/** Verses from the API's plain text, where each verse starts with "[n]". */
export function parseEsvText(passage: string): Verse[] {
  const out = new Map<number, string>();
  // Short lines set apart by blank lines are labels, like Psalm 119's stanza letters ("Beth").
  const parts = passage.replace(/\n\n+[A-Za-z ]{1,20}\n\n/g, "\n\n").split(/\[(\d+)\]/);
  for (let i = 1; i < parts.length; i += 2) {
    out.set(Number(parts[i]), parts[i + 1].replace(/\s+/g, " ").trim());
  }
  if (!out.size) return [];
  // One entry per verse number so verses[n - 1] is verse n; verses the ESV leaves out
  // of the text (they are in footnotes) stay as empty entries.
  const last = Math.max(...out.keys());
  return Array.from({ length: last }, (_, i) => ({ number: i + 1, text: out.get(i + 1) ?? "" }));
}

// Least recently used first; Map keeps insertion order.
const cache = new Map<string, Verse[]>();
let cachedVerses = 0;

function remember(key: string, verses: Verse[]) {
  cache.set(key, verses);
  cachedVerses += verses.length;
  for (const [k, v] of cache) {
    if (cachedVerses <= MAX_CACHED_VERSES) break;
    cache.delete(k);
    cachedVerses -= v.length;
  }
}

function recall(key: string) {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

export const esvApi: BibleProvider = {
  id: "ESV",
  async chapter({ book, chapter }: ChapterRef): Promise<Chapter | null> {
    const meta = bookByCode(book);
    const key = process.env.ESV_API_KEY;
    if (!meta || !key || chapter < 1 || chapter > meta.chapters) return null;

    const id = `${book}.${chapter}`;
    let verses = recall(id);
    if (!verses) {
      const q = new URLSearchParams(OPTIONS);
      q.set("q", `${meta.name} ${chapter}`);
      const res = await fetch(`${ENDPOINT}?${q}`, { headers: { Authorization: `Token ${key}` }, cache: "no-store" });
      if (!res.ok) throw new Error(`ESV API ${res.status} for ${meta.name} ${chapter}`);
      const data = (await res.json()) as { passages?: string[] };
      verses = parseEsvText(data.passages?.[0] ?? "");
      if (!verses.length) throw new Error(`ESV API returned no verses for ${meta.name} ${chapter}`);
      remember(id, verses);
    }
    return { version: "ESV", book, chapter, verses };
  },
};
