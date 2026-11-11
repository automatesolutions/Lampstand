import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { rateLimited } from "@/lib/ai/server";
import { checkLyrics, compositionPlan, type SongStyle } from "@/lib/song";
import { songsNotSetUp, verifySong } from "@/lib/song-server";

// Records lyrics from /api/song/lyrics as a sung song with ElevenLabs Music (music_v2,
// with a composition plan so the singing follows the words). Only signed lyrics are
// recorded, each once. The mp3 streams straight to the browser and is never stored.

export const maxDuration = 300;

const HOUR = 60 * 60_000;
const used = new Map<string, number>(); // token -> when it was used (this instance)

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
  const body = (await req.json().catch(() => null)) as { lyrics?: unknown; style?: unknown; token?: unknown } | null;
  const lyrics = checkLyrics(body?.lyrics);
  const style: SongStyle | null = body?.style === "praise" || body?.style === "worship" ? body.style : null;
  if (!lyrics || !style || !verifySong(body?.token, lyrics, style)) return Response.json({ error: "Write the words first, then record the song." }, { status: 400 });
  const token = String(body!.token);
  if (used.has(token)) return Response.json({ error: "This song was already recorded. Press Make a song for a new one." }, { status: 409 });
  if (rateLimited(req, "song-audio", 3, HOUR)) return Response.json({ error: "You've made 3 songs this hour. Try again a little later." }, { status: 429 });
  used.set(token, Date.now());
  for (const [t, at] of used) if (Date.now() - at > HOUR) used.delete(t);

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
    console.error("Song recording failed", err instanceof ElevenLabsError ? { status: err.statusCode, body: err.body } : err);
    return Response.json({ error: "The song couldn't be recorded just now. The words are still here to sing or copy." }, { status: 502 });
  }
  return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
