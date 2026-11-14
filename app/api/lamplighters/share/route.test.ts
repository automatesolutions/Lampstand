// Sharing a highlight to Circles. Sign-in, the database and email are stand-ins.

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  user: null as { id: string } | null,
  row: null as Record<string, unknown> | null,
  inserts: [] as Record<string, unknown>[],
  insertError: {} as Record<string, { code: string; message: string }>,
  emailed: [] as string[],
}));

vi.mock("@/lib/lamplighters/notify", () => ({ emailNotifications: async (_r: Request, _s: string, circleId: string) => void m.emailed.push(circleId) }));
vi.mock("@/lib/lamplighters/server", () => ({
  fail: (code: string, status = 400) => Response.json({ error: code }, { status }),
  caller: async () =>
    m.user && {
      user: m.user,
      db: {
        from: (table: string) =>
          table === "highlights"
            ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: m.row, error: null }) }) }) }
            : {
                insert: async (row: Record<string, unknown>) => {
                  m.inserts.push(row);
                  return { error: m.insertError[row.circle_id as string] ?? null };
                },
              },
      },
    },
}));

import { POST } from "./route";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const H = "33333333-3333-4333-8333-333333333333";
const send = (body: unknown) => POST(new Request("http://localhost/api/lamplighters/share", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  m.user = { id: "me" };
  m.row = { id: H, book: "JHN", chapter: 3, verse_start: 16, verse_end: 17, color: "sage", summary: "God gave his Son so the world would be saved." };
  m.inserts = [];
  m.insertError = {};
  m.emailed = [];
});

describe("POST /api/lamplighters/share", () => {
  it("needs an account", async () => {
    m.user = null;
    expect((await send({ highlightId: H, circleIds: [A] })).status).toBe(401);
  });

  it("posts the KJV words of the highlight to each Circle, and emails as for a message", async () => {
    const res = await send({ highlightId: H, circleIds: [A, B] });
    expect(await res.json()).toEqual({ shared: [A, B], already: [], failed: {} });
    expect(m.inserts).toHaveLength(2);
    const card = m.inserts[0].highlight as Record<string, string>;
    expect(card.ref).toBe("John 3:16–17");
    expect(card.text).toMatch(/^16 For God so loved the world.* 17 For God sent not his Son/);
    expect(card.summary).toBeUndefined(); // only when chosen
    expect(m.inserts[0]).toMatchObject({ highlight_id: H, sender_id: "me", body: null });
    expect(m.emailed).toEqual([A, B]);
  });

  it("adds my note and the summary only when I choose them", async () => {
    await send({ highlightId: H, circleIds: [A], note: "  This one got me today  ", withSummary: true });
    expect(m.inserts[0].body).toBe("This one got me today");
    expect((m.inserts[0].highlight as Record<string, string>).summary).toBe("God gave his Son so the world would be saved.");
  });

  it("reports a Circle it's already shared to, without posting twice", async () => {
    m.insertError[A] = { code: "23505", message: "duplicate key value violates unique constraint" };
    m.insertError[B] = { code: "42501", message: "new row violates row-level security policy" };
    expect(await (await send({ highlightId: H, circleIds: [A, B] })).json()).toEqual({ shared: [], already: [A], failed: { [B]: "not_a_member" } });
    expect(m.emailed).toEqual([]);
  });

  it("says when the highlight isn't in the account yet", async () => {
    m.row = null;
    const res = await send({ highlightId: H, circleIds: [A] });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("highlight_not_saved");
  });

  it("refuses a bad request", async () => {
    for (const bad of [{}, { highlightId: "x", circleIds: [A] }, { highlightId: H, circleIds: [] }, { highlightId: H, circleIds: ["nope"] }, { highlightId: H, circleIds: Array(13).fill(0).map((_, i) => `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`) }]) {
      expect((await send(bad)).status).toBe(400);
    }
    expect(m.inserts).toHaveLength(0);
  });
});
