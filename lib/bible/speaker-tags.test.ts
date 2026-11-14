// The AI speaker pass is checked here without calling any API: only the checking of its
// answers and the request it would send.

import { describe, expect, it } from "vitest";
import { estimateCost, placeClaims, SCHEMA, tagParams, TAG_MODEL } from "./speaker-tags";
import type { SpeakerSpan } from "./speakers";

// John 4:9-10 (KJV), as in content/kjv.
const VERSES = [
  ...Array(8).fill("..."),
  "Then saith the woman of Samaria unto him, How is it that thou, being a Jew, askest drink of me, which am a woman of Samaria? for the Jews have no dealings with the Samaritans.",
  "Jesus answered and said unto her, If thou knewest the gift of God, and who it is that saith to thee, Give me to drink; thou wouldest have asked of him, and he would have given thee living water.",
];
const JESUS: Record<number, SpeakerSpan[]> = { 10: [[34, VERSES[9].length, "jesus"]] };

describe("placeClaims", () => {
  it("places a speech from its first and last words, with the speaker's name", () => {
    const { spans, rejected } = placeClaims(VERSES, [{ verse: 9, speaker: "the woman of Samaria", first_words: "How is it that", last_words: "a woman of Samaria?" }], JESUS);
    expect(rejected).toEqual([]);
    const [[s, e, who, name]] = spans[9];
    expect(VERSES[8].slice(s, e)).toBe("How is it that thou, being a Jew, askest drink of me, which am a woman of Samaria?");
    expect([who, name]).toEqual(["other", "the woman of Samaria"]);
  });

  it("rejects words that aren't in the verse exactly, instead of guessing", () => {
    const { spans, rejected } = placeClaims(VERSES, [
      { verse: 9, speaker: "the woman", first_words: "How can it be that", last_words: "Samaria?" },
      { verse: 9, speaker: "the woman", first_words: "How is it that", last_words: "a woman of Sychar?" },
      { verse: 99, speaker: "nobody", first_words: "a", last_words: "b" },
    ]);
    expect(spans).toEqual({});
    expect(rejected.map((r) => r.reason)).toEqual(["first words not found in the verse", "last words not found after the first words", "no such verse"]);
  });

  it("never colors the words of Jesus as another speaker", () => {
    const { spans, rejected } = placeClaims(VERSES, [{ verse: 10, speaker: "Jesus", first_words: "If thou knewest", last_words: "living water." }], JESUS);
    expect(spans).toEqual({});
    expect(rejected[0].reason).toBe("overlaps the words of Jesus");
  });

  it("places two speakers in one verse, in order", () => {
    const verse = ["And he said, Who art thou? And she answered, I am Ruth thine handmaid."];
    const { spans } = placeClaims(verse, [
      { verse: 1, speaker: "Boaz", first_words: "Who art thou?", last_words: "Who art thou?" },
      { verse: 1, speaker: "Ruth", first_words: "I am Ruth", last_words: "thine handmaid." },
    ]);
    expect(spans[1].map(([s, e, , n]) => `${n}: ${verse[0].slice(s, e)}`)).toEqual(["Boaz: Who art thou?", "Ruth: I am Ruth thine handmaid."]);
  });
});

describe("the request", () => {
  it("sends the chapter numbered, with the words of Jesus marked, and asks for structured anchors", () => {
    const p = tagParams("John", 4, VERSES, JESUS);
    expect(p.model).toBe(TAG_MODEL);
    const content = p.messages[0].content as string;
    expect(content).toContain("9 Then saith the woman of Samaria");
    expect(content).toContain('[words of Jesus: "If thou knewest');
    expect(p.output_config?.format).toEqual({ type: "json_schema", schema: SCHEMA });
  });

  it("estimates the cost from the text alone", () => {
    const e = estimateCost([{ chars: 4000 }, { chars: 4000 }]);
    expect(e.chapters).toBe(2);
    expect(e.usdLow).toBeGreaterThan(0);
    expect(e.usdHigh).toBeGreaterThan(e.usdLow);
  });
});
