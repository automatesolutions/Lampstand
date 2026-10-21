import Anthropic from "@anthropic-ai/sdk";
import { MODEL, notSetUp, rateLimited, textResponse } from "@/lib/ai/server";
import { bookByCode } from "@/lib/bible/books";
import { formatRef } from "@/lib/bible/refs";
import { chapterNote } from "@/lib/chapter-notes";
import { closePrayer } from "@/lib/prayer-close";

// A short prayer drawn from the chapters someone read recently. Only chapter
// references are sent here: never notes, highlights or anything personal.

const MAX_REFS = 5;

const SYSTEM = `You write short Christian prayers for Lampstand, a Bible reading app.
The reader has just read some chapters of the Bible and wants to pray over them.
Write one prayer of 110 to 170 words, in the first person ("I", "me"), addressed to God.
Draw on what these chapters actually say: name one or two of their images, people or promises, and turn them into thanks, confession, trust or a request.
Keep it warm, plain and humble. Use wording that Catholic, Orthodox and Protestant readers can all pray.
Do not guess at the reader's life, feelings or circumstances. Do not promise outcomes such as healing or wealth. Do not quote long passages.
Write plain text only: no title, no headings, no markdown, no list.
Do not write a closing line and do not write "Amen": the app always closes the prayer with "In Jesus' Name, Amen."`;

type Ref = { book: string; chapter: number };

function parseRefs(body: unknown): Ref[] | null {
  const refs = (body as { refs?: unknown })?.refs;
  if (!Array.isArray(refs) || refs.length === 0 || refs.length > MAX_REFS) return null;
  const out: Ref[] = [];
  for (const r of refs) {
    const book = bookByCode(String((r as Ref)?.book ?? "").toUpperCase());
    const chapter = Number((r as Ref)?.chapter);
    if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) return null;
    out.push({ book: book.code, chapter });
  }
  return out;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return notSetUp("Prayer");
  const refs = parseRefs(await req.json().catch(() => null));
  if (!refs) return Response.json({ error: "Choose between one and five chapters." }, { status: 400 });
  if (rateLimited(req, "prayer", 8)) return Response.json({ error: "That's a lot of prayers in a few minutes. Try again shortly." }, { status: 429 });

  const lines = await Promise.all(
    refs.map(async (r) => {
      const note = await chapterNote(r);
      return note ? `- ${formatRef(r)}: ${note.title}. ${note.summary}` : `- ${formatRef(r)}`;
    }),
  );

  const stream = new Anthropic().messages.stream({
    model: MODEL,
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: "user", content: `Chapters I read recently, most recent first:\n${lines.join("\n")}\n\nPlease write the prayer.` }],
  });

  // Hold back the last characters so a stray closing from the model can be swapped for ours.
  return textResponse(stream, { holdBack: 80, finish: closePrayer });
}
