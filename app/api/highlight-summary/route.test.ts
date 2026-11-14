// Highlight summaries: open to guests, with a burst limit and a daily cap per address.
// Claude and the database are stand-ins; nothing is paid for.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ create: vi.fn(), stored: null as string | null }));

vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: m.create }; } }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => null, // limits count in memory; summaries cache in memory
}));
vi.mock("@/lib/ai/budget", () => ({ overBudget: async () => false, recordUsage: async () => {}, budgetReached: () => new Response(null, { status: 503 }) }));

let POST: (req: Request) => Promise<Response>;
let resetRateLimits: () => void;

const SUMMARY = "God so loved the world that he gave his only Son, so that everyone who trusts him has eternal life.";
const claudeWrites = () => m.create.mockResolvedValue({ stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 60 }, content: [{ type: "text", text: SUMMARY }] });

const ask = (body: Record<string, unknown>, ip = "203.0.113.9") =>
  POST(new Request("http://localhost/api/highlight-summary", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(body) }));
const verse = (n: number) => ({ book: "PSA", chapter: 119, verseStart: n, verseEnd: n });

beforeEach(async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test");
  m.create.mockReset();
  // Fresh modules for each test: an empty summary cache, burst limits and daily counts.
  vi.resetModules();
  ({ POST } = await import("./route"));
  ({ resetRateLimits } = await import("@/lib/ai/server"));
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/highlight-summary", () => {
  it("refuses references that don't exist, before anything is paid for", async () => {
    for (const bad of [
      { book: "XYZ", chapter: 1, verseStart: 1 },
      { book: "JHN", chapter: 22, verseStart: 1 },
      { book: "JHN", chapter: 3, verseStart: 0 },
      { book: "JHN", chapter: 3, verseStart: 17, verseEnd: 16 },
      { book: "JHN", chapter: 3, verseStart: 1.5 },
    ]) {
      expect((await ask(bad)).status).toBe(400);
    }
    expect(m.create).not.toHaveBeenCalled();
  });

  it("refuses ranges longer than 10 verses", async () => {
    expect((await ask({ book: "PSA", chapter: 119, verseStart: 1, verseEnd: 11 })).status).toBe(400);
    claudeWrites();
    expect((await ask({ book: "PSA", chapter: 119, verseStart: 1, verseEnd: 10 })).status).toBe(200);
  });

  it("writes a summary once, then serves it from the cache without asking Claude or counting", async () => {
    vi.stubEnv("HIGHLIGHT_SUMMARIES_PER_IP", "1");
    claudeWrites();
    const first = await ask({ book: "JHN", chapter: 3, verseStart: 16 });
    expect(await first.json()).toEqual({ summary: SUMMARY });
    for (let i = 0; i < 5; i++) {
      const again = await ask({ book: "JHN", chapter: 3, verseStart: 16 });
      expect(again.status).toBe(200);
    }
    expect(m.create).toHaveBeenCalledTimes(1); // cache hits are free, and don't use the daily cap
  });

  it("allows 10 new summaries in 10 minutes from one address", async () => {
    vi.stubEnv("HIGHLIGHT_SUMMARIES_PER_IP", "100");
    claudeWrites();
    for (let n = 1; n <= 10; n++) expect((await ask(verse(n))).status).toBe(200);
    expect((await ask(verse(11))).status).toBe(429);
    expect(m.create).toHaveBeenCalledTimes(10);
  });

  it("caps new summaries per address per day (HIGHLIGHT_SUMMARIES_PER_IP)", async () => {
    vi.stubEnv("HIGHLIGHT_SUMMARIES_PER_IP", "3");
    claudeWrites();
    for (let n = 1; n <= 3; n++) expect((await ask(verse(n))).status).toBe(200);
    resetRateLimits(); // past the burst window, still the same day
    const res = await ask(verse(4));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/today's limit/);
    // Writing a fake address in front doesn't get around it.
    resetRateLimits();
    expect((await ask(verse(5), "1.1.1.1, 203.0.113.9")).status).toBe(429);
    // Another address still can.
    expect((await ask(verse(6), "198.51.100.1")).status).toBe(200);
    expect(m.create).toHaveBeenCalledTimes(4);
  });

  it("doesn't count a summary Claude never wrote", async () => {
    vi.stubEnv("HIGHLIGHT_SUMMARIES_PER_IP", "1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.create.mockRejectedValueOnce(new Error("network down"));
    expect((await ask(verse(1))).status).toBe(502);
    claudeWrites();
    expect((await ask(verse(1))).status).toBe(200);
  });
});
