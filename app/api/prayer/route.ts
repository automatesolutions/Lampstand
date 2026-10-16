import Anthropic from "@anthropic-ai/sdk";
import { bookByCode } from "@/lib/bible/books";
import { formatRef } from "@/lib/bible/refs";
import { chapterNote } from "@/lib/chapter-notes";

// A short prayer drawn from the chapters someone read recently. Only chapter
// references are sent here: never notes, highlights or anything personal.

const MODEL = "claude-sonnet-5-5";
const MAX_REFS = 5;

const SYSTEM = `You write short Christian prayers for Lampstand, a Bible reading app.
The reader has just read some chapters of the Bible and wants to pray over them.
Write one prayer of 110 to 170 words, in the first person ("I", "me"), addressed to God.
Draw on what these chapters actually say: name one or two of their images, people or promises, and turn them into thanks, confession, trust or a request.
Keep it warm, plain and humble. Use wording that Catholic, Orthodox and Protestant readers can all pray.
Do not guess at the reader's life, feelings or circumstances. Do not promise outcomes such as healing or wealth. Do not quote long passages.
Write plain text only: no title, no headings, no markdown, no list. End with "Amen."`;

// Small per-address limit. In-memory, so it resets on restart and is per server instance.
const WINDOW_MS = 10 * 60_000;
const LIMIT = 8;
const hits = new Map<string, number[]>();

function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return true;
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

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
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Prayer isn't set up on this server yet." }, { status: 503 });
  }
  const refs = parseRefs(await req.json().catch(() => null));
  if (!refs) return Response.json({ error: "Choose between one and five chapters." }, { status: 400 });

  const who = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  if (limited(who)) return Response.json({ error: "That's a lot of prayers in a few minutes. Try again shortly." }, { status: 429 });

  const lines = await Promise.all(
    refs.map(async (r) => {
      const note = await chapterNote(r);
      return note ? `- ${formatRef(r)}: ${note.title}. ${note.summary}` : `- ${formatRef(r)}`;
    }),
  );

  const client = new Anthropic();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: "user", content: `Chapters I read recently, most recent first:\n${lines.join("\n")}\n\nPlease write the prayer.` }],
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") controller.enqueue(encoder.encode(event.delta.text));
        }
        controller.close();
      } catch (err) {
        console.error("prayer stream failed", err);
        controller.error(err);
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
