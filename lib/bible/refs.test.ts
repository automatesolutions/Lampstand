import { describe, expect, it } from "vitest";
import { listChapters } from "./refs";

describe("listChapters", () => {
  it("uses the Oxford comma for three or more, and none for two (DESIGN.md §9)", () => {
    expect(listChapters([])).toBe("");
    expect(listChapters([{ book: "JHN", chapter: 3 }])).toBe("John 3");
    expect(listChapters([{ book: "JHN", chapter: 3 }, { book: "JHN", chapter: 2 }])).toBe("John 3 and John 2");
    expect(listChapters([{ book: "JHN", chapter: 3 }, { book: "JHN", chapter: 2 }, { book: "JHN", chapter: 1 }])).toBe("John 3, John 2, and John 1");
  });
});
