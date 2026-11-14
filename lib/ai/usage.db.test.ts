// Daily usage limits (supabase/migrations/0009), checked in a real Postgres.

import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/lib/lamplighters/test-db";

let t: TestDb;
let n = 0;
const fresh = (name: string) => `${name}-${++n}`;

beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

/** use_quota as the server (secret key): null = allowed, else the full scope. */
async function use(feature: string, checks: { scope: string; subject: string; max: number }[], amount = 1) {
  const [row] = await t.admin<{ full: string | null }>("select public.use_quota($1, $2::jsonb, $3) as full", [feature, JSON.stringify(checks), amount]);
  return row.full;
}

async function amountOf(feature: string, scope: string, subject: string) {
  const rows = await t.admin<{ amount: string }>(
    "select amount from public.usage_counters where day = (now() at time zone 'utc')::date and feature = $1 and scope = $2 and subject = $3",
    [feature, scope, subject],
  );
  return rows.length ? Number(rows[0].amount) : 0;
}

describe("use_quota", () => {
  it("allows up to the limit, then names the full scope", async () => {
    const user = fresh("user");
    const checks = [{ scope: "user", subject: user, max: 3 }];
    expect(await use("song", checks)).toBeNull();
    expect(await use("song", checks)).toBeNull();
    expect(await use("song", checks)).toBeNull();
    expect(await use("song", checks)).toBe("user");
    expect(await amountOf("song", "user", user)).toBe(3);
  });

  it("counts nothing anywhere when one limit is full", async () => {
    const [a, b, app] = [fresh("a"), fresh("b"), fresh("app")];
    // The app-wide limit is 1: the first person takes it.
    expect(await use("song", [{ scope: "user", subject: a, max: 3 }, { scope: "app", subject: app, max: 1 }])).toBeNull();
    // The second person has room, the app doesn't: refused, and their count stays at 0.
    expect(await use("song", [{ scope: "user", subject: b, max: 3 }, { scope: "app", subject: app, max: 1 }])).toBe("app");
    expect(await amountOf("song", "user", b)).toBe(0);
  });

  it("keeps features apart", async () => {
    const user = fresh("user");
    expect(await use("song", [{ scope: "user", subject: user, max: 1 }])).toBeNull();
    expect(await use("song_audio", [{ scope: "user", subject: user, max: 1 }])).toBeNull();
    expect(await use("song", [{ scope: "user", subject: user, max: 1 }])).toBe("user");
  });

  it("counts units, such as characters, and refuses what wouldn't fit", async () => {
    const user = fresh("user");
    expect(await use("narration", [{ scope: "user", subject: user, max: 10_000 }], 6000)).toBeNull();
    expect(await use("narration", [{ scope: "user", subject: user, max: 10_000 }], 5000)).toBe("user");
    expect(await use("narration", [{ scope: "user", subject: user, max: 10_000 }], 4000)).toBeNull();
    expect(await amountOf("narration", "user", user)).toBe(10_000);
  });

  it("gives a use back with release_quota, never below zero", async () => {
    const user = fresh("user");
    const checks = [{ scope: "user", subject: user, max: 1 }];
    expect(await use("song", checks)).toBeNull();
    await t.admin("select public.release_quota('song', $1::jsonb)", [JSON.stringify(checks)]);
    await t.admin("select public.release_quota('song', $1::jsonb)", [JSON.stringify(checks)]);
    expect(await amountOf("song", "user", user)).toBe(0);
    expect(await use("song", checks)).toBeNull();
  });

  it("rejects bad input", async () => {
    await expect(use("song", [])).rejects.toThrow(/bad_checks/);
    await expect(use("song", [{ scope: "user", subject: "x", max: -1 }])).rejects.toThrow(/bad_checks/);
    await expect(use("song", [{ scope: "user", subject: "x", max: 1 }], 0)).rejects.toThrow(/bad_amount/);
    await expect(use("Not A Feature", [{ scope: "user", subject: "x", max: 1 }])).rejects.toThrow();
    await expect(use("song", [{ scope: "planet", subject: "x", max: 1 }])).rejects.toThrow();
  });
});

describe("usage_counters is server only", () => {
  it("can't be read or changed from a browser, signed in or not", async () => {
    const someone = await t.user(`${fresh("reader")}@example.com`);
    for (const who of [null, someone]) {
      await expect(t.as(who, "select * from public.usage_counters")).rejects.toThrow(/permission denied/);
      await expect(t.as(who, "insert into public.usage_counters (day, feature, scope, subject) values (current_date, 'song', 'app', 'all')")).rejects.toThrow(/permission denied/);
      await expect(t.as(who, `select public.use_quota('song', '[{"scope":"app","subject":"all","max":99}]'::jsonb)`)).rejects.toThrow(/permission denied/);
      await expect(t.as(who, `select public.release_quota('song', '[{"scope":"app","subject":"all","max":99}]'::jsonb)`)).rejects.toThrow(/permission denied/);
    }
  });
});
