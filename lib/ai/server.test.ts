import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, ipKey, rateLimited, resetRateLimits } from "./server";

const req = (xff?: string, extra: Record<string, string> = {}) =>
  new Request("http://localhost/api/x", { method: "POST", headers: { ...(xff ? { "x-forwarded-for": xff } : {}), ...extra } });

describe("clientIp", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("trusts the address Cloud Run added (the rightmost), not one the browser wrote", () => {
    // A browser sent "1.1.1.1"; Cloud Run appended the real address.
    expect(clientIp(req("1.1.1.1, 203.0.113.9"))).toBe("203.0.113.9");
    expect(clientIp(req("203.0.113.9"))).toBe("203.0.113.9");
  });

  it("looks one place further left for each extra trusted proxy", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    expect(clientIp(req("1.1.1.1, 203.0.113.9, 35.191.0.1"))).toBe("203.0.113.9");
    expect(clientIp(req("203.0.113.9"))).toBe("203.0.113.9"); // fewer values than hops
  });

  it("falls back to x-real-ip, then 'local', in development", () => {
    expect(clientIp(req(undefined, { "x-real-ip": "10.0.0.2" }))).toBe("10.0.0.2");
    expect(clientIp(req())).toBe("local");
  });
});

describe("ipKey", () => {
  it("keeps IPv4 as it is, and unwraps IPv4 inside IPv6", () => {
    expect(ipKey("203.0.113.9")).toBe("203.0.113.9");
    expect(ipKey("::ffff:203.0.113.9")).toBe("203.0.113.9");
  });

  it("counts a whole IPv6 /64 as one address", () => {
    expect(ipKey("2001:db8:aa:bb:1:2:3:4")).toBe("2001:db8:aa:bb::/64");
    expect(ipKey("2001:db8:aa:bb::9")).toBe("2001:db8:aa:bb::/64");
    expect(ipKey("2001:0db8:00aa:00bb:ffff::1")).toBe("2001:db8:aa:bb::/64");
    expect(ipKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
  });
});

describe("rateLimited", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("allows `limit` requests in the window, then waits for it to pass", () => {
    const r = req("203.0.113.9");
    expect([1, 2, 3].map(() => rateLimited(r, "t", 3))).toEqual([false, false, false]);
    expect(rateLimited(r, "t", 3)).toBe(true);
    vi.advanceTimersByTime(10 * 60_000);
    expect(rateLimited(r, "t", 3)).toBe(false);
  });

  it("can't be dodged by writing a fake address first", () => {
    expect(rateLimited(req("9.9.9.1, 203.0.113.9"), "t", 1)).toBe(false);
    expect(rateLimited(req("9.9.9.2, 203.0.113.9"), "t", 1)).toBe(true);
  });

  it("doesn't reset everyone when many addresses arrive at once", () => {
    const victim = req("203.0.113.9");
    rateLimited(victim, "t", 1);
    // More than 5,000 other addresses in the same few minutes.
    for (let i = 0; i < 5200; i++) {
      vi.advanceTimersByTime(1);
      rateLimited(req(`10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`), "flood", 1);
    }
    // The old limiter cleared every bucket here. Now only the least recent are dropped,
    // and the person who was most recently limited is still limited.
    const recent = req("10.0.20.79"); // the last address in the flood (i = 5199)
    expect(rateLimited(recent, "flood", 1)).toBe(true);
  });

  it("forgets expired entries before anyone still inside their window", () => {
    const steady = req("203.0.113.50");
    rateLimited(steady, "long", 1, 60 * 60_000); // a one-hour window
    for (let i = 0; i < 4990; i++) rateLimited(req(`10.1.${(i >> 8) & 255}.${i & 255}`), "short", 1, 1000);
    vi.advanceTimersByTime(2000); // the short entries expire; the hour-long one doesn't
    // Now go past 5,000: room is made from the expired entries, even though the
    // hour-long one is the least recently used.
    for (let i = 0; i < 20; i++) rateLimited(req(`10.2.0.${i}`), "short", 1, 1000);
    expect(rateLimited(steady, "long", 1, 60 * 60_000)).toBe(true);
  });
});
