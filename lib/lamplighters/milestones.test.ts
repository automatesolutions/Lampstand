import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/streak";
import type { ChapterRead } from "@/lib/store";
import { daysAway, detectMilestones, type ReadingSnapshot } from "./milestones";

const today = "2026-10-29";
const T = { chapters: [5, 10], streak: [3, 7] };

function read(book: string, chapter: number, readOn = today): ChapterRead {
  return { book, chapter, version: "KJV", readOn, completedAt: `${readOn}T12:00:00.000Z` };
}

const snap = (reads: ChapterRead[]): ReadingSnapshot => ({ reads, goals: [], round: null });

/** Marks one more chapter and returns what it reached. */
function mark(reads: ChapterRead[], next: ChapterRead, thresholds = T) {
  return detectMilestones(snap(reads), snap([...reads, next]), next, today, thresholds);
}

describe("detectMilestones", () => {
  it("finds nothing for an ordinary chapter", () => {
    expect(mark([read("JHN", 1)], read("JHN", 2))).toEqual([]);
  });

  it("celebrates the 5th chapter once", () => {
    const four = [1, 2, 3, 4].map((c) => read("PSA", c));
    expect(mark(four, read("PSA", 5))).toEqual([{ type: "chapters", value: 5 }]);
    expect(mark([...four, read("PSA", 5)], read("PSA", 6))).toEqual([]);
  });

  it("finishes a book only when its last missing chapter is read", () => {
    const jude = [] as ChapterRead[];
    expect(mark(jude, read("JUD", 1))).toEqual([{ type: "book", book: "JUD" }]); // Jude has one chapter
    const thirdJohn = [read("3JN", 1)];
    expect(mark(thirdJohn, read("3JN", 1, addDays(today, -1)))).toEqual([]); // reading it again
  });

  it("counts a finished book only in the current round", () => {
    const old = { ...read("JUD", 1, "2025-01-01"), completedAt: "2025-01-01T12:00:00.000Z" };
    const before: ReadingSnapshot = { reads: [old], goals: [], round: { number: 2, startedAt: "2026-01-01T00:00:00.000Z" } };
    const next = read("JUD", 1);
    expect(detectMilestones(before, { ...before, reads: [old, next] }, next, today, T)).toEqual([{ type: "book", book: "JUD" }]);
  });

  it("celebrates a 3-day streak when today's reading completes it", () => {
    const reads = [read("MRK", 1, addDays(today, -2)), read("MRK", 2, addDays(today, -1))];
    expect(mark(reads, read("MRK", 3))).toEqual([{ type: "streak", value: 3 }]);
  });

  it("waits for the daily goal before the streak counts today", () => {
    const reads = [read("MRK", 1, addDays(today, -2)), read("MRK", 2, addDays(today, -1))];
    const goals = [{ chaptersPerDay: 1, effectiveFrom: addDays(today, -5) }, { chaptersPerDay: 2, effectiveFrom: today }];
    const next = read("MRK", 3);
    const out = detectMilestones({ reads, goals, round: null }, { reads: [...reads, next], goals, round: null }, next, today, T);
    expect(out).toEqual([]);
  });

  it("reports several milestones at once, the highest of each kind", () => {
    const reads = [read("GEN", 1, addDays(today, -2)), read("GEN", 2, addDays(today, -1)), read("GEN", 3), read("GEN", 4)];
    expect(mark(reads, read("JUD", 1), { chapters: [3, 5], streak: [2, 3] })).toEqual([
      { type: "book", book: "JUD" },
      { type: "chapters", value: 5 },
    ]);
  });
});

describe("daysAway", () => {
  it("is null for a new reader, someone who read yesterday, or someone who read today", () => {
    expect(daysAway([], today)).toBeNull();
    expect(daysAway([read("JHN", 1, addDays(today, -1))], today)).toBeNull();
    expect(daysAway([read("JHN", 1, addDays(today, -6)), read("JHN", 2)], today)).toBeNull();
  });

  it("counts the days since the last reading after a missed day", () => {
    expect(daysAway([read("JHN", 1, addDays(today, -2))], today)).toBe(2);
    expect(daysAway([read("JHN", 1, addDays(today, -9)), read("JHN", 2, addDays(today, -4))], today)).toBe(4);
  });
});
