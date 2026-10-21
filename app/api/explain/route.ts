import Anthropic from "@anthropic-ai/sdk";
import { cachedTextResponse, MODEL, notSetUp, rateLimited, textResponse } from "@/lib/ai/server";
import { getProvider } from "@/lib/bible";
import { bookByCode } from "@/lib/bible/books";
import { formatRef } from "@/lib/bible/refs";
import { chapterNote } from "@/lib/chapter-notes";
import { contextCard } from "@/lib/context-cards";

// "Explain in depth": a longer explanation of one chapter, grounded in its text.
// The public-domain KJV text is sent whatever version the reader uses, so no
// licensed text leaves the app. The same chapter gets the same explanation for
// everyone, so finished ones are kept in memory.

const SYSTEM = `You explain Bible chapters for Lampstand, a Bible reading app, to ordinary readers who have just read the chapter.
Write about 450 to 650 words in plain, warm English, using these sections in this order, each starting with a line "## " and the heading:
## Background
Who wrote or is speaking, when, where, and what was happening. Mark traditional attributions as traditional.
## What happens
Walk through the chapter in order in a few short paragraphs, citing verse numbers like (vv. 1–8).
## Key words and ideas
Two to four important words, images or ideas, each explained in a sentence or two. Start each one on a new line with "- ".
## Connections
How the chapter links to other parts of the Bible, with references.
## For reflection
Two or three short questions for the reader to think about. Start each on a new line with "- ".
Rules: Stay close to what the text says. Where Catholic, Orthodox and Protestant readers understand a passage differently, say so briefly and fairly instead of taking a side. Do not invent facts, dates or quotations. Use no markdown other than the "## " headings and "- " lines: no bold, no italics, no tables.`;

const CACHE_MAX = 300;
const done = new Map<string, string>();

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return notSetUp("Explanations");
  const body = (await req.json().catch(() => null)) as { book?: unknown; chapter?: unknown } | null;
  const meta = bookByCode(String(body?.book ?? "").toUpperCase());
  const chapter = Number(body?.chapter);
  if (!meta || !Number.isInteger(chapter) || chapter < 1 || chapter > meta.chapters) {
    return Response.json({ error: "That chapter wasn't found." }, { status: 400 });
  }

  const key = `${meta.code}.${chapter}`;
  const cached = done.get(key);
  if (cached) return cachedTextResponse(cached);
  if (rateLimited(req, "explain", 10)) return Response.json({ error: "That's a lot of explanations in a few minutes. Try again shortly." }, { status: 429 });

  const ref = { book: meta.code, chapter };
  const [text, note] = await Promise.all([getProvider("KJV")?.chapter(ref), chapterNote(ref)]);
  if (!text) return Response.json({ error: "That chapter wasn't found." }, { status: 404 });
  const card = contextCard(meta.code);

  const prompt = [
    `Chapter: ${formatRef(ref)}`,
    card && `Book background: ${card.author} ${card.date} First readers: ${card.audience} Setting: ${card.setting} Purpose: ${card.purpose}`,
    note && `Short summary already shown to the reader: ${note.title}. ${note.summary}`,
    `Text (King James Version):\n${text.verses.filter((v) => v.text).map((v) => `${v.number} ${v.text}`).join("\n")}`,
    "Please explain this chapter.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const stream = new Anthropic().messages.stream({
    model: MODEL,
    max_tokens: 3000,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  return textResponse(stream, {
    onDone: (all, complete) => {
      if (!complete || all.length < 200) return;
      if (done.size >= CACHE_MAX) done.delete(done.keys().next().value!);
      done.set(key, all);
    },
  });
}
