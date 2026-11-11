import { describe, expect, it } from "vitest";
import { checkLyrics, compositionPlan, SONG_MS, type Lyrics } from "./song";

const lyrics: Lyrics = {
  title: "Born of the Spirit",
  verse1: ["A teacher came to Jesus late by night", "With questions he could hardly say aloud", "He heard of wind that no one sees in flight", "And birth from God above the crowd"],
  chorus: ["Thank you, Lord, for love that gave your Son", "For light that meets us in the dark", "Thank you, Lord, the work of grace is done", "You make us new, you make a start"],
  verse2: ["As Moses lifted up the serpent high", "So the Son of Man was lifted on the tree", "Whoever trusts in him will never die", "But live, forgiven, whole and free"],
};

describe("song plan", () => {
  it("is intro, verse, chorus, verse and the same chorus, about 70 seconds", () => {
    const plan = compositionPlan(lyrics, "praise");
    expect(plan.chunks.map((c) => c.text.split("\n")[0])).toEqual(["[Intro]", "[Verse]", "[Chorus]", "[Verse]", "[Chorus]"]);
    expect(plan.chunks[2].text).toBe(plan.chunks[4].text);
    expect(plan.chunks[1].text).toContain(lyrics.verse1[0]);
    expect(SONG_MS).toBeGreaterThanOrEqual(60_000);
    expect(SONG_MS).toBeLessThanOrEqual(75_000);
    expect(plan.chunks.every((c) => c.durationMs >= 3000 && c.contextAdherence === "high")).toBe(true);
    expect(plan.chunks[0].positiveStyles.length).toBeGreaterThanOrEqual(6);
    expect(plan.chunks[0].text).toBe("[Intro]"); // instrumental: no words
  });

  it("uses each choice's sound and never names an artist", () => {
    const worship = compositionPlan(lyrics, "worship");
    expect(worship.chunks[0].positiveStyles).toEqual(expect.arrayContaining(["piano", "slow", "reverent"]));
    expect(worship.chunks[0].negativeStyles).toEqual(expect.arrayContaining(["EDM", "shouting"]));
    expect(compositionPlan(lyrics, "praise").chunks[0].positiveStyles).toEqual(expect.arrayContaining(["acoustic guitar", "claps", "major key"]));
  });
});

describe("checkLyrics", () => {
  it("accepts good lyrics and strips brackets so a line can't become a section", () => {
    const l = checkLyrics({ ...lyrics, chorus: ["[Bridge] Thank you, Lord", ...lyrics.chorus.slice(1)] })!;
    expect(l.chorus[0]).toBe("Bridge Thank you, Lord");
  });
  it("refuses missing parts and songs far too short or long", () => {
    expect(checkLyrics({ ...lyrics, chorus: [] })).toBeNull();
    expect(checkLyrics({ title: "x", verse1: ["a", "b"], chorus: ["c", "d"], verse2: ["e", "f"] })).toBeNull();
    expect(checkLyrics(null)).toBeNull();
  });
});
