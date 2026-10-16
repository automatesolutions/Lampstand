import { getProvider } from "@/lib/bible";
import { bookByCode } from "@/lib/bible/books";
import { versionFromSlug } from "@/lib/bible/provider";
import { chapterNote } from "@/lib/chapter-notes";

// The opening of a chapter and its "In this chapter" note, for Today's Up next card. Book is the USFM code.
export async function GET(_req: Request, ctx: RouteContext<"/api/excerpt/[version]/[book]/[chapter]">) {
  const { version, book, chapter } = await ctx.params;
  const v = versionFromSlug(version);
  const meta = bookByCode(book.toUpperCase());
  const n = Number(chapter);
  const provider = v?.available ? getProvider(v.id) : undefined;
  if (!provider || !meta || !Number.isInteger(n)) return Response.json({ error: "Not found" }, { status: 404 });

  const ref = { book: meta.code, chapter: n };
  const [data, note] = await Promise.all([provider.chapter(ref), chapterNote(ref)]);
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(
    { verses: data.verses.filter((v) => v.text).slice(0, 2).map((v) => v.text), note: note ? { title: note.title, summary: note.summary } : null },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
