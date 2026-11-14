import { beforeEach, describe, expect, it, vi } from "vitest";
import { LYRICS } from "@/lib/test/lyrics";
import { signSong, verifySong } from "./song-server";

const HOUR = 60 * 60_000;
const NOW = Date.parse("2026-11-13T12:00:00Z");

beforeEach(() => vi.stubEnv("ELEVENLABS_API_KEY", "test-key"));

describe("signSong and verifySong", () => {
  it("accepts the words it signed, for the same person and style", () => {
    const token = signSong(LYRICS, "praise", "user-1", NOW);
    expect(verifySong(token, LYRICS, "praise", "user-1", NOW + 1000)).toBe(true);
  });

  it("refuses a token after an hour", () => {
    const token = signSong(LYRICS, "praise", "user-1", NOW);
    expect(verifySong(token, LYRICS, "praise", "user-1", NOW + HOUR - 1)).toBe(true);
    expect(verifySong(token, LYRICS, "praise", "user-1", NOW + HOUR + 1)).toBe(false);
  });

  it("refuses changed words, another style, or another person", () => {
    const token = signSong(LYRICS, "praise", "user-1", NOW);
    expect(verifySong(token, { ...LYRICS, title: "Something else" }, "praise", "user-1", NOW)).toBe(false);
    expect(verifySong(token, { ...LYRICS, chorus: [...LYRICS.chorus.slice(0, 3), "A line I wrote"] }, "praise", "user-1", NOW)).toBe(false);
    expect(verifySong(token, LYRICS, "worship", "user-1", NOW)).toBe(false);
    expect(verifySong(token, LYRICS, "praise", "user-2", NOW)).toBe(false);
  });

  it("refuses a tampered token", () => {
    const token = signSong(LYRICS, "praise", "user-1", NOW);
    const [exp, sig] = token.split(".");
    const later = String(Number(exp) + HOUR); // pushing the expiry out breaks the signature
    expect(verifySong(`${later}.${sig}`, LYRICS, "praise", "user-1", NOW)).toBe(false);
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(verifySong(`${exp}.${flipped}`, LYRICS, "praise", "user-1", NOW)).toBe(false);
    for (const bad of [undefined, null, 42, "", "nonsense", `${exp}.`, `.${sig}`, `${exp}.${sig}.extra`, `+${exp.slice(1)}.${sig}`]) {
      expect(verifySong(bad, LYRICS, "praise", "user-1", NOW)).toBe(false);
    }
  });

  it("refuses a token signed with another server's secret", () => {
    const token = signSong(LYRICS, "praise", "user-1", NOW);
    vi.stubEnv("ELEVENLABS_API_KEY", "a-different-key");
    expect(verifySong(token, LYRICS, "praise", "user-1", NOW)).toBe(false);
  });
});
