import { kjvLocal } from "@/lib/bible/providers/kjv-local";
import { bookByCode } from "@/lib/bible/books";

// One KJV verse (public domain), for verse cards shared in Circle chat. KJV only, so
// licensed text is never copied into messages.
export async function GET(_req: Request, ctx: RouteContext<"/api/verse/[book]/[chapter]/[verse]">) {
  const { book, chapter, verse } = await ctx.params;
  const meta = bookByCode(book.toUpperCase());
  const c = Number(chapter);
  const v = Number(verse);
  if (!meta || !Number.isInteger(c) || !Number.isInteger(v)) return Response.json({ error: "Not found" }, { status: 404 });
  const data = await kjvLocal.chapter({ book: meta.code, chapter: c });
  const text = data?.verses.find((x) => x.number === v)?.text;
  if (!text) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ref: `${meta.name} ${c}:${v}`, text }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
