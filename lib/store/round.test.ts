import { describe, expect, it } from "vitest";
import { chaptersReadInRound, roundReads, TOTAL_CHAPTERS, type ChapterRead } from ".";

const read = (book: string, chapter: number, at: string): ChapterRead => ({ book, chapter, version: "KJV", readOn: at.slice(0, 10), completedAt: at });

describe("reading rounds", () => {
  const reads = [read("GEN", 1, "2026-01-01T08:00:00Z"), read("GEN", 1, "2026-01-02T08:00:00Z"), read("REV", 22, "2026-10-01T08:00:00Z"), read("GEN", 1, "2026-10-20T08:00:00Z")];

  it("counts the whole Bible", () => {
    expect(TOTAL_CHAPTERS).toBe(1189);
  });

  it("counts every read in the first round, each chapter once", () => {
    expect(roundReads(reads, null)).toHaveLength(4);
    expect(chaptersReadInRound(reads, null)).toBe(2);
  });

  it("counts only reads since a new round started", () => {
    const round = { number: 2, startedAt: "2026-10-10T00:00:00Z" };
    expect(roundReads(reads, round).map((r) => r.readOn)).toEqual(["2026-10-20"]);
    expect(chaptersReadInRound(reads, round)).toBe(1);
  });
});
