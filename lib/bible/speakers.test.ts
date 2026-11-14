import { describe, expect, it } from "vitest";
import { alignJesus, parseUsfm, shiftSpans, speakerSegments, type SpeakerSpan } from "./speakers";

// A small sample written in the eBible.org USFM style: a heading, a footnote, Strong's
// numbers, an italic (\add) word, paragraphs, and words of Jesus (\wj).
const SAMPLE = String.raw`\id JHN
\c 3
\s1 Jesus teaches Nicodemus
\p
\v 1 There was a man of the Pharisees, named Nicodemus, a ruler of the Jews:
\v 2 The same came to Jesus by night, and said unto him, Rabbi, we know that thou art a teacher come from God.\f + \fr 3:2 \ft a note\f*
\v 3 Jesus answered and said unto him, \wj Verily, verily, I say unto thee, Except a man be born again, he cannot see the kingdom of God.\wj*
\p
\v 16 \wj For \w God|strong="G2316"\w* so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.\wj*
\v 17 \wj For God sent not his Son into the world to condemn the world; but that the world through him might be saved.\wj*
\c 4
\v 26 Jesus saith unto her, \wj I that speak unto thee am \add he\add*.\wj*
`;

describe("parseUsfm", () => {
  const verses = parseUsfm(SAMPLE);
  const get = (c: number, v: number) => verses.find((x) => x.chapter === c && x.verse === v)!;

  it("reads each verse's words, without headings, footnotes or Strong's numbers", () => {
    expect(verses.map((v) => `${v.chapter}:${v.verse}`)).toEqual(["3:1", "3:2", "3:3", "3:16", "3:17", "4:26"]);
    expect(get(3, 1).text).toBe("There was a man of the Pharisees, named Nicodemus, a ruler of the Jews:");
    expect(get(3, 2).text).toBe("The same came to Jesus by night, and said unto him, Rabbi, we know that thou art a teacher come from God.");
    expect(get(3, 16).text.startsWith("For God so loved the world")).toBe(true);
    expect(get(4, 26).text).toBe("Jesus saith unto her, I that speak unto thee am he.");
  });

  it("marks exactly the words of Jesus", () => {
    const v = get(3, 3);
    const spoken = [...v.text].filter((_, i) => v.jesus[i]).join("");
    expect(spoken.trim()).toBe("Verily, verily, I say unto thee, Except a man be born again, he cannot see the kingdom of God.");
    expect(get(3, 1).jesus.some(Boolean)).toBe(false);
  });
});

describe("alignJesus", () => {
  const usfm = parseUsfm(SAMPLE);
  const v = (c: number, n: number) => usfm.find((x) => x.chapter === c && x.verse === n)!;

  it("carries the words of Jesus onto our text, even with different punctuation", () => {
    // Our file has slightly different punctuation from the eBible file.
    const ours = "Jesus answered and said unto him, Verily, verily, I say unto thee: Except a man be born again, he cannot see the kingdom of God.";
    const spans = alignJesus(ours, v(3, 3))!;
    expect(spans).toHaveLength(1);
    expect(ours.slice(spans[0][0], spans[0][1])).toBe("Verily, verily, I say unto thee: Except a man be born again, he cannot see the kingdom of God.");
  });

  it("colors a whole verse spoken by Jesus", () => {
    const ours = "For God sent not his Son into the world to condemn the world; but that the world through him might be saved.";
    expect(alignJesus(ours, v(3, 17))).toEqual([[0, ours.length, "jesus"]]);
  });

  it("finds nothing in a verse without words of Jesus", () => {
    expect(alignJesus("There was a man of the Pharisees, named Nicodemus, a ruler of the Jews:", v(3, 1))).toEqual([]);
  });

  it("refuses a verse whose words differ, instead of guessing", () => {
    expect(alignJesus("Jesus answered and said unto him, Truly, truly, I say unto thee, Except a man be born again, he cannot see the kingdom of God.", v(3, 3))).toBeNull();
  });
});

describe("the real eBible format", () => {
  // Copied from eng-kjv2006: Strong's numbers on each word, \+w inside \wj, double spaces.
  const REAL = String.raw`\c 3
\v 3 \w Jesus|strong="G2424"\w* \w answered|strong="G0611"\w* \w and|strong="G2532"\w* \w said|strong="G2036"\w* unto \w him|strong="G0846"\w*, \wj  \+w Verily|strong="G0281"\+w*, \+w verily|strong="G0281"\+w*, \+w I say|strong="G3004"\+w* \+w unto thee|strong="G4671"\+w*, \+w Except|strong="G3361"\+w* \+w a man|strong="G5100"\+w* \+w be born|strong="G1080"\+w* \+w again|strong="G0509"\+w*, \+w he cannot|strong="G1410"\+w* \+w see|strong="G1492"\+w* \+w the kingdom|strong="G0932"\+w* \+w of God|strong="G2316"\+w*.\wj*
\c 22
\v 21 \w They say|strong="G3004"\w* \w unto him|strong="G0846"\w*, \w Cæsar’s|strong="G2541"\w*. \w Then|strong="G5119"\w* \w saith he|strong="G3004"\w* \w unto them|strong="G0846"\w*, \wj  \+w Render|strong="G0591"\+w* \+w therefore|strong="G3767"\+w* \+w unto Cæsar|strong="G2541"\+w* \+w the things which are|strong="G3588"\+w* \+w Cæsar’s|strong="G2541"\+w*; \+w and|strong="G2532"\+w* \+w unto God|strong="G2316"\+w* \+w the things that are|strong="G3588"\+w* \+w God’s|strong="G2316"\+w*.\wj*
`;
  const [jhn, mat] = parseUsfm(REAL);

  it("colors exactly the right letters, despite double spaces and Strong's numbers", () => {
    const ours = "Jesus answered and said unto him, Verily, verily, I say unto thee, Except a man be born again, he cannot see the kingdom of God.";
    const [[s, e]] = alignJesus(ours, jhn)!;
    expect(ours.slice(s, e)).toBe("Verily, verily, I say unto thee, Except a man be born again, he cannot see the kingdom of God.");
  });

  it("matches Cæsar to Caesar", () => {
    const ours = "They say unto him, Caesar’s. Then saith he unto them, Render therefore unto Caesar the things which are Caesar’s; and unto God the things that are God’s.";
    const [[s, e]] = alignJesus(ours, mat)!;
    expect(ours.slice(s, e)).toBe("Render therefore unto Caesar the things which are Caesar’s; and unto God the things that are God’s.");
  });
});

describe("speakerSegments", () => {
  it("splits a verse into plain and spoken parts", () => {
    const text = "Jesus saith unto her, I that speak unto thee am he.";
    const spans: SpeakerSpan[] = [[22, text.length, "jesus"]];
    expect(speakerSegments(text, spans)).toEqual([{ text: "Jesus saith unto her, " }, { text: "I that speak unto thee am he.", who: "jesus" }]);
  });

  it("handles two speakers, no spans, and spans past the end", () => {
    expect(speakerSegments("abc", undefined)).toEqual([{ text: "abc" }]);
    expect(speakerSegments("abcdef", [[4, 99, "other"], [0, 2, "jesus"]])).toEqual([{ text: "ab", who: "jesus" }, { text: "cd" }, { text: "ef", who: "other" }]);
  });

  it("shifts spans past verse 1's drop cap", () => {
    expect(shiftSpans([[0, 10, "jesus"]], 1)).toEqual([[0, 9, "jesus"]]);
  });
});
