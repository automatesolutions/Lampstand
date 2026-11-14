import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { appLimit, envLimit, ipLimit, userLimit, type Limit, type Scope } from "./ai/usage";
import type { Lyrics, SongStyle } from "./song";

// The lyrics route signs what it wrote, for the person who asked, and the audio route
// records only signed lyrics, for that same person, so nobody can use this server to
// record words Lampstand didn't write or reuse someone else's song. The secret is derived
// from the ElevenLabs key and never leaves the server.

const TTL_MS = 60 * 60_000;

const secret = () => createHash("sha256").update(`lampstand-song:${process.env.ELEVENLABS_API_KEY ?? ""}`).digest();
const mac = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");
const payloadOf = (lyrics: Lyrics, style: SongStyle, userId: string, exp: number) =>
  JSON.stringify([exp, userId, style, lyrics.title, lyrics.verse1, lyrics.chorus, lyrics.verse2]);

export function signSong(lyrics: Lyrics, style: SongStyle, userId: string, now = Date.now()): string {
  const exp = now + TTL_MS;
  return `${exp}.${mac(payloadOf(lyrics, style, userId, exp))}`;
}

export function verifySong(token: unknown, lyrics: Lyrics, style: SongStyle, userId: string, now = Date.now()): boolean {
  if (typeof token !== "string") return false;
  const [expText, sig, extra] = token.split(".");
  const exp = Number(expText);
  if (extra !== undefined || !/^\d{13}$/.test(expText ?? "") || exp < now || !sig) return false;
  const want = Buffer.from(mac(payloadOf(lyrics, style, userId, exp)));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

/**
 * Daily song limits (usage_counters): per person, per network address, and for the
 * whole app. Each song counts once for its words and once for its recording.
 * Defaults: 3, 6 and 3 a day. Change them with SONG_LIMIT_PER_USER, SONG_LIMIT_PER_IP
 * and DAILY_SONG_LIMIT.
 */
export function songLimits(req: Request, userId: string): Limit[] {
  return [userLimit(userId, envLimit("SONG_LIMIT_PER_USER", 3)), ipLimit(req, envLimit("SONG_LIMIT_PER_IP", 6)), appLimit(envLimit("DAILY_SONG_LIMIT", 3))];
}

/** What to say when a daily song limit is reached. */
export function songLimitReached(full: Scope) {
  const perUser = envLimit("SONG_LIMIT_PER_USER", 3);
  const error =
    full === "user"
      ? `You've made ${perUser} ${perUser === 1 ? "song" : "songs"} today. You can make more tomorrow.`
      : full === "ip"
        ? "Songs from this connection have reached today's limit. Try again tomorrow."
        : "Make a song is resting for today. Please try again tomorrow.";
  return Response.json({ error }, { status: 429, headers: { "Cache-Control": "no-store" } });
}

export const songSignIn = () => Response.json({ error: "Sign in to make a song.", code: "sign_in_required" }, { status: 401 });

export const songsNotSetUp = () => Response.json({ error: "Songs aren't set up on this server yet." }, { status: 503 });
