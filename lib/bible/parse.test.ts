import { describe, expect, it } from "vitest";
import { parseRef } from "./parse";

const names = (q: string) => parseRef(q).map((r) => `${r.book.name}${r.chapter ? ` ${r.chapter}` : ""}${r.verse ? `:${r.verse}` : ""}`);

describe("parseRef", () => {
  it("reads common short forms", () => {
    expect(names("jn 3:16")[0]).toBe("John 3:16");
    expect(names("mt 5")[0]).toBe("Matthew 5");
    expect(names("1cor 13")[0]).toBe("1 Corinthians 13");
    expect(names("1 Cor 13")[0]).toBe("1 Corinthians 13");
    expect(names("ps 23")[0]).toBe("Psalms 23");
    expect(names("rom")[0]).toBe("Romans");
    expect(names("gn")[0]).toBe("Genesis");
  });

  it("accepts a dot or a space between chapter and verse", () => {
    expect(names("john 3.16")[0]).toBe("John 3:16");
    expect(names("john 3 16")[0]).toBe("John 3:16");
  });

  it("drops chapters and verses that do not exist", () => {
    expect(names("jn 3:16")).not.toContain("Jonah 3:16"); // Jonah 3 has 10 verses
    expect(names("obadiah 2")).toEqual([]);
    expect(names("john 3:37")).toEqual([]);
    expect(names("john 0")).toEqual([]);
  });

  it("ignores input that is not a reference", () => {
    expect(parseRef("")).toEqual([]);
    expect(parseRef("3:16")).toEqual([]);
    expect(parseRef("xyz")).toEqual([]);
  });
});
