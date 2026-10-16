import { describe, expect, it } from "vitest";
import { recentChapters } from "./prayer";
import type { ChapterRead } from "./store";

const read = (book: string, chapter: number, at: string): ChapterRead => ({ book, chapter, version: "KJV", readOn: at.slice(0, 10), completedAt: at });

describe("recentChapters", () => {
  const reads = [
    read("JHN", 1, "2026-10-14T08:00:00Z"),
    read("JHN", 2, "2026-10-15T08:00:00Z"),
    read("PSA", 23, "2026-10-16T08:00:00Z"),
    read("JHN", 2, "2026-10-16T09:00:00Z"),
  ];

  it("lists the most recently read first, without repeats", () => {
    expect(recentChapters(reads)).toEqual([
      { book: "JHN", chapter: 2 },
      { book: "PSA", chapter: 23 },
      { book: "JHN", chapter: 1 },
    ]);
  });

  it("puts the chapter on screen first", () => {
    expect(recentChapters(reads, { book: "JHN", chapter: 3 }, 2)).toEqual([
      { book: "JHN", chapter: 3 },
      { book: "JHN", chapter: 2 },
    ]);
  });

  it("is empty with nothing read", () => {
    expect(recentChapters([])).toEqual([]);
  });
});
