import { createHash } from "node:crypto";
import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { rateLimited } from "@/lib/ai/server";
import { takeQuota } from "@/lib/ai/usage";
import { caller } from "@/lib/lamplighters/server";
import { checkLyrics, compositionPlan, type SongStyle } from "@/lib/song";
import { songLimitReached, songLimits, songSignIn, songsNotSetUp, verifySong } from "@/lib/song-server";

// Records lyrics from /api/song/lyrics as a sung song with ElevenLabs Music (music_v2,
// with a composition plan so the singing follows the words). Only signed lyrics are
// recorded, each once, for the person they were written for. The mp3 streams straight
// to the browser and is never stored. Every recording is counted against the durable
// daily song limits before ElevenLabs is called. "Once each" is part of the same check:
// the token is a one-time key (limit 1) in usage_counters, so two copies of a request
// can't both record. If ElevenLabs fails before the audio starts, the day's count and the
// token are both given back, so the same words can be recorded again without new lyrics.

export const maxDuration = 300;

const HOUR = 60 * 60_000;

type Plan = ReturnType<typeof compositionPlan>;

const camel = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(camel)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), camel(x)]))
      : v;

/** ElevenLabs' suggested plan after a bad_prompt or bad_composition_plan, if it gave one. */
function suggestion(e: unknown): Plan | null {
  if (!(e instanceof ElevenLabsError)) return null;
  const detail = (e.body as { detail?: { status?: string; data?: Record<string, unknown> } } | undefined)?.detail;
  if (detail?.status !== "bad_prompt" && detail?.status !== "bad_composition_plan") return null;
  const s = camel(detail.data?.composition_plan_suggestion) as Plan | undefined;
  return s && Array.isArray(s.chunks) && s.chunks.length > 0 ? s : null;
}

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return songsNotSetUp();
  const who = await caller(req);
  if (!who) return songSignIn();
  const body = (await req.json().catch(() => null)) as { lyrics?: unknown; style?: unknown; token?: unknown } | null;
  const lyrics = checkLyrics(body?.lyrics);
  const style: SongStyle | null = body?.style === "praise" || body?.style === "worship" ? body.style : null;
  if (!lyrics || !style || !verifySong(body?.token, lyrics, style, who.user.id)) return Response.json({ error: "Write the words first, then record the song." }, { status: 400 });
  const tokenKey = createHash("sha256").update(String(body!.token)).digest("base64url");
  if (rateLimited(req, "song-audio", 6, HOUR)) return Response.json({ error: "That's a lot of recordings this hour. Try again a little later." }, { status: 429 });
  const quota = await takeQuota({ feature: "song_audio", limits: [...songLimits(req, who.user.id), { scope: "key", subject: tokenKey, max: 1 }] });
  if (!quota.ok) {
    if (quota.full === "key") return Response.json({ error: "This song was already recorded. Press Make another for a new one." }, { status: 409 });
    return songLimitReached(quota.full);
  }

  const client = new ElevenLabsClient({ apiKey: key });
  const compose = (plan: Plan) => client.music.compose({ modelId: "music_v2", compositionPlan: plan, outputFormat: "mp3_44100_128" });

  let audio: ReadableStream<Uint8Array>;
  try {
    try {
      audio = await compose(compositionPlan(lyrics, style));
    } catch (e) {
      const retry = suggestion(e); // once, with ElevenLabs' suggestion
      if (!retry) throw e;
      console.warn("Song plan rejected; retrying with the suggestion");
      audio = await compose(retry);
    }
  } catch (err) {
    await quota.giveBack(); // nothing was recorded: the token and today's count come back
    console.error("Song recording failed", err instanceof ElevenLabsError ? { status: err.statusCode, body: err.body } : err);
    return Response.json({ error: "The song couldn't be recorded. The words are still here to sing or copy." }, { status: 502 });
  }
  return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
