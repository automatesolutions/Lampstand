import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Lyrics, SongStyle } from "./song";

// The lyrics route signs what it wrote, and the audio route records only signed lyrics,
// so nobody can use this server to record words Lampstand didn't write. The secret
// is derived from the ElevenLabs key and never leaves the server.

const TTL_MS = 60 * 60_000;

const secret = () => createHash("sha256").update(`lampstand-song:${process.env.ELEVENLABS_API_KEY ?? ""}`).digest();
const mac = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");
const payloadOf = (lyrics: Lyrics, style: SongStyle, exp: number) => JSON.stringify([exp, style, lyrics.title, lyrics.verse1, lyrics.chorus, lyrics.verse2]);

export function signSong(lyrics: Lyrics, style: SongStyle): string {
  const exp = Date.now() + TTL_MS;
  return `${exp}.${mac(payloadOf(lyrics, style, exp))}`;
}

export function verifySong(token: unknown, lyrics: Lyrics, style: SongStyle): boolean {
  if (typeof token !== "string") return false;
  const [expText, sig] = token.split(".");
  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return false;
  const want = Buffer.from(mac(payloadOf(lyrics, style, exp)));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

export const songsNotSetUp = () => Response.json({ error: "Songs aren't set up on this server yet." }, { status: 503 });
