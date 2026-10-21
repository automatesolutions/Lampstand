import Anthropic from "@anthropic-ai/sdk";
import { MODEL, notSetUp, rateLimited } from "@/lib/ai/server";
import { getProvider } from "@/lib/bible";
import { bookByCode } from "@/lib/bible/books";
import { chapterNote } from "@/lib/chapter-notes";
import { contextCard } from "@/lib/context-cards";
import { writeExplanation } from "@/lib/explain/generate";
import { chapterXrefs, savedExplanation } from "@/lib/explain/saved";

// "Explain in depth" for one chapter. Readers get the pre-written explanation
// (content/explanations, written by scripts/generate-explanations.mts and reviewed).
// A chapter without one yet is written live with the same grounding and checks,
// and kept in memory until it is saved properly.

const CACHE_MAX = 300;
const live = new Map<string, string>();

const reply = (text: string, status: "reviewed" | "draft" | "live", reviewedBy?: string) =>
  new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Explain-Status": status,
      ...(reviewedBy ? { "X-Explain-Reviewer": encodeURIComponent(reviewedBy) } : {}),
    },
  });

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { book?: unknown; chapter?: unknown } | null;
  const meta = bookByCode(String(body?.book ?? "").toUpperCase());
  const chapter = Number(body?.chapter);
  if (!meta || !Number.isInteger(chapter) || chapter < 1 || chapter > meta.chapters) {
    return Response.json({ error: "That chapter wasn't found." }, { status: 400 });
  }
  const ref = { book: meta.code, chapter };

  const saved = await savedExplanation(ref);
  if (saved) return reply(saved.text, saved.status, saved.reviewedBy);

  const key = `${meta.code}.${chapter}`;
  const cached = live.get(key);
  if (cached) return reply(cached, "live");

  if (!process.env.ANTHROPIC_API_KEY) return notSetUp("Explanations");
  if (rateLimited(req, "explain", 10)) return Response.json({ error: "That's a lot of explanations in a few minutes. Try again shortly." }, { status: 429 });

  const [text, note, xrefs] = await Promise.all([getProvider("KJV")?.chapter(ref), chapterNote(ref), chapterXrefs(ref)]);
  if (!text) return Response.json({ error: "That chapter wasn't found." }, { status: 404 });

  try {
    const e = await writeExplanation(new Anthropic(), { ref, verses: text.verses, card: contextCard(meta.code) ?? null, note, xrefs }, MODEL);
    if (live.size >= CACHE_MAX) live.delete(live.keys().next().value!);
    live.set(key, e.text);
    return reply(e.text, "live");
  } catch (err) {
    console.error("Explain failed", err);
    return Response.json({ error: "This explanation couldn't be written just now. Try again in a moment." }, { status: 502 });
  }
}
