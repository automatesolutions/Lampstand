// Lamplighters rules, checked in a real Postgres against supabase/migrations.

import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./test-db";

let t: TestDb;
let n = 0;
/** A fresh email address per test, so tests don't share rate limits or members. */
const email = (name: string) => `${name}.${++n}@example.com`;

beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

async function circle(owner: string, kind: "circle" | "pair" = "circle") {
  const [row] = await t.as<{ id: string }>(owner, "select public.create_circle('Morning Lamps', 'Psalms together', $1) as id", [kind]);
  return row.id;
}

async function invite(from: string, circleId: string, to: string) {
  const [row] = await t.as<{ invite_id: string; token: string }>(from, "select * from public.create_invite($1, $2)", [circleId, to]);
  return row;
}

async function join(owner: string, circleId: string, name: string) {
  const address = email(name);
  const id = await t.user(address);
  const { token } = await invite(owner, circleId, address);
  await t.as(id, "select public.accept_invite($1)", [token]);
  return id;
}

const readToday = (userId: string) =>
  t.admin("insert into public.chapter_reads (user_id, book, chapter, version, read_on) values ($1, 'JHN', 1, 'KJV', (now() at time zone 'UTC')::date)", [userId]);

describe("invites", () => {
  it("lets the invited email join with the token", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const bobEmail = email("bob");
    const bob = await t.user(bobEmail);
    const { token } = await invite(owner, c, bobEmail.toUpperCase());

    const [preview] = await t.as(null, "select * from public.invite_preview($1)", [token]);
    expect(preview).toMatchObject({ circle_name: "Morning Lamps", status: "pending" });
    expect(String(preview.email_hint)).toMatch(/^b•••@example\.com$/);

    const [joined] = await t.as<{ id: string }>(bob, "select public.accept_invite($1) as id", [token]);
    expect(joined.id).toBe(c);
    const people = await t.as(bob, "select user_id, role from public.circle_people($1)", [c]);
    expect(people).toEqual(expect.arrayContaining([{ user_id: owner, role: "owner" }, { user_id: bob, role: "member" }]));
  });

  it("refuses a different email, an expired token, a revoked token and an old token after resending", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const bobEmail = email("bob");
    const bob = await t.user(bobEmail);
    const carol = await t.user(email("carol"));

    const first = await invite(owner, c, bobEmail);
    await expect(t.as(carol, "select public.accept_invite($1)", [first.token])).rejects.toThrow("invite_wrong_email");
    await expect(t.as(bob, "select public.accept_invite($1)", [first.token + "x"])).rejects.toThrow("invite_invalid");
    await expect(t.as(null, "select public.accept_invite($1)", [first.token])).rejects.toThrow();

    const [resent] = await t.as<{ token: string }>(owner, "select * from public.resend_invite($1)", [first.invite_id]);
    expect(resent.token).not.toBe(first.token);
    await expect(t.as(bob, "select public.accept_invite($1)", [first.token])).rejects.toThrow("invite_invalid");

    await t.admin("update public.invites set expires_at = now() - interval '1 minute' where id = $1", [first.invite_id]);
    await expect(t.as(bob, "select public.accept_invite($1)", [resent.token])).rejects.toThrow("invite_expired");

    const again = await invite(owner, c, bobEmail);
    await t.as(owner, "select public.revoke_invite($1)", [again.invite_id]);
    await expect(t.as(bob, "select public.accept_invite($1)", [again.token])).rejects.toThrow("invite_invalid");
  });

  it("never stores or shows the token", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const { token } = await invite(owner, c, email("bob"));
    const [stored] = await t.admin<{ found: number }>("select count(*)::int as found from public.invites where token_hash::text like '%' || $1 || '%'", [token]);
    expect(stored.found).toBe(0);
    await expect(t.as(owner, "select token_hash from public.invites")).rejects.toThrow(/permission denied/);
    const mine = await t.as(owner, "select email, status from public.invites where circle_id = $1", [c]);
    expect(mine).toHaveLength(1);
  });

  it("caps a Circle at its size, counting pending invites", async () => {
    const owner = await t.user(email("ana"));
    const pair = await circle(owner, "pair");
    await invite(owner, pair, email("bob"));
    await expect(invite(owner, pair, email("carol"))).rejects.toThrow("circle_full");

    const [limit] = await t.admin<{ max: number }>("select max_members as max from public.circles where id = $1", [await circle(owner)]);
    expect(limit.max).toBe(12);
  });

  it("refuses guests without an account", async () => {
    await expect(t.as(null, "select public.create_circle('Guests')")).rejects.toThrow();
  });
});

describe("permissions", () => {
  it("keeps a Circle's data from non-members", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const bob = await join(owner, c, "bob");
    await t.as(owner, "insert into public.messages (circle_id, sender_id, body) values ($1, $2, 'Psalm 23 today?')", [c, owner]);
    await t.as(owner, "select public.share_progress('milestone', '{\"type\":\"streak\",\"value\":3}')");

    const stranger = await t.user(email("eve"));
    for (const table of ["circles", "circle_members", "messages", "activity", "invites", "nudges", "reactions"]) {
      const rows = await t.as(stranger, `select * from public.${table}`).catch(() => []);
      expect(rows, table).toHaveLength(0);
    }
    expect(await t.as(stranger, "select * from public.my_circles()")).toHaveLength(0);
    await expect(t.as(stranger, "select * from public.circle_people($1)", [c])).rejects.toThrow("not_a_member");
    await expect(t.as(stranger, "insert into public.messages (circle_id, sender_id, body) values ($1, $2, 'hi')", [c, stranger])).rejects.toThrow(/row-level security/);
    await expect(invite(stranger, c, email("x"))).rejects.toThrow("not_a_member");
    await expect(t.as(stranger, "select * from public.send_nudge($1, $2, 'Time to light your lamp!')", [c, bob])).rejects.toThrow("not_a_member");
    await expect(t.as(stranger, "select public.lamp_rate($1, 'nudge', 3, interval '1 day')", [bob])).rejects.toThrow(/permission denied/);
    // Signed out sees nothing either.
    expect(await t.as(null, "select * from public.circles").catch(() => [])).toHaveLength(0);

    // Members do see it.
    expect(await t.as(bob, "select body from public.messages where circle_id = $1", [c])).toEqual([{ body: "Psalm 23 today?" }]);
  });

  it("can't post as someone else, and only owners delete others' messages", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const bob = await join(owner, c, "bob");
    const carol = await join(owner, c, "carol");
    await expect(t.as(bob, "insert into public.messages (circle_id, sender_id, body) values ($1, $2, 'fake')", [c, owner])).rejects.toThrow(/row-level security/);

    const [m] = await t.as<{ id: string }>(bob, "insert into public.messages (circle_id, sender_id, body) values ($1, $2, 'hello') returning id", [c, bob]);
    await expect(t.as(carol, "select public.delete_message($1)", [m.id])).rejects.toThrow("not_allowed");
    await t.as(owner, "select public.delete_message($1)", [m.id]);
    const [gone] = await t.as(bob, "select body, deleted_at is not null as deleted from public.messages where id = $1", [m.id]);
    expect(gone).toEqual({ body: null, deleted: true });
  });

  it("hides a blocked person's messages from the blocker only", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const bob = await join(owner, c, "bob");
    await t.as(bob, "insert into public.messages (circle_id, sender_id, body) values ($1, $2, 'rude')", [c, bob]);
    await t.as(owner, "insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [owner, bob]);
    expect(await t.as(owner, "select * from public.messages where circle_id = $1", [c])).toHaveLength(0);
    expect(await t.as(bob, "select * from public.messages where circle_id = $1", [c])).toHaveLength(1);
  });

  it("shares only what each person chose, and emails only by choice", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const bob = await join(owner, c, "bob");
    await t.admin("insert into public.user_streaks (user_id, current, longest, last_met_on) values ($1, 5, 5, (now() at time zone 'UTC')::date)", [bob]);
    await readToday(bob);

    const look = async () => (await t.as(owner, "select read_today, streak, chapters_week, email from public.circle_people($1) where user_id = $2", [c, bob]))[0];
    expect(await look()).toEqual({ read_today: true, streak: null, chapters_week: null, email: null });
    await t.as(bob, "update public.profiles set share_level = 'streaks' where id = $1", [bob]);
    expect(await look()).toMatchObject({ streak: 5, chapters_week: null });
    await t.as(bob, "update public.profiles set share_level = 'chapters', show_email = true where id = $1", [bob]);
    expect(await look()).toMatchObject({ streak: 5, chapters_week: 1, email: expect.stringContaining("bob") });

    // Chapter posts follow the same choice.
    await t.as(bob, "update public.profiles set share_level = 'none' where id = $1", [bob]);
    const [none] = await t.as<{ n: number }>(bob, "select public.share_progress('chapter', '{\"book\":\"PSA\",\"chapter\":23}') as n");
    expect(none.n).toBe(0);
    await expect(t.as(bob, "select public.share_progress('chapter', '{\"book\":\"<b>\",\"chapter\":1}')")).rejects.toThrow("bad_data");
  });

  it("passes ownership on when the owner leaves, and removes an empty Circle", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const bob = await join(owner, c, "bob");
    const carol = await join(owner, c, "carol");
    await expect(t.as(carol, "delete from public.circle_members where circle_id = $1 and user_id = $2 returning user_id", [c, bob])).resolves.toHaveLength(0);

    await t.as(owner, "delete from public.circle_members where circle_id = $1 and user_id = $2", [c, owner]);
    const [role] = await t.as(bob, "select role from public.circle_members where circle_id = $1 and user_id = $2", [c, bob]);
    expect(role).toEqual({ role: "owner" });

    await t.as(bob, "delete from public.circle_members where circle_id = $1 and user_id = $2", [c, carol]);
    await t.as(bob, "delete from public.circle_members where circle_id = $1 and user_id = $2", [c, bob]);
    expect(await t.admin("select * from public.circles where id = $1", [c])).toHaveLength(0);
  });
});

describe("nudge limits", () => {
  const nudge = (from: string, c: string, to: string | null) =>
    t.as<{ sent: number }>(from, "select public.send_nudge($1, $2, 'Time to light your lamp!', 'Psalm 1?') as sent", [c, to]).then((r) => r[0].sent);
  const inbox = (who: string) => t.as(who, "select sender_name, message, note from public.my_nudges()");

  it("allows one nudge a day to the same person, and three a day in all", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const [b, cc, d, e] = [await join(owner, c, "bob"), await join(owner, c, "carol"), await join(owner, c, "dan"), await join(owner, c, "eve")];

    expect(await nudge(owner, c, b)).toBe(1);
    expect(await inbox(b)).toHaveLength(1);
    await expect(nudge(owner, c, b)).rejects.toThrow("already_nudged");
    await nudge(owner, c, cc);
    await nudge(owner, c, d);
    await expect(nudge(owner, c, e)).rejects.toThrow("rate_limited:nudge");

    // A day later, it's allowed again.
    await t.admin("update public.nudges set created_at = created_at - interval '25 hours' where sender_id = $1", [owner]);
    await t.admin("update public.rate_events set created_at = created_at - interval '25 hours' where user_id = $1", [owner]);
    expect(await nudge(owner, c, b)).toBe(1);
    expect(await inbox(b)).toHaveLength(2);
  });

  it("doesn't nudge someone who already read today", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const bob = await join(owner, c, "bob");
    const carol = await join(owner, c, "carol");
    await readToday(bob);
    await expect(nudge(owner, c, bob)).rejects.toThrow("already_read");

    // A Circle nudge reaches only those who haven't read.
    expect(await nudge(owner, c, null)).toBe(1);
    expect(await inbox(carol)).toHaveLength(1);
    expect(await inbox(bob)).toHaveLength(0);
    await expect(nudge(owner, c, null)).rejects.toThrow("nobody_to_nudge");
    await expect(nudge(owner, c, owner)).rejects.toThrow("nudge_self");
  });

  it("skips muted senders quietly, and the recipient never sees them", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const bob = await join(owner, c, "bob");
    const carol = await join(owner, c, "carol");
    await t.as(bob, "insert into public.nudge_mutes (user_id, muted_user_id) values ($1, $2)", [bob, owner]);
    await t.as(carol, "insert into public.nudge_mutes (user_id, muted_circle_id) values ($1, $2)", [carol, c]);

    // The sender gets the same answers as if it were delivered.
    expect(await nudge(owner, c, bob)).toBe(1);
    await expect(nudge(owner, c, bob)).rejects.toThrow("already_nudged");
    expect(await inbox(bob)).toHaveLength(0);
    expect(await t.as(bob, "select * from public.nudges")).toHaveLength(0);
    expect(await nudge(owner, c, carol)).toBe(1);
    expect(await inbox(carol)).toHaveLength(0);

    const dan = await join(owner, c, "dan");
    await nudge(bob, c, dan);
    expect(await inbox(dan)).toEqual([{ sender_name: "Lamplighter", message: "Time to light your lamp!", note: "Psalm 1?" }]);
    // Senders can't read nudges back (that would reveal a mute).
    expect(await t.as(bob, "select * from public.nudges")).toHaveLength(0);
  });
});

describe("chat limits", () => {
  it("cleans messages and limits them to 20 a minute", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const [m] = await t.as<{ body: string }>(owner, "insert into public.messages (circle_id, sender_id, body) values ($1, $2, $3) returning body", [c, owner, "  hi\u0007 there\n🙏  "]);
    expect(m.body).toBe("hi  there\n🙏");
    await expect(t.as(owner, "insert into public.messages (circle_id, sender_id, body) values ($1, $2, '   ')", [c, owner])).rejects.toThrow("message_required");
    for (let i = 0; i < 19; i++) await t.as(owner, "insert into public.messages (circle_id, sender_id, body) values ($1, $2, 'x')", [c, owner]);
    await expect(t.as(owner, "insert into public.messages (circle_id, sender_id, body) values ($1, $2, 'x')", [c, owner])).rejects.toThrow("rate_limited:message_minute");
  });
});

describe("notifications", () => {
  const nudge = (from: string, c: string, to: string | null, note: string | null = "Psalm 1?") =>
    t.as<{ sent: number }>(from, "select public.send_nudge($1, $2, 'Time to light your lamp!', $3) as sent", [c, to, note]).then((r) => r[0].sent);
  const say = (from: string, c: string, body: string) =>
    t.as<{ id: string }>(from, "insert into public.messages (circle_id, sender_id, body) values ($1, $2, $3) returning id", [c, from, body]).then((r) => r[0].id);
  const feed = (who: string) => t.as<{ kind: string; body: string; sender_id: string; read_at: string | null }>(who, "select kind, body, sender_id, read_at from public.my_notifications()");
  const claim = (sender: string, c: string, message: string | null = null) =>
    t.admin<{ email: string; kind: string; body: string; note: string | null; circle_name: string; sender_name: string }>(
      "select * from public.claim_notification_emails($1, $2, $3)",
      [sender, c, message],
    );
  const emailOn = (who: string, col: "nudge_email" | "message_email") => t.admin(`update public.profiles set ${col} = true where id = $1`, [who]);

  it("notifies every other member of a chat message, never the sender, and skips muted and blocked people", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const [bob, carol, dan] = [await join(owner, c, "bob"), await join(owner, c, "carol"), await join(owner, c, "dan")];
    await t.as(carol, "insert into public.nudge_mutes (user_id, muted_user_id) values ($1, $2)", [carol, owner]);
    await t.as(dan, "insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [dan, owner]);

    await say(owner, c, "Psalm 23 tonight?");
    expect(await feed(bob)).toEqual([{ kind: "message", body: "Psalm 23 tonight?", sender_id: owner, read_at: null }]);
    expect(await feed(owner)).toHaveLength(0);
    expect(await feed(carol)).toHaveLength(0);
    expect(await feed(dan)).toHaveLength(0);
    // Nobody else can read them, not even the sender.
    expect(await t.as(owner, "select * from public.notifications")).toHaveLength(0);
    await expect(t.as(bob, "insert into public.notifications (user_id, kind, circle_id, sender_id) values ($1, 'nudge', $2, $3)", [bob, c, owner])).rejects.toThrow();

    // Opening the chat marks them read.
    await t.as(bob, "update public.circle_members set last_read_message_at = now() where circle_id = $1 and user_id = $2", [c, bob]);
    expect((await feed(bob))[0].read_at).not.toBeNull();
  });

  it("notifies one person for a direct nudge, and only the people a Circle nudge reached", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const [bob, carol, dan, eve] = [await join(owner, c, "bob"), await join(owner, c, "carol"), await join(owner, c, "dan"), await join(owner, c, "eve")];
    await readToday(dan);
    await t.as(eve, "insert into public.nudge_mutes (user_id, muted_circle_id) values ($1, $2)", [eve, c]);

    expect(await nudge(owner, c, bob)).toBe(1);
    expect((await feed(bob)).map((n) => n.kind)).toEqual(["nudge"]);
    expect(await feed(carol)).toHaveLength(0);

    // Bob had a nudge today and Dan already read: only Carol (Eve muted the Circle).
    await nudge(owner, c, null);
    expect(await feed(carol)).toHaveLength(1);
    expect(await feed(bob)).toHaveLength(1);
    expect(await feed(dan)).toHaveLength(0);
    expect(await feed(eve)).toHaveLength(0);

    // Opening the notification marks the nudge read too.
    await t.as(carol, "update public.notifications set read_at = now() where user_id = $1", [carol]);
    const [n] = await t.as<{ read_at: string | null }>(carol, "select read_at from public.my_nudges()");
    expect(n.read_at).not.toBeNull();
  });

  it("claims emails once, only for people who turned them on, for one person and for the Circle", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const [bob, carol, dan] = [await join(owner, c, "bob"), await join(owner, c, "carol"), await join(owner, c, "dan")];
    await t.admin("update public.profiles set display_name = 'Ana' where id = $1", [owner]);
    await emailOn(bob, "nudge_email");
    await emailOn(carol, "nudge_email");
    await emailOn(carol, "message_email");
    await t.as(dan, "insert into public.nudge_mutes (user_id, muted_user_id) values ($1, $2)", [dan, owner]);
    await emailOn(dan, "nudge_email");

    // One person.
    await nudge(owner, c, bob, null);
    const one = await claim(owner, c);
    expect(one).toEqual([expect.objectContaining({ kind: "nudge", email: expect.stringContaining("bob"), body: "Time to light your lamp!", note: null, circle_name: "Morning Lamps", sender_name: "Ana" })]);
    expect(await claim(owner, c)).toHaveLength(0); // retried: nothing twice

    // The whole Circle: Bob was already nudged; Dan muted Ana (skipped, never emailed).
    await nudge(owner, c, null);
    const all = await claim(owner, c);
    expect(all.map((r) => r.email)).toEqual([expect.stringContaining("carol")]);
    expect(all[0].note).toBe("Psalm 1?");
    expect(await claim(owner, c)).toHaveLength(0);

    // Chat: only Carol wants message emails, and never the sender.
    const m = await say(owner, c, "Who's in for John 1?");
    const chat = await claim(owner, c, m);
    expect(chat).toEqual([expect.objectContaining({ kind: "message", email: expect.stringContaining("carol"), body: "Who's in for John 1?" })]);
    expect(await claim(owner, c, m)).toHaveLength(0);
    const bobsMessage = await say(bob, c, "Me!");
    expect((await claim(bob, c, bobsMessage)).map((r) => r.email)).toEqual([expect.stringContaining("carol")]);

    // Only the server may claim.
    await expect(t.as(owner, "select * from public.claim_notification_emails($1, $2, null)", [owner, c])).rejects.toThrow(/permission denied/);
  });

  it("sends a failed message email again with the sender's next message", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const other = await circle(owner);
    const bob = await join(owner, c, "bob");
    await emailOn(bob, "message_email");
    const unsend = (ids: string[]) => t.admin("update public.notifications set emailed_at = null where id = any($1::uuid[])", [ids]); // what notify.ts does when sending fails

    // The first email fails to send.
    const first = await say(owner, c, "Psalm 1 tonight?");
    const failed = await t.admin<{ id: string }>("select id from public.notifications where message_id = $1", [first]);
    expect(await claim(owner, c, first)).toHaveLength(1);
    await unsend(failed.map((r) => r.id));

    // A message in another Circle doesn't pick it up, and neither does Bob's own message.
    const elsewhere = await say(owner, other, "Hi other Circle");
    expect((await claim(owner, other, elsewhere)).map((r) => r.body)).toEqual([]);
    const bobs = await say(bob, c, "Yes!");
    expect(await claim(bob, c, bobs)).toHaveLength(0); // the owner turned message emails off

    // Ana's next message sends both, oldest first, and neither again.
    const second = await say(owner, c, "Starting at 8");
    expect((await claim(owner, c, second)).map((r) => r.body)).toEqual(["Psalm 1 tonight?", "Starting at 8"]);
    expect(await claim(owner, c, second)).toHaveLength(0);

    // A failed email for a message that was then deleted is skipped.
    const oops = await say(owner, c, "wrong chat");
    const oopsRows = await t.admin<{ id: string }>("select id from public.notifications where message_id = $1", [oops]);
    expect(await claim(owner, c, oops)).toHaveLength(1);
    await unsend(oopsRows.map((r) => r.id));
    await t.as(owner, "select public.delete_message($1)", [oops]);
    // And one that failed more than an hour ago is left alone.
    const stale = await say(owner, c, "Yesterday's plan");
    const staleRows = await t.admin<{ id: string }>("select id from public.notifications where message_id = $1", [stale]);
    expect(await claim(owner, c, stale)).toHaveLength(1);
    await unsend(staleRows.map((r) => r.id));
    await t.admin("update public.notifications set created_at = now() - interval '2 hours' where id = any($1::uuid[])", [staleRows.map((r) => r.id)]);

    const third = await say(owner, c, "See you there");
    expect((await claim(owner, c, third)).map((r) => r.body)).toEqual(["See you there"]);
  });

  it("hides deleted messages and people blocked later", async () => {
    const owner = await t.user(email("ana"));
    const c = await circle(owner);
    const bob = await join(owner, c, "bob");
    const m = await say(owner, c, "oops");
    await say(owner, c, "hello");
    await t.as(owner, "select public.delete_message($1)", [m]);
    expect((await feed(bob)).map((n) => n.body)).toEqual(["hello"]);
    await t.as(bob, "insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [bob, owner]);
    expect(await feed(bob)).toHaveLength(0);
  });
});
