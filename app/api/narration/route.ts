import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { appLimit, envLimit, ipLimit, takeQuota, userLimit } from "@/lib/ai/usage";
import { bookByCode } from "@/lib/bible/books";
import { kjvLocal } from "@/lib/bible/providers/kjv-local";
import { caller } from "@/lib/lamplighters/server";
import { DEFAULT_VOICE_ID, NARRATION_FORMAT, NARRATION_MODEL, narrationText, verseStarts } from "@/lib/narration/timing";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Listen to a chapter in the natural voice (DESIGN.md §8 Listen). Each chapter is recorded
// once per voice with ElevenLabs Flash, stored in the public "narration" bucket, and then
// replayed for everyone at no cost (supabase/migrations/0013). Only KJV text is recorded
// (public domain), taken here on the server.
//
// Recording stays inside the ElevenLabs plan:
//   NARRATION_CHAPTERS_PER_DAY   new chapters a day for the whole app (default 4)
//   NARRATION_CHAPTERS_PER_USER  new chapters a day per person (default 3)
//   NARRATION_MONTHLY_CHARS      characters a month for the whole app (default 400,000,
//                                below the Creator plan's 550,000 Flash characters, leaving room for songs)
// Replays and the device voice never count. Sign-in is needed to record.
//
// GET  ?book=JHN&chapter=3   -> { ready: true, url, verseStarts } or { ready: false }
// POST { book, chapter }     -> records it if it isn't yet (signed in), same answer

export const maxDuration = 120;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const voice = () => (/^[A-Za-z0-9]{10,40}$/.test(process.env.NARRATION_VOICE_ID ?? "") ? process.env.NARRATION_VOICE_ID! : DEFAULT_VOICE_ID);
const notSetUp = () => json({ error: "The natural voice isn't set up on this server yet. The device voice can read instead." }, 503);

function parse(book: unknown, chapter: unknown) {
  const meta = bookByCode(String(book ?? "").toUpperCase());
  const ch = Number(chapter);
  return meta && Number.isInteger(ch) && ch >= 1 && ch <= meta.chapters ? { book: meta.code, chapter: ch } : null;
}

type Admin = NonNullable<ReturnType<typeof supabaseAdmin>>;

async function saved(db: Admin, v: string, book: string, chapter: number) {
  const { data } = await db.from("narration_audio").select("path, verse_starts").eq("voice", v).eq("book", book).eq("chapter", chapter).maybeSingle();
  if (!data) return null;
  const url = db.storage.from("narration").getPublicUrl(String(data.path)).data.publicUrl;
  return { ready: true, url, verseStarts: (data.verse_starts as number[]).map(Number) };
}

export async function GET(req: Request) {
  const db = supabaseAdmin();
  if (!db) return notSetUp();
  const q = new URL(req.url).searchParams;
  const ref = parse(q.get("book"), q.get("chapter"));
  if (!ref) return json({ error: "That chapter wasn't found." }, 400);
  return json((await saved(db, voice(), ref.book, ref.chapter)) ?? { ready: false });
}

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  const db = supabaseAdmin();
  if (!key || !db) return notSetUp();
  const who = await caller(req);
  if (!who) return json({ error: "Sign in for the natural voice. The device voice can read without an account.", code: "sign_in_required" }, 401);
  const body = (await req.json().catch(() => null)) as { book?: unknown; chapter?: unknown } | null;
  const ref = parse(body?.book, body?.chapter);
  if (!ref) return json({ error: "That chapter wasn't found." }, 400);
  const v = voice();

  // Recorded already: free.
  const ready = await saved(db, v, ref.book, ref.chapter);
  if (ready) return json(ready);

  const chapter = await kjvLocal.chapter(ref);
  if (!chapter?.verses.length) return json({ error: "That chapter wasn't found." }, 400);
  const { text, offsets } = narrationText(chapter.verses.map((x) => x.text));

  // The month's ceiling, so recording never goes past the ElevenLabs plan.
  const monthly = envLimit("NARRATION_MONTHLY_CHARS", 400_000);
  const used = await db.rpc("usage_this_month", { p_feature: "narration_chars" });
  if (used.error) {
    console.error("usage_this_month failed", used.error.message);
    return notSetUp(); // without the count, don't risk going over
  }
  if (Number(used.data) + text.length > monthly) {
    return json({ error: "The natural voice has recorded all it can this month. The device voice will read instead.", code: "month_full" }, 429);
  }

  // A day's limits, plus a one-time key so two people can't pay for the same chapter at once.
  const quota = await takeQuota({
    feature: "narration",
    limits: [
      userLimit(who.user.id, envLimit("NARRATION_CHAPTERS_PER_USER", 3)),
      ipLimit(req, envLimit("NARRATION_CHAPTERS_PER_USER", 3) * 2),
      appLimit(envLimit("NARRATION_CHAPTERS_PER_DAY", 4)),
      { scope: "key", subject: `${v}.${ref.book}.${ref.chapter}`, max: 1 },
    ],
  });
  if (!quota.ok) {
    if (quota.full === "key") return json({ error: "This chapter is being recorded now. It will be ready in a moment.", code: "preparing" }, 409);
    const error =
      quota.full === "user"
        ? "You've had today's new chapters recorded. Chapters already recorded still play, and the device voice can read this one."
        : "The natural voice is resting for today. The device voice will read instead.";
    return json({ error, code: "day_full" }, 429);
  }

  let paid = false;
  try {
    const res = await new ElevenLabsClient({ apiKey: key }).textToSpeech.convertWithTimestamps(v, { text, modelId: NARRATION_MODEL, outputFormat: NARRATION_FORMAT });
    paid = true;
    await takeQuota({ feature: "narration_chars", limits: [appLimit(999_999_999_999)], amount: text.length }); // counts toward the month
    const audio = Buffer.from(res.audioBase64, "base64");
    const starts = verseStarts(offsets, res.alignment?.characterStartTimesSeconds ?? []);
    const path = `${v}/${ref.book}/${ref.chapter}.mp3`;
    const up = await db.storage.from("narration").upload(path, audio, { contentType: "audio/mpeg", upsert: true, cacheControl: "31536000" });
    if (up.error) throw up.error;
    const row = await db.from("narration_audio").upsert({ voice: v, book: ref.book, chapter: ref.chapter, path, chars: text.length, verse_starts: starts, model: NARRATION_MODEL });
    if (row.error) throw row.error;
    return json(await saved(db, v, ref.book, ref.chapter));
  } catch (err) {
    if (!paid) await quota.giveBack(); // ElevenLabs didn't record it: it doesn't count
    console.error("Narration failed", err instanceof ElevenLabsError ? { status: err.statusCode, body: err.body } : err);
    return json({ error: "The natural voice couldn't record this chapter. The device voice can read it instead." }, 502);
  }
}
