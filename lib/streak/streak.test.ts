import { describe, expect, it } from "vitest";
import { addDays, computeStreak } from ".";

const goal = () => 2;
const today = "2026-10-15";

function reads(entries: [number, number][]) {
  return Object.fromEntries(entries.map(([offset, n]) => [addDays(today, -offset), n]));
}

describe("computeStreak", () => {
  it("is zero with no reading", () => {
    expect(computeStreak({}, goal, today)).toMatchObject({ current: 0, metToday: false });
  });

  it("counts consecutive met days including today", () => {
    const s = computeStreak(reads([[0, 2], [1, 3], [2, 2]]), goal, today);
    expect(s.current).toBe(3);
    expect(s.metToday).toBe(true);
  });

  it("does not break because today is not met yet", () => {
    const s = computeStreak(reads([[0, 1], [1, 2], [2, 2]]), goal, today);
    expect(s.current).toBe(2);
    expect(s.metToday).toBe(false);
  });

  it("forgives one missed day", () => {
    const s = computeStreak(reads([[1, 2], [2, 0], [3, 2], [4, 2]]), goal, today);
    expect(s.current).toBe(3);
    expect(s.days.find((d) => d.graced)?.date).toBe(addDays(today, -2));
  });

  it("breaks on two missed days in a row", () => {
    const s = computeStreak(reads([[1, 2], [2, 0], [3, 0], [4, 2]]), goal, today);
    expect(s.current).toBe(1);
  });

  it("allows only one grace day per seven days", () => {
    const s = computeStreak(reads([[1, 2], [2, 0], [3, 2], [4, 0], [5, 2]]), goal, today);
    expect(s.current).toBe(2);
  });

  it("allows another grace day a week later", () => {
    const s = computeStreak(
      reads([[1, 2], [2, 0], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 0], [10, 2]]),
      goal,
      today,
    );
    expect(s.current).toBe(8);
  });

  it("uses the goal in force on each day", () => {
    const goalOn = (d: string) => (d >= addDays(today, -1) ? 3 : 1);
    const s = computeStreak(reads([[1, 3], [2, 1], [3, 1]]), goalOn, today);
    expect(s.current).toBe(3);
  });
});
