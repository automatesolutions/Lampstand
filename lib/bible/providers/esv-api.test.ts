import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { parseEsvText } = await import("./esv-api");

describe("parseEsvText", () => {
  it("splits on verse numbers and tidies spaces", () => {
    const verses = parseEsvText("  [1] Now there was a man of the Pharisees named Nicodemus, a ruler of the Jews. [2] This man came to Jesus by night.\n\n  [3] Jesus answered him.");
    expect(verses).toEqual([
      { number: 1, text: "Now there was a man of the Pharisees named Nicodemus, a ruler of the Jews." },
      { number: 2, text: "This man came to Jesus by night." },
      { number: 3, text: "Jesus answered him." },
    ]);
  });

  it("keeps verse n at index n - 1 when the ESV leaves a verse out", () => {
    const verses = parseEsvText("[20] He said to them. [22] As they were gathering in Galilee.");
    expect(verses).toHaveLength(22);
    expect(verses[20]).toEqual({ number: 21, text: "" });
    expect(verses[21].text).toBe("As they were gathering in Galilee.");
  });

  it("drops Psalm 119 stanza letters", () => {
    const verses = parseEsvText("[7] I will praise you,\nwhen I learn.\n[8] I will keep your statutes;\ndo not utterly forsake me!\n\n\nBeth\n\n[9] How can a young man keep his way pure?");
    expect(verses[7].text).toBe("I will keep your statutes; do not utterly forsake me!");
    expect(verses[8].text).toBe("How can a young man keep his way pure?");
  });

  it("returns nothing without verse numbers", () => {
    expect(parseEsvText("")).toEqual([]);
  });
});
