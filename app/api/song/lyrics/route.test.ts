// Make a song: words. Claude, sign-in and the database are stand-ins; nothing is paid for.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LYRICS } from "@/lib/test/lyrics";

const m = vi.hoisted(() => ({
  create: vi.fn(),
  user: null as { id: string } | null,
}));

vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: m.create }; } }));
vi.mock("@/lib/lamplighters/server", () => ({ caller: async () => (m.user ? { user: m.user, db: {} } : null) }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => null })); // limits count in memory
vi.mock("@/lib/ai/budget", () => ({ overBudget: async () => false, recordUsage: async () => {}, budgetReached: () => new Response(null, { status: 503 }) }));

import { resetRateLimits } from "@/lib/ai/server";
import { resetMemoryQuota } from "@/lib/ai/usage";
import { verifySong } from "@/lib/song-server";
import { POST } from "./route";

let ip = 0;
/** Each request from a new address, so the hourly burst limit stays out of the way. */
const ask = (body: unknown = { refs: [{ book: "JHN", chapter: 3 }], style: "praise" }, addr = `203.0.113.${++ip % 250}`) =>
  POST(new Request("http://localhost/api/song/lyrics", { method: "POST", headers: { "x-forwarded-for": addr }, body: JSON.stringify(body) }));

const claudeWrites = () =>
  m.create.mockResolvedValue({ stop_reason: "end_turn", usage: { input_tokens: 900, output_tokens: 300 }, content: [{ type: "text", text: JSON.stringify(LYRICS) }] });

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test");
  vi.stubEnv("ELEVENLABS_API_KEY", "test");
  vi.stubEnv("DAILY_SONG_LIMIT", "100");
  vi.stubEnv("SONG_LIMIT_PER_IP", "100");
  m.create.mockReset();
  m.user = { id: "user-1" };
  resetRateLimits();
  resetMemoryQuota();
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/song/lyrics", () => {
  it("needs an account, and asks Claude nothing without one", async () => {
    m.user = null;
    const res = await ask();
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("sign_in_required");
    expect(m.create).not.toHaveBeenCalled();
  });

  it("returns the words with a token for this person only", async () => {
    claudeWrites();
    const res = await ask();
    expect(res.status).toBe(200);
    const { lyrics, style, token } = await res.json();
    expect(verifySong(token, lyrics, style, "user-1")).toBe(true);
    expect(verifySong(token, lyrics, style, "user-2")).toBe(false);
  });

  it("stops at 3 songs a day per person, before asking Claude", async () => {
    claudeWrites();
    for (let i = 0; i < 3; i++) expect((await ask()).status).toBe(200);
    const res = await ask();
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("You've made 3 songs today. You can make more tomorrow.");
    expect(m.create).toHaveBeenCalledTimes(3);
  });

  it("stops everyone at the app-wide limit (DAILY_SONG_LIMIT)", async () => {
    vi.stubEnv("DAILY_SONG_LIMIT", "2");
    claudeWrites();
    m.user = { id: "a" };
    expect((await ask()).status).toBe(200);
    m.user = { id: "b" };
    expect((await ask()).status).toBe(200);
    m.user = { id: "c" };
    const res = await ask();
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/resting for today/);
    expect(m.create).toHaveBeenCalledTimes(2);
  });

  it("stops one address at its daily limit, even across accounts", async () => {
    vi.stubEnv("SONG_LIMIT_PER_IP", "1");
    claudeWrites();
    m.user = { id: "a" };
    expect((await ask(undefined, "198.51.100.7")).status).toBe(200);
    m.user = { id: "b" };
    // A faked first address doesn't help: the address Cloud Run saw is the same.
    expect((await ask(undefined, "1.2.3.4, 198.51.100.7")).status).toBe(429);
  });

  it("doesn't count a song when Claude couldn't be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.create.mockRejectedValue(new Error("network down"));
    for (let i = 0; i < 3; i++) expect((await ask()).status).toBe(502);
    claudeWrites();
    expect((await ask()).status).toBe(200); // still 3 left today
  });

  it("checks the request before anything else", async () => {
    expect((await ask({ refs: [], style: "praise" })).status).toBe(400);
    expect((await ask({ refs: [{ book: "JHN", chapter: 99 }], style: "praise" })).status).toBe(400);
    expect((await ask({ refs: [{ book: "JHN", chapter: 3 }], style: "polka" })).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });
});
