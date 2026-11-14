// Listen in the natural voice. ElevenLabs, Supabase and sign-in are stand-ins; nothing is paid for.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  user: null as { id: string } | null,
  saved: null as Record<string, unknown> | null,
  monthUsed: 0,
  quotaFull: null as string | null,
  convert: vi.fn(),
  rpcCalls: [] as string[],
  uploads: [] as string[],
  rows: [] as Record<string, unknown>[],
}));

vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: class {
    textToSpeech = { convertWithTimestamps: m.convert };
  },
  ElevenLabsError: class extends Error {},
}));
vi.mock("@/lib/lamplighters/server", () => ({ caller: async () => (m.user ? { user: m.user, db: {} } : null) }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: m.saved }),
        upsert: async (row: Record<string, unknown>) => {
          m.rows.push(row);
          m.saved = { path: row.path, verse_starts: row.verse_starts };
          return { error: null };
        },
      };
      return q;
    },
    rpc: async (fn: string) => {
      m.rpcCalls.push(fn);
      if (fn === "usage_this_month") return { data: m.monthUsed, error: null };
      if (fn === "use_quota") return { data: m.quotaFull, error: null };
      return { data: null, error: null };
    },
    storage: {
      from: () => ({
        upload: async (path: string) => (m.uploads.push(path), { error: null }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.example/narration/${path}` } }),
      }),
    },
  }),
}));

import { GET, POST } from "./route";

const record = (body: unknown = { book: "JHN", chapter: 11 }) => POST(new Request("http://localhost/api/narration", { method: "POST", headers: { "x-forwarded-for": "203.0.113.9" }, body: JSON.stringify(body) }));
const recorded = () => m.convert.mockResolvedValue({ audioBase64: Buffer.from("mp3").toString("base64"), alignment: { characters: [], characterStartTimesSeconds: Array.from({ length: 20000 }, (_, i) => i * 0.05), characterEndTimesSeconds: [] } });

beforeEach(() => {
  vi.stubEnv("ELEVENLABS_API_KEY", "test");
  Object.assign(m, { user: { id: "user-1" }, saved: null, monthUsed: 0, quotaFull: null, rpcCalls: [], uploads: [], rows: [] });
  m.convert.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/narration", () => {
  it("says whether a chapter is recorded", async () => {
    expect(await (await GET(new Request("http://localhost/api/narration?book=JHN&chapter=11"))).json()).toEqual({ ready: false });
    m.saved = { path: "voice/JHN/11.mp3", verse_starts: [0, 4.2] };
    expect(await (await GET(new Request("http://localhost/api/narration?book=JHN&chapter=11"))).json()).toEqual({ ready: true, url: "https://cdn.example/narration/voice/JHN/11.mp3", verseStarts: [0, 4.2] });
    expect((await GET(new Request("http://localhost/api/narration?book=JHN&chapter=99"))).status).toBe(400);
  });
});

describe("POST /api/narration", () => {
  it("needs an account, and never records for a guest", async () => {
    m.user = null;
    expect((await record()).status).toBe(401);
    expect(m.convert).not.toHaveBeenCalled();
  });

  it("plays a recorded chapter without recording it again", async () => {
    m.saved = { path: "voice/JHN/11.mp3", verse_starts: [0] };
    expect((await (await record()).json()).ready).toBe(true);
    expect(m.convert).not.toHaveBeenCalled();
  });

  it("records once, stores it, and counts its characters toward the month", async () => {
    recorded();
    const res = await record();
    const body = await res.json();
    expect(body.ready).toBe(true);
    expect(body.verseStarts).toHaveLength(57); // John 11 has 57 verses
    expect(body.verseStarts[0]).toBe(0);
    expect(m.convert).toHaveBeenCalledWith("21m00Tcm4TlvDq8ikWAM", expect.objectContaining({ modelId: "eleven_flash_v2_5", outputFormat: "mp3_22050_32" }));
    const text = m.convert.mock.calls[0][1].text as string;
    expect(text.startsWith("Now a certain man was sick, named Lazarus")).toBe(true);
    expect(text).not.toMatch(/\b35 Jesus wept/); // verse numbers aren't read
    expect(m.uploads).toEqual(["21m00Tcm4TlvDq8ikWAM/JHN/11.mp3"]);
    expect(m.rows[0]).toMatchObject({ book: "JHN", chapter: 11, chars: text.length, model: "eleven_flash_v2_5" });
  });

  it("stops at the month's ceiling before calling ElevenLabs", async () => {
    vi.stubEnv("NARRATION_MONTHLY_CHARS", "400000");
    m.monthUsed = 399_000;
    const res = await record();
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("month_full");
    expect(m.convert).not.toHaveBeenCalled();
  });

  it("stops at the day's limits before calling ElevenLabs", async () => {
    m.quotaFull = "app";
    const res = await record();
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/resting for today/);
    m.quotaFull = "user";
    expect((await (await record()).json()).error).toMatch(/today's new chapters/);
    expect(m.convert).not.toHaveBeenCalled();
  });

  it("never pays twice for a chapter someone else is recording right now", async () => {
    m.quotaFull = "key";
    const res = await record();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("preparing");
    expect(m.convert).not.toHaveBeenCalled();
  });

  it("gives the day's place back when ElevenLabs fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.convert.mockRejectedValue(new Error("ElevenLabs is down"));
    expect((await record()).status).toBe(502);
    expect(m.rpcCalls).toContain("release_quota");
  });

  it("refuses chapters that don't exist", async () => {
    expect((await record({ book: "JHN", chapter: 22 })).status).toBe(400);
    expect(m.convert).not.toHaveBeenCalled();
  });
});
