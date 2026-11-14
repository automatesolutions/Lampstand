// Sharing highlights to a Circle (supabase/migrations/0011), checked in a real Postgres.

import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./test-db";

let t: TestDb;
let n = 0;
const email = (name: string) => `${name}.share${++n}@example.com`;

beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

async function circle(owner: string) {
  const [row] = await t.as<{ id: string }>(owner, "select public.create_circle('Morning Lamps') as id");
  return row.id;
}
async function join(owner: string, circleId: string, name: string) {
  const address = email(name);
  const id = await t.user(address);
  const [{ token }] = await t.as<{ token: string }>(owner, "select * from public.create_invite($1, $2)", [circleId, address]);
  await t.as(id, "select public.accept_invite($1)", [token]);
  return id;
}
async function highlight(user: string, start = 16, end = 18, color = "gold") {
  const [row] = await t.as<{ id: string }>(user, "insert into public.highlights (user_id, book, chapter, verse_start, verse_end, color) values ($1, 'JHN', 3, $2, $3, $4) returning id", [user, start, end, color]);
  return row.id;
}
const card = (extra: Record<string, unknown> = {}) => JSON.stringify({ ref: "John 3:16–18", text: "For God so loved the world...", ...extra });
async function share(user: string, circleId: string, highlightId: string, highlightJson = card(), body: string | null = null) {
  const [row] = await t.as<{ id: string; highlight: Record<string, unknown> }>(
    user,
    "insert into public.messages (circle_id, sender_id, body, highlight_id, highlight) values ($1, $2, $3, $4, $5::jsonb) returning id, highlight",
    [circleId, user, body, highlightId, highlightJson],
  );
  return row;
}
const shares = (who: string, circleId: string) => t.as<{ id: string; highlight: Record<string, unknown> | null }>(who, "select id, highlight from public.messages where circle_id = $1 and highlight_id is not null", [circleId]);

describe("sharing a highlight", () => {
  it("shows it to members only, and notifies the others", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const bob = await join(ana, c, "bob");
    const stranger = await t.user(email("stranger"));
    const h = await highlight(ana);
    await share(ana, c, h, card(), "This one got me today");

    expect(await shares(bob, c)).toHaveLength(1);
    expect(await shares(stranger, c)).toHaveLength(0);
    const [note] = await t.as<{ kind: string; body: string; verse_ref: string }>(bob, "select kind, body, verse_ref from public.my_notifications()");
    expect(note).toEqual({ kind: "message", body: "This one got me today", verse_ref: "John 3:16–18" });
  });

  it("takes the verses and color from the highlight, not from what was sent", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const h = await highlight(ana, 16, 18, "sage");
    const { highlight: saved } = await share(ana, c, h, card({ color: "rose", verse_start: 1, verse_end: 99, summary: "  A short summary.  " }));
    expect(saved).toMatchObject({ color: "sage", book: "JHN", chapter: 3, verse_start: 16, verse_end: 18, summary: "A short summary." });
  });

  it("refuses someone else's highlight, a missing card, or a Circle you're not in", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const bob = await join(ana, c, "bob");
    const anas = await highlight(ana);
    await expect(share(bob, c, anas)).rejects.toThrow(/bad_highlight/);
    const bobs = await highlight(bob);
    await expect(t.as(bob, "insert into public.messages (circle_id, sender_id, highlight_id) values ($1, $2, $3)", [c, bob, bobs])).rejects.toThrow();
    const elsewhere = await circle(await t.user(email("carol")));
    await expect(share(bob, elsewhere, bobs)).rejects.toThrow();
  });

  it("shares a highlight once per Circle", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const h = await highlight(ana);
    await share(ana, c, h);
    await expect(share(ana, c, h)).rejects.toThrow(/duplicate|unique/);
  });
});

describe("the share follows its highlight", () => {
  it("goes away with the highlight, and so does its notification", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const bob = await join(ana, c, "bob");
    const h = await highlight(ana);
    await share(ana, c, h);
    await t.as(ana, "delete from public.highlights where id = $1", [h]);
    expect(await shares(bob, c)).toHaveLength(0);
    expect(await t.as(bob, "select * from public.my_notifications()")).toHaveLength(0);
  });

  it("goes away when the highlight covers other verses, and keeps up with a new color", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const bob = await join(ana, c, "bob");
    const h = await highlight(ana, 16, 18, "gold");
    await share(ana, c, h);
    await t.as(ana, "update public.highlights set color = 'rose' where id = $1", [h]);
    expect((await shares(bob, c))[0].highlight?.color).toBe("rose");
    await t.as(ana, "update public.highlights set verse_end = 17 where id = $1", [h]);
    expect(await shares(bob, c)).toHaveLength(0);
  });

  it("goes away, without an error, when sync gives the highlight row a new id", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const h = await highlight(ana, 16, 16);
    await share(ana, c, h);
    // What lib/sync does: upsert on the first verse, with this device's id.
    await t.as(ana, "insert into public.highlights (id, user_id, book, chapter, verse_start, verse_end, color) values (gen_random_uuid(), $1, 'JHN', 3, 16, 16, 'gold') on conflict (user_id, book, chapter, verse_start) do update set id = excluded.id", [ana]);
    expect(await shares(ana, c)).toHaveLength(0);
  });

  it("goes away when its sharer leaves the Circle, and so does their auto-share choice", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const bob = await join(ana, c, "bob");
    const h = await highlight(bob);
    await share(bob, c, h);
    await t.as(bob, "insert into public.highlight_auto_share (user_id, circle_id) values ($1, $2)", [bob, c]);
    await t.as(bob, "delete from public.circle_members where circle_id = $1 and user_id = $2", [c, bob]);
    expect(await shares(ana, c)).toHaveLength(0);
    expect(await t.admin("select * from public.highlight_auto_share where user_id = $1", [bob])).toHaveLength(0);
  });

  it("is erased when the message is deleted", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const h = await highlight(ana);
    const { id } = await share(ana, c, h);
    await t.as(ana, "select public.delete_message($1)", [id]);
    const [row] = await t.admin<{ highlight: unknown; highlight_id: unknown; deleted_at: unknown }>("select highlight, highlight_id, deleted_at from public.messages where id = $1", [id]);
    expect(row.highlight).toBeNull();
    expect(row.highlight_id).toBeNull();
    expect(row.deleted_at).not.toBeNull();
    // Shared again afterwards: allowed (the old one is gone).
    await share(ana, c, h);
  });
});

describe("auto-share choices", () => {
  it("are private, and only for Circles you're in", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const bob = await join(ana, c, "bob");
    await t.as(ana, "insert into public.highlight_auto_share (user_id, circle_id) values ($1, $2)", [ana, c]);
    expect(await t.as(bob, "select * from public.highlight_auto_share")).toHaveLength(0);
    const elsewhere = await circle(await t.user(email("carol")));
    await expect(t.as(ana, "insert into public.highlight_auto_share (user_id, circle_id) values ($1, $2)", [ana, elsewhere])).rejects.toThrow();
    await expect(t.as(bob, "insert into public.highlight_auto_share (user_id, circle_id) values ($1, $2)", [ana, c])).rejects.toThrow();
  });
});
