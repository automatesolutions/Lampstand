import Anthropic from "@anthropic-ai/sdk";
import { budgetReached, overBudget, recordUsage } from "@/lib/ai/budget";
import { MODEL, notSetUp, rateLimited } from "@/lib/ai/server";
import { getProvider } from "@/lib/bible";
import { bookByCode } from "@/lib/bible/books";
import { chapterNote } from "@/lib/chapter-notes";
import { contextCard } from "@/lib/context-cards";
import { writeExplanation } from "@/lib/explain/generate";
import { chapterXrefs, savedExplanation } from "@/lib/explain/saved";
import { supabaseAdmin } from "@/lib/supabase/admin";

// "Explain in depth" for one chapter, cheapest source first:
//   1. content/explanations: written ahead and reviewed (scripts/generate-explanations.mts)
//   2. Supabase explanations: written when a reader first asked (paid for once, ever)
//   3. written now with the same grounding and checks, then saved to (2)
// Writing pauses for the day once the daily AI budget is reached.

const CACHE_MAX = 300;
const memory = new Map<string, string>(); // this instance's copy of (2)
const writing = new Map<string, Promise<string>>(); // one write per chapter at a time

type Status = "reviewed" | "draft" | "live";

const reply = (text: string, status: Status, reviewedBy?: string) =>
  new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Explain-Status": status,
      ...(reviewedBy ? { "X-Explain-Reviewer": encodeURIComponent(reviewedBy) } : {}),
    },
  });

function remember(key: string, text: string) {
  if (memory.size >= CACHE_MAX) memory.delete(memory.keys().next().value!);
  memory.set(key, text);
}

async function stored(book: string, chapter: number): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.from("explanations").select("text").eq("book", book).eq("chapter", chapter).maybeSingle();
  if (error) console.error("explanations read failed", error.message);
  return (data?.text as string | undefined) ?? null;
}

async function store(book: string, chapter: number, text: string, model: string) {
  const db = supabaseAdmin();
  if (!db) return;
  const { error } = await db.from("explanations").upsert({ book, chapter, text, model }, { onConflict: "book,chapter", ignoreDuplicates: true });
  if (error) console.error("explanations write failed", error.message);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { book?: unknown; chapter?: unknown } | null;
  const meta = bookByCode(String(body?.book ?? "").toUpperCase());
  const chapter = Number(body?.chapter);
  if (!meta || !Number.isInteger(chapter) || chapter < 1 || chapter > meta.chapters) {
    return Response.json({ error: "That chapter wasn't found." }, { status: 400 });
  }
  const ref = { book: meta.code, chapter };
  const key = `${meta.code}.${chapter}`;

  const saved = await savedExplanation(ref);
  if (saved) return reply(saved.text, saved.status, saved.reviewedBy);

  const cached = memory.get(key) ?? (await stored(meta.code, chapter));
  if (cached) {
    remember(key, cached);
    return reply(cached, "live");
  }

  // Someone on this instance is already writing it: wait for theirs instead of paying twice.
  const pending = writing.get(key);
  if (pending) {
    try {
      return reply(await pending, "live");
    } catch {
      // fall through and try again
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) return notSetUp("Explanations");
  if (rateLimited(req, "explain", 10)) return Response.json({ error: "That's a lot of explanations in a few minutes. Try again shortly." }, { status: 429 });
  if (await overBudget()) return budgetReached("Explain in depth");

  const job = (async () => {
    const [text, note, xrefs] = await Promise.all([getProvider("KJV")?.chapter(ref), chapterNote(ref), chapterXrefs(ref)]);
    if (!text) throw new Error("chapter not found");
    const e = await writeExplanation(new Anthropic(), { ref, verses: text.verses, card: contextCard(meta.code) ?? null, note, xrefs }, MODEL);
    await recordUsage("explain", MODEL, {
      input_tokens: e.usage.input,
      output_tokens: e.usage.output,
      cache_read_input_tokens: e.usage.cacheRead,
      cache_creation_input_tokens: e.usage.cacheWrite,
    });
    remember(key, e.text);
    await store(meta.code, chapter, e.text, e.model);
    return e.text;
  })();
  writing.set(key, job);

  try {
    return reply(await job, "live");
  } catch (err) {
    console.error("Explain failed", err);
    return Response.json({ error: "This explanation couldn't be written just now. Try again in a moment." }, { status: 502 });
  } finally {
    writing.delete(key);
  }
}
