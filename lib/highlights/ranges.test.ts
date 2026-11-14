import { describe, expect, it } from "vitest";
import type { Highlight } from "@/lib/store";
import { applyColor, colorOf, derivedId, erase, highlightAt, withoutOverlaps } from "./ranges";

const JHN3 = { book: "JHN", chapter: 3 };
const at = "2026-11-14T10:00:00.000Z";
let n = 0;
const newId = () => `new-${++n}`;
const hl = (id: string, start: number, end: number, color: Highlight["color"] = "gold", createdAt = "2026-11-01T00:00:00.000Z", summary: string | null = null): Highlight => ({
  id, book: "JHN", chapter: 3, verseStart: start, verseEnd: end, color, createdAt, summary,
});
/** "16-18 gold" for each highlight, in verse order. */
const shape = (list: Highlight[]) => [...list].sort((a, b) => a.verseStart - b.verseStart).map((h) => `${h.verseStart}-${h.verseEnd} ${h.color}`);

describe("applyColor", () => {
  it("colors several verses as one highlight", () => {
    const out = applyColor([], JHN3, { start: 16, end: 18 }, "gold", at, newId);
    expect(shape(out)).toEqual(["16-18 gold"]);
    expect(out[0].summary).toBeNull();
  });

  it("still works for one verse, and the same color again removes it (as before)", () => {
    const one = applyColor([], JHN3, { start: 16, end: 16 }, "sky", at, newId);
    expect(shape(one)).toEqual(["16-16 sky"]);
    expect(applyColor(one, JHN3, { start: 16, end: 16 }, "sky", at, newId)).toEqual([]);
  });

  it("keeps the id and the summary when the same verses get a new color", () => {
    const before = [hl("a", 16, 18, "gold", "2026-11-01T00:00:00.000Z", "God gave his Son.")];
    const [after] = applyColor(before, JHN3, { start: 16, end: 18 }, "rose", at, newId);
    expect(after).toMatchObject({ id: "a", color: "rose", summary: "God gave his Son.", createdAt: at });
  });

  it("covers what it overlaps: one verse, one color", () => {
    const before = [hl("a", 14, 16, "sky"), hl("b", 18, 20, "sage")];
    const out = applyColor(before, JHN3, { start: 16, end: 18 }, "gold", at, newId);
    expect(shape(out)).toEqual(["14-15 sky", "16-18 gold", "19-20 sage"]);
  });

  it("splits a longer highlight around a new color in its middle", () => {
    const out = applyColor([hl("a", 10, 20, "sky", undefined, "About 10 to 20.")], JHN3, { start: 14, end: 15 }, "gold", at, newId);
    expect(shape(out)).toEqual(["10-13 sky", "14-15 gold", "16-20 sky"]);
    const [left, right] = [out.find((h) => h.verseStart === 10)!, out.find((h) => h.verseStart === 16)!];
    expect(left.id).toBe("a"); // still starts at the same verse
    expect(right.id).toBe(derivedId("a", 16));
    // Their verses changed, so the summary about 10 to 20 no longer fits either part.
    expect([left.summary, right.summary]).toEqual([null, null]);
  });

  it("removes a color from just the selected verses when they all have it", () => {
    const out = applyColor([hl("a", 10, 20, "sky")], JHN3, { start: 12, end: 13 }, "sky", at, newId);
    expect(shape(out)).toEqual(["10-11 sky", "14-20 sky"]);
  });

  it("colors the whole selection when only some of it has the color", () => {
    const out = applyColor([hl("a", 16, 16, "gold")], JHN3, { start: 16, end: 18 }, "gold", at, newId);
    expect(shape(out)).toEqual(["16-18 gold"]);
  });

  it("leaves other chapters alone", () => {
    const other = { ...hl("x", 16, 18), chapter: 4 };
    const out = applyColor([other], JHN3, { start: 16, end: 18 }, "rose", at, newId);
    expect(out).toContainEqual(other);
  });
});

describe("colorOf and highlightAt", () => {
  const list = [hl("a", 16, 18, "gold"), hl("b", 19, 19, "rose")];
  it("names the one color a selection has, or none", () => {
    expect(colorOf(list, JHN3, { start: 16, end: 18 })).toBe("gold");
    expect(colorOf(list, JHN3, { start: 17, end: 19 })).toBeNull(); // two colors
    expect(colorOf(list, JHN3, { start: 18, end: 20 })).toBeNull(); // 20 has none
  });
  it("finds the highlight that covers a verse", () => {
    expect(highlightAt(list, JHN3, 17)?.id).toBe("a");
    expect(highlightAt(list, JHN3, 21)).toBeUndefined();
  });
});

describe("erase", () => {
  it("drops highlights that are wholly inside", () => {
    expect(erase([hl("a", 16, 18)], JHN3, { start: 1, end: 36 })).toEqual([]);
  });
});

describe("derivedId", () => {
  it("is the same for the same inputs, different otherwise, and shaped like a UUID", () => {
    expect(derivedId("a", 16)).toBe(derivedId("a", 16));
    expect(derivedId("a", 16)).not.toBe(derivedId("a", 17));
    expect(derivedId("a", 16)).not.toBe(derivedId("b", 16));
    expect(derivedId("a", 16)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("withoutOverlaps (after joining two devices)", () => {
  it("lets the newer highlight win the verses both cover", () => {
    const older = hl("a", 16, 18, "gold", "2026-11-01T00:00:00.000Z");
    const newer = hl("b", 17, 17, "rose", "2026-11-02T00:00:00.000Z");
    expect(shape(withoutOverlaps([newer, older]))).toEqual(["16-16 gold", "17-17 rose", "18-18 gold"]);
  });

  it("gives every device the same result, whatever order they arrive in", () => {
    const list = [hl("a", 10, 20, "sky", "2026-11-01T00:00:00.000Z"), hl("b", 12, 13, "gold", "2026-11-02T00:00:00.000Z"), hl("c", 18, 22, "rose", "2026-11-03T00:00:00.000Z")];
    const one = withoutOverlaps(list);
    const two = withoutOverlaps([...list].reverse());
    const key = (l: Highlight[]) => l.map((h) => `${h.id}:${h.verseStart}-${h.verseEnd}`).sort();
    expect(key(one)).toEqual(key(two));
    expect(shape(one)).toEqual(["10-11 sky", "12-13 gold", "14-17 sky", "18-22 rose"]);
  });

  it("leaves highlights that don't overlap as they are", () => {
    const list = [hl("a", 1, 1), hl("b", 2, 5, "sky")];
    expect(withoutOverlaps(list)).toEqual(list);
  });
});
