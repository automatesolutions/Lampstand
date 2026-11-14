import { describe, expect, it } from "vitest";
import type { Highlight } from "@/lib/store";
import { pickAutoShares } from "./autoshare-pick";

const hl = (id: string, createdAt: string): Highlight => ({ id, book: "JHN", chapter: 3, verseStart: 16, verseEnd: 16, color: "gold", createdAt });
const choices = [
  { circle_id: "morning", created_at: "2026-11-10T00:00:00Z" },
  { circle_id: "family", created_at: "2026-11-12T00:00:00Z" },
];

describe("pickAutoShares", () => {
  it("shares only highlights made after auto-share was turned on for each Circle", () => {
    const work = pickAutoShares([hl("old", "2026-11-01T00:00:00Z"), hl("mid", "2026-11-11T00:00:00Z"), hl("new", "2026-11-13T00:00:00Z")], choices, new Set(), 10);
    expect(work).toEqual([
      { highlightId: "new", circleIds: ["morning", "family"] },
      { highlightId: "mid", circleIds: ["morning"] },
    ]);
  });

  it("skips what this device already sent, and stops at the limit", () => {
    const list = [hl("a", "2026-11-13T00:00:00Z"), hl("b", "2026-11-13T01:00:00Z"), hl("c", "2026-11-13T02:00:00Z")];
    expect(pickAutoShares(list, choices, new Set(["c:morning", "c:family", "b:morning"]), 10)).toEqual([
      { highlightId: "b", circleIds: ["family"] },
      { highlightId: "a", circleIds: ["morning", "family"] },
    ]);
    expect(pickAutoShares(list, choices, new Set(), 1)).toHaveLength(1);
  });

  it("does nothing when auto-share is off everywhere", () => {
    expect(pickAutoShares([hl("a", "2026-11-13T00:00:00Z")], [], new Set(), 10)).toEqual([]);
  });
});
