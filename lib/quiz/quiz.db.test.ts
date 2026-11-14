// The Circle Bible challenge (supabase/migrations/0012), checked in a real Postgres.

import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/lib/lamplighters/test-db";

let t: TestDb;
let n = 0;
const email = (name: string) => `${name}.quiz${++n}@example.com`;

beforeAll(async () => {
  t = await createTestDb();
  // A small checked bank in John 3: answer is always choice 1 (index), so tests can tell.
  for (let i = 0; i < 12; i++) {
    await t.admin(
      `insert into public.quiz_questions (id, book, chapter, verse_start, verse_end, difficulty, question, choices, answer, evidence, status)
       values (gen_random_uuid(), 'JHN', 3, 1, 1, $1, $2, array['Peter','Nicodemus','Andrew','Thomas'], 1, 'named Nicodemus', $3)`,
      [i % 2 ? "easy" : "medium", `Who came to Jesus by night? (${i})`, i === 11 ? "draft" : "checked"],
    );
  }
}, 60_000);

async function circle(owner: string) {
  const [row] = await t.as<{ id: string }>(owner, "select public.create_circle('Quiz Night') as id");
  return row.id;
}
async function join(owner: string, circleId: string, name: string) {
  const address = email(name);
  const id = await t.user(address);
  const [{ token }] = await t.as<{ token: string }>(owner, "select * from public.create_invite($1, $2)", [circleId, address]);
  await t.as(id, "select public.accept_invite($1)", [token]);
  return id;
}
const set = async (who: string, c: string, count = 5, difficulty = "mixed") =>
  (await t.as<{ id: string }>(who, `select public.create_quiz_set($1, '{"kind":"chapters","book":"JHN","from":3,"to":3}'::jsonb, $2, $3) as id`, [c, difficulty, count]))[0].id;
const state = async (who: string, game: string) => (await t.as<{ s: Record<string, unknown> }>(who, "select public.quiz_state($1) as s", [game]))[0].s;
const answer = (who: string, game: string, index: number, choice: number) => t.as(who, "select public.quiz_answer($1, $2, $3)", [game, index, choice]);

describe("making a set", () => {
  it("picks checked questions only, never drafts, and needs at least five", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const id = await set(ana, c, 20);
    const [row] = await t.admin<{ n: number }>("select array_length(question_ids, 1) as n from public.quiz_sets where id = $1", [id]);
    expect(row.n).toBe(11); // 12 in the bank, one is a draft
    await expect(t.as(ana, `select public.create_quiz_set($1, '{"kind":"book","book":"GEN"}'::jsonb, 'easy', 5)`, [c])).rejects.toThrow(/not_enough_questions/);
  });

  it("is only for members", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const stranger = await t.user(email("stranger"));
    await expect(set(stranger, c)).rejects.toThrow(/not_a_member/);
  });

  it("never shows anyone the question bank or its answers", async () => {
    const ana = await t.user(email("ana"));
    await expect(t.as(ana, "select * from public.quiz_questions")).rejects.toThrow(/permission denied/);
    await expect(t.as(null, "select * from public.quiz_questions")).rejects.toThrow(/permission denied/);
  });
});

describe("a live game", () => {
  it("runs from lobby to podium, scoring correct and fast answers", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const bob = await join(ana, c, "bob");
    const s = await set(ana, c, 5);
    const [{ game_id: game, code }] = await t.as<{ game_id: string; code: string }>(ana, "select * from public.start_quiz_game($1)", [s]);
    expect(code).toMatch(/^[A-Z2-9]{6}$/);

    // Bob joins with the code (any case), and joining again is fine (a dropped connection).
    expect((await t.as<{ id: string }>(bob, "select public.join_quiz_game($1) as id", [code.toLowerCase()]))[0].id).toBe(game);
    await t.as(bob, "select public.join_quiz_game($1)", [code]);
    expect((await state(bob, game)).players).toHaveLength(2);

    // Only the host starts the game.
    await expect(t.as(bob, "select public.quiz_advance($1)", [game])).rejects.toThrow(/host_only/);
    await t.as(ana, "select public.quiz_advance($1)", [game]);
    const q = await state(bob, game);
    expect(q.state).toBe("question");
    expect((q.question as Record<string, unknown>).answer).toBeUndefined(); // no answer while it's open
    expect((q.question as Record<string, unknown>).choices).toEqual(["Peter", "Nicodemus", "Andrew", "Thomas"]);

    // Right and wrong, once each.
    await answer(ana, game, 0, 1);
    await expect(answer(ana, game, 0, 2)).rejects.toThrow(/already_answered/);
    await answer(bob, game, 0, 3);
    // Everyone answered: it closes by itself, and now the answer shows.
    const r = await state(bob, game);
    expect(r.state).toBe("reveal");
    expect((r.question as Record<string, unknown>).answer).toBe(1);
    expect(r.mine).toMatchObject({ choice: 3, points: 0, correct: false });
    const players = r.players as { user_id: string; score: number }[];
    expect(players[0].user_id).toBe(ana);
    expect(players[0].score).toBeGreaterThan(900); // answered at once: close to 1,000
    expect(players[1].score).toBe(0);

    // A late answer to a closed question is refused.
    await expect(answer(bob, game, 0, 1)).rejects.toThrow(/question_closed/);

    // Moving on while a question is open is refused; the host closes each one first.
    await t.as(ana, "select public.quiz_advance($1)", [game]);
    await expect(t.as(ana, "select public.quiz_advance($1)", [game])).rejects.toThrow(/not_now/);
    for (let i = 1; i < 5; i++) {
      await t.as(ana, "select public.quiz_reveal($1)", [game]);
      await t.as(ana, "select public.quiz_advance($1)", [game]);
    }
    expect((await state(ana, game)).state).toBe("finished");
  });

  it("scores by the database's clock: slower answers earn less, late ones nothing", async () => {
    expect((await t.admin<{ p: number }>("select public.quiz_points(true, 0, 20) as p"))[0].p).toBe(1000);
    expect((await t.admin<{ p: number }>("select public.quiz_points(true, 10, 20) as p"))[0].p).toBe(750);
    expect((await t.admin<{ p: number }>("select public.quiz_points(true, 20, 20) as p"))[0].p).toBe(500);
    expect((await t.admin<{ p: number }>("select public.quiz_points(true, 22, 20) as p"))[0].p).toBe(0);
    expect((await t.admin<{ p: number }>("select public.quiz_points(false, 1, 20) as p"))[0].p).toBe(0);
  });

  it("keeps going when the host leaves: anyone can close a question once time is up, and move on after 45 seconds", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const bob = await join(ana, c, "bob");
    const s = await set(ana, c, 5);
    const [{ game_id: game, code }] = await t.as<{ game_id: string; code: string }>(ana, "select * from public.start_quiz_game($1)", [s]);
    await t.as(bob, "select public.join_quiz_game($1)", [code]);
    await t.as(ana, "select public.quiz_advance($1)", [game]);
    await expect(t.as(bob, "select public.quiz_reveal($1)", [game])).rejects.toThrow(/not_yet/);
    // Time runs out (moved back by hand here).
    await t.admin("update public.quiz_games set question_started_at = now() - interval '30 seconds' where id = $1", [game]);
    await t.as(bob, "select public.quiz_reveal($1)", [game]);
    await expect(t.as(bob, "select public.quiz_advance($1)", [game])).rejects.toThrow(/host_only/);
    await t.admin("update public.quiz_games set changed_at = now() - interval '1 minute' where id = $1", [game]);
    await t.as(bob, "select public.quiz_advance($1)", [game]);
    expect((await state(bob, game)).index).toBe(1);
  });

  it("lets only the Circle's members join or see it", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const s = await set(ana, c, 5);
    const [{ game_id: game, code }] = await t.as<{ game_id: string; code: string }>(ana, "select * from public.start_quiz_game($1)", [s]);
    const stranger = await t.user(email("stranger"));
    await expect(t.as(stranger, "select public.join_quiz_game($1)", [code])).rejects.toThrow(/game_not_found/);
    await expect(state(stranger, game)).rejects.toThrow(/game_not_found/);
    expect(await t.as(stranger, "select * from public.quiz_games where id = $1", [game])).toHaveLength(0);
    await expect(answer(stranger, game, 0, 1)).rejects.toThrow(/not_a_player/);
  });
});

describe("on your own time", () => {
  it("times each question from when it's shown, and compares scores in the Circle", async () => {
    const ana = await t.user(email("ana"));
    const c = await circle(ana);
    const bob = await join(ana, c, "bob");
    const s = await set(ana, c, 5);
    const next = async (who: string) => (await t.as<{ j: Record<string, unknown> }>(who, "select public.quiz_async_next($1) as j", [s]))[0].j;
    const reply = async (who: string, i: number, choice: number | null) => (await t.as<{ j: Record<string, unknown> }>(who, "select public.quiz_async_answer($1, $2, $3) as j", [s, i, choice]))[0].j;

    const first = await next(ana);
    expect((first.question as Record<string, unknown>).answer).toBeUndefined();
    expect((await next(ana)).shown_at).toBe(first.shown_at); // asking again doesn't restart the clock
    const r = await reply(ana, 0, 1);
    expect(r).toMatchObject({ correct: true, answer: 1, evidence: "named Nicodemus" });
    await expect(reply(ana, 0, 1)).rejects.toThrow(/question_closed/); // once
    for (let i = 1; i < 5; i++) {
      await next(ana);
      await reply(ana, i, i === 4 ? null : 1); // the last one: time ran out
    }
    expect(await next(ana)).toMatchObject({ done: true });

    await next(bob);
    await reply(bob, 0, 0);
    const scores = await t.as<{ name: string; score: number; finished: boolean; answered: number }>(bob, "select * from public.quiz_set_scores($1)", [s]);
    expect(scores.map((x) => [x.finished, x.answered])).toEqual([[true, 5], [false, 1]]);
    expect(scores[0].score).toBeGreaterThan(3000);
    expect(scores[1].score).toBe(0);

    const list = await t.as<{ set_id: string; question_count: number; players: number }>(bob, "select * from public.circle_quiz_sets($1)", [c]);
    expect(list[0]).toMatchObject({ set_id: s, question_count: 5, players: 2 });
  });
});
