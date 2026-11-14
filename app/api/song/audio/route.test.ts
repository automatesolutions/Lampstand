// Make a song: recording. ElevenLabs, sign-in and the database are stand-ins; nothing is paid for.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LYRICS } from "@/lib/test/lyrics";

const m = vi.hoisted(() => ({
  compose: vi.fn(),
  user: null as { id: string } | null,
}));

vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: class {
    music = { compose: m.compose };
  },
  ElevenLabsError: class extends Error {},
}));
vi.mock("@/lib/lamplighters/server", () => ({ caller: async () => (m.user ? { user: m.user, db: {} } : null) }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => null }));

import { resetRateLimits } from "@/lib/ai/server";
import { resetMemoryQuota } from "@/lib/ai/usage";
import { signSong } from "@/lib/song-server";
import { POST } from "./route";

let ip = 0;
const record = (body: unknown) =>
  POST(new Request("http://localhost/api/song/audio", { method: "POST", headers: { "x-forwarded-for": `203.0.113.${++ip % 250}` }, body: JSON.stringify(body) }));
let signed = 0;
/** A new song each call (each token signed a moment apart, so no two are the same). */
const song = (userId = "user-1") => ({ lyrics: LYRICS, style: "praise", token: signSong(LYRICS, "praise", userId, Date.now() + ++signed) });
const mp3 = () => new ReadableStream({ start: (c) => (c.enqueue(new Uint8Array([0xff, 0xfb])), c.close()) });

beforeEach(() => {
  vi.stubEnv("ELEVENLABS_API_KEY", "test");
  vi.stubEnv("DAILY_SONG_LIMIT", "100");
  vi.stubEnv("SONG_LIMIT_PER_IP", "100");
  m.compose.mockReset();
  m.user = { id: "user-1" };
  resetRateLimits();
  resetMemoryQuota();
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/song/audio", () => {
  it("needs an account, and calls ElevenLabs only with one", async () => {
    m.user = null;
    expect((await record(song())).status).toBe(401);
    expect(m.compose).not.toHaveBeenCalled();
  });

  it("records only words signed for this person", async () => {
    expect((await record(song("someone-else"))).status).toBe(400);
    expect((await record({ ...song(), token: "123.abc" })).status).toBe(400);
    expect(m.compose).not.toHaveBeenCalled();
  });

  it("streams the recording", async () => {
    m.compose.mockResolvedValue(mp3());
    const res = await record(song());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(m.compose).toHaveBeenCalledTimes(1);
  });

  it("stops at 3 recordings a day per person, before calling ElevenLabs", async () => {
    m.compose.mockImplementation(async () => mp3());
    for (let i = 0; i < 3; i++) expect((await record(song())).status).toBe(200);
    const res = await record(song());
    expect(res.status).toBe(429);
    expect(m.compose).toHaveBeenCalledTimes(3);
  });

  it("stops everyone at the app-wide limit", async () => {
    vi.stubEnv("DAILY_SONG_LIMIT", "1");
    m.compose.mockImplementation(async () => mp3());
    expect((await record(song())).status).toBe(200);
    m.user = { id: "user-2" };
    expect((await record(song("user-2"))).status).toBe(429);
    expect(m.compose).toHaveBeenCalledTimes(1);
  });

  it("gives the day's use back when the recording fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.compose.mockRejectedValue(new Error("ElevenLabs is down"));
    for (let i = 0; i < 3; i++) expect((await record(song())).status).toBe(502);
    m.compose.mockImplementation(async () => mp3());
    expect((await record(song())).status).toBe(200); // the failures didn't use up today's songs
  });

  it("records the same words again after a failure, without new words", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const words = song();
    m.compose.mockRejectedValueOnce(new Error("ElevenLabs is down"));
    expect((await record(words)).status).toBe(502);
    m.compose.mockImplementation(async () => mp3());
    expect((await record(words)).status).toBe(200); // the same token works after a failure
  });

  it("records each song once: the same token again is refused, and not counted", async () => {
    m.compose.mockImplementation(async () => mp3());
    const words = song();
    expect((await record(words)).status).toBe(200);
    const again = await record(words);
    expect(again.status).toBe(409);
    expect((await again.json()).error).toMatch(/already recorded/);
    expect(m.compose).toHaveBeenCalledTimes(1);
    // The refused copy didn't use one of today's three.
    expect((await record(song())).status).toBe(200);
    expect((await record(song())).status).toBe(200);
  });

  it("refuses words signed more than an hour ago", async () => {
    const old = { lyrics: LYRICS, style: "praise", token: signSong(LYRICS, "praise", "user-1", Date.now() - 61 * 60_000) };
    expect((await record(old)).status).toBe(400);
    expect(m.compose).not.toHaveBeenCalled();
  });
});
