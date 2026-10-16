import { describe, expect, it } from "vitest";
import { PLANS, spread } from ".";

describe("plans", () => {
  it("Gospel of John has one chapter a day", () => {
    const john = PLANS.find((p) => p.slug === "gospel-of-john")!;
    expect(john.days).toHaveLength(21);
    expect(john.days.every((d) => d.length === 1)).toBe(true);
  });

  it("New Testament plan covers all 260 chapters in 90 days", () => {
    const nt = PLANS.find((p) => p.slug === "new-testament-90")!;
    expect(nt.days).toHaveLength(90);
    expect(nt.days.flat()).toHaveLength(260);
    expect(nt.days[0][0]).toEqual({ book: "MAT", chapter: 1 });
    expect(nt.days[89].at(-1)).toEqual({ book: "REV", chapter: 22 });
  });

  it("spreads evenly", () => {
    const sizes = spread(Array.from({ length: 10 }, (_, i) => ({ book: "GEN", chapter: i + 1 })), 3).map((d) => d.length);
    expect(sizes).toEqual([4, 3, 3]);
  });
});
