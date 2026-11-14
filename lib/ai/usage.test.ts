// lib/ai/usage.ts without a database: the in-memory fallback, and how it shapes limits.
// (The shared SQL is tested in usage.db.test.ts.)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const admin = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => admin.client }));

import { appLimit, envLimit, ipLimit, resetMemoryQuota, takeQuota, userLimit } from "./usage";

const req = (ip: string) => new Request("http://localhost/", { headers: { "x-forwarded-for": ip } });

beforeEach(() => {
  admin.client = null;
  resetMemoryQuota();
});
afterEach(() => vi.unstubAllEnvs());

describe("takeQuota in memory", () => {
  it("counts every limit together, and none when one is full", async () => {
    const limits = [userLimit("u1", 2), appLimit(3)];
    expect((await takeQuota({ feature: "song", limits })).ok).toBe(true);
    expect((await takeQuota({ feature: "song", limits })).ok).toBe(true);
    expect(await takeQuota({ feature: "song", limits })).toEqual({ ok: false, full: "user" });
    // The app still has one place left: a second person can take it.
    expect((await takeQuota({ feature: "song", limits: [userLimit("u2", 2), appLimit(3)] })).ok).toBe(true);
    expect(await takeQuota({ feature: "song", limits: [userLimit("u3", 2), appLimit(3)] })).toEqual({ ok: false, full: "app" });
  });

  it("gives a use back once, when the paid call failed", async () => {
    const limits = [userLimit("u1", 1)];
    const first = await takeQuota({ feature: "song", limits });
    expect(first.ok).toBe(true);
    if (first.ok) {
      await first.giveBack();
      await first.giveBack(); // twice does nothing more
    }
    expect((await takeQuota({ feature: "song", limits })).ok).toBe(true);
    expect((await takeQuota({ feature: "song", limits })).ok).toBe(false);
  });

  it("refuses a limit of 0 (a feature switched off)", async () => {
    expect(await takeQuota({ feature: "song", limits: [appLimit(0)] })).toEqual({ ok: false, full: "app" });
  });

  it("falls back to memory when the database call fails", async () => {
    admin.client = { rpc: async () => ({ data: null, error: { message: "relation does not exist" } }) };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await takeQuota({ feature: "song", limits: [userLimit("u1", 1)] })).ok).toBe(true);
    expect((await takeQuota({ feature: "song", limits: [userLimit("u1", 1)] })).ok).toBe(false);
  });
});

describe("takeQuota with the database", () => {
  it("sends the limits to use_quota and gives back through release_quota", async () => {
    const rpc = vi.fn(async (fn: string) => ({ data: fn === "use_quota" ? null : undefined, error: null }));
    admin.client = { rpc };
    const res = await takeQuota({ feature: "song", limits: [userLimit("u1", 3)] });
    expect(rpc).toHaveBeenCalledWith("use_quota", { p_feature: "song", p_checks: [{ scope: "user", subject: "u1", max: 3 }], p_amount: 1 });
    if (res.ok) await res.giveBack();
    expect(rpc).toHaveBeenLastCalledWith("release_quota", expect.objectContaining({ p_feature: "song" }));
  });

  it("reports the full scope use_quota names", async () => {
    admin.client = { rpc: async () => ({ data: "ip", error: null }) };
    expect(await takeQuota({ feature: "highlight", limits: [ipLimit(req("203.0.113.9"), 40)] })).toEqual({ ok: false, full: "ip" });
  });
});

describe("ipLimit", () => {
  it("stores a hash, never the address", () => {
    const l = ipLimit(req("203.0.113.9"), 5);
    expect(l.scope).toBe("ip");
    expect(l.subject).not.toContain("203");
    expect(l.subject).toHaveLength(32);
  });

  it("treats addresses in the same IPv6 /64 as one, and a faked first value as nothing", () => {
    expect(ipLimit(req("2001:db8:1:2::a"), 5).subject).toBe(ipLimit(req("2001:db8:1:2::b"), 5).subject);
    expect(ipLimit(req("9.9.9.9, 203.0.113.9"), 5).subject).toBe(ipLimit(req("203.0.113.9"), 5).subject);
  });
});

describe("envLimit", () => {
  it("reads whole numbers and ignores anything else", () => {
    vi.stubEnv("TEST_LIMIT", "7");
    expect(envLimit("TEST_LIMIT", 3)).toBe(7);
    vi.stubEnv("TEST_LIMIT", "0");
    expect(envLimit("TEST_LIMIT", 3)).toBe(0);
    for (const bad of ["", "-1", "2.5", "lots"]) {
      vi.stubEnv("TEST_LIMIT", bad);
      expect(envLimit("TEST_LIMIT", 3)).toBe(3);
    }
  });
});
