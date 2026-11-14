import { bookByCode } from "@/lib/bible/books";
import { kjvLocal } from "@/lib/bible/providers/kjv-local";
import { MAX_BATCH_RANGES, MAX_BATCH_VERSES, MAX_RANGE_VERSES, rangeKey, type VerseRange } from "@/lib/bible/verse-batch";

// Many KJV verses (public domain) in one request, for Notes: the text of every highlight
// on the page at once, instead of one request per verse. KJV only, so licensed text is
// never copied. Capped (200 ranges, 10 verses each, 1,000 in all) so it can't be used to
// pull down the whole Bible in one go.
//
// Body: { "ranges": [{ "book": "JHN", "chapter": 3, "verseStart": 16, "verseEnd": 17 }, ...] }
// Answer: { "texts": { "JHN.3.16-17": "For God so loved ... everlasting life.", ... } }
// A range that doesn't exist answers null rather than failing the whole request.

const bad = (error: string) => Response.json({ error }, { status: 400 });

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { ranges?: unknown } | null;
  const raw = body?.ranges;
  if (!Array.isArray(raw) || raw.length === 0) return bad("Send the verses as ranges.");
  if (raw.length > MAX_BATCH_RANGES) return bad(`At most ${MAX_BATCH_RANGES} ranges at a time.`);

  const ranges: VerseRange[] = [];
  let verses = 0;
  for (const r of raw as Partial<VerseRange>[]) {
    const meta = bookByCode(String(r?.book ?? "").toUpperCase());
    const chapter = Number(r?.chapter);
    const verseStart = Number(r?.verseStart);
    const verseEnd = Number(r?.verseEnd ?? r?.verseStart);
    if (!meta || ![chapter, verseStart, verseEnd].every(Number.isInteger) || chapter < 1 || chapter > meta.chapters || verseStart < 1 || verseEnd < verseStart) {
      return bad("One of the verses isn't a real reference.");
    }
    const end = Math.min(verseEnd, verseStart + MAX_RANGE_VERSES - 1); // Notes shows at most 10 verses of a range
    verses += end - verseStart + 1;
    ranges.push({ book: meta.code, chapter, verseStart, verseEnd: end });
  }
  if (verses > MAX_BATCH_VERSES) return bad(`At most ${MAX_BATCH_VERSES} verses at a time.`);

  const texts: Record<string, string | null> = {};
  for (const r of ranges) {
    const chapter = await kjvLocal.chapter({ book: r.book, chapter: r.chapter });
    const words = (chapter?.verses ?? []).filter((v) => v.number >= r.verseStart && v.number <= r.verseEnd && v.text).map((v) => v.text);
    texts[rangeKey(r)] = words.length ? words.join(" ") : null;
  }
  return Response.json({ texts }, { headers: { "Cache-Control": "no-store" } });
}
