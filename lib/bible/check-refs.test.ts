import { describe, expect, it } from "vitest";
import { checkRefs, dropBadLines } from "./check-refs";

const GEN2 = { book: "GEN", chapter: 2 }; // 25 verses

describe("checkRefs", () => {
  it("accepts real references", () => {
    const text =
      "God rests (vv. 1–3) and forms the man (v. 7). Jesus quotes verse 24 in Matthew 19:4–6, and Paul in Ephesians 5:31–32. The tree of life returns (Revelation 2:7; 22:2). See Exodus 20:8–11, Psalm 23 and 1 Corinthians 15:45, also Genesis 1:1–2:3.";
    expect(checkRefs(text, GEN2)).toEqual([]);
  });

  it("flags verses past the end of this chapter", () => {
    expect(checkRefs("The man names the animals (vv. 19–30).", GEN2).map((p) => p.text)).toEqual(["vv. 19–30"]);
  });

  it("flags other books' missing chapters and verses", () => {
    const problems = checkRefs("Compare Matthew 19:40 and Jude 2:1, and Psalm 151.", GEN2);
    expect(problems.map((p) => p.text)).toEqual(["Matthew 19:40", "Jude 2:1", "Psalm 151"]);
  });

  it("reads 1 John as its own book, not John", () => {
    expect(checkRefs("Love one another (1 John 4:21).", GEN2)).toEqual([]);
    expect(checkRefs("Love one another (1 John 4:22).", GEN2).map((p) => p.text)).toEqual(["1 John 4:22"]);
  });

  it("drops lines that still hold a bad reference", () => {
    const text = "- Good: Hebrews 4:4\n- Bad: Hebrews 4:99\n- Also good";
    expect(dropBadLines(text, checkRefs(text, GEN2))).toBe("- Good: Hebrews 4:4\n- Also good");
  });
});
