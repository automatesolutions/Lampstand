// Narration storage and the monthly count (supabase/migrations/0013), in a real Postgres.

import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/lib/lamplighters/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

describe("narration", () => {
  it("keeps the recordings list server only", async () => {
    const someone = await t.user("listener@example.com");
    for (const who of [null, someone]) {
      await expect(t.as(who, "select * from public.narration_audio")).rejects.toThrow(/permission denied/);
      await expect(t.as(who, "select public.usage_this_month('narration_chars')")).rejects.toThrow(/permission denied/);
    }
  });

  it("adds up this month's characters for the whole app, not last month's", async () => {
    const use = (amount: number) => t.admin(`select public.use_quota('narration_chars', '[{"scope":"app","subject":"all","max":999999999}]'::jsonb, $1)`, [amount]);
    await use(3500);
    await use(4000);
    await t.admin(
      "insert into public.usage_counters (day, feature, scope, subject, amount) values ((date_trunc('month', now() at time zone 'utc') - interval '1 day')::date, 'narration_chars', 'app', 'all', 99999)",
    );
    const [{ n }] = await t.admin<{ n: string }>("select public.usage_this_month('narration_chars') as n");
    expect(Number(n)).toBe(7500);
  });
});
