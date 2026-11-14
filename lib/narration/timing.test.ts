import { describe, expect, it } from "vitest";
import { narrationText, verseAtTime, verseStarts } from "./timing";

describe("narration timing", () => {
  it("reads the verses as one text, without verse numbers, and knows where each starts", () => {
    const { text, offsets } = narrationText(["In the beginning God created the heaven and the earth. ", " And the earth was without form."]);
    expect(text).toBe("In the beginning God created the heaven and the earth. And the earth was without form.");
    expect(offsets).toEqual([0, 55]);
    expect(text.slice(offsets[1], offsets[1] + 3)).toBe("And");
  });

  it("finds each verse's start in the recording from the character times", () => {
    const times = Array.from({ length: 100 }, (_, i) => i * 0.1); // 0.1s a character
    expect(verseStarts([0, 55], times)).toEqual([0, 5.5]);
    // Timings shorter than the text: never past the last known time.
    expect(verseStarts([0, 55, 300], times)).toEqual([0, 5.5, 9.9]);
  });

  it("knows which verse is playing", () => {
    const starts = [0, 5.5, 12, 20];
    expect(verseAtTime(starts, 0)).toBe(0);
    expect(verseAtTime(starts, 5.49)).toBe(1); // within the small tolerance
    expect(verseAtTime(starts, 11.9)).toBe(1);
    expect(verseAtTime(starts, 25)).toBe(3);
  });
});
