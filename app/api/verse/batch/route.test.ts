// Many KJV verses in one request, for Notes. Reads the real KJV files; no network.

import { describe, expect, it } from "vitest";
import { POST } from "./route";

const ask = (ranges: unknown) => POST(new Request("http://localhost/api/verse/batch", { method: "POST", body: JSON.stringify({ ranges }) }));

describe("POST /api/verse/batch", () => {
  it("returns each range's KJV text under its key", async () => {
    const res = await ask([
      { book: "JHN", chapter: 3, verseStart: 16, verseEnd: 16 },
      { book: "psa", chapter: 23, verseStart: 1, verseEnd: 2 },
    ]);
    expect(res.status).toBe(200);
    const { texts } = await res.json();
    expect(texts["JHN.3.16-16"]).toMatch(/^For God so loved the world/);
    expect(texts["PSA.23.1-2"]).toMatch(/^The LORD is my shepherd; I shall not want\. He maketh me to lie down/);
  });

  it("answers null for verses past the end of a chapter, without failing the rest", async () => {
    const { texts } = await (await ask([{ book: "JHN", chapter: 3, verseStart: 40, verseEnd: 40 }, { book: "JHN", chapter: 3, verseStart: 1 }])).json();
    expect(texts["JHN.3.40-40"]).toBeNull();
    expect(texts["JHN.3.1-1"]).toMatch(/Nicodemus/);
  });

  it("returns at most 10 verses of a range", async () => {
    const { texts } = await (await ask([{ book: "PSA", chapter: 119, verseStart: 1, verseEnd: 176 }])).json();
    expect(Object.keys(texts)).toEqual(["PSA.119.1-10"]);
  });

  it("refuses references that aren't real", async () => {
    for (const bad of [
      [{ book: "XYZ", chapter: 1, verseStart: 1 }],
      [{ book: "JHN", chapter: 22, verseStart: 1 }],
      [{ book: "JHN", chapter: 3, verseStart: 0 }],
      [{ book: "JHN", chapter: 3, verseStart: 5, verseEnd: 4 }],
      [{ book: "JHN", chapter: "3; drop table", verseStart: 1 }],
    ]) {
      expect((await ask(bad)).status).toBe(400);
    }
    expect((await ask([])).status).toBe(400);
    expect((await ask("JHN 3:16")).status).toBe(400);
  });

  it("caps how much one request can take", async () => {
    const many = (n: number, len: number) => Array.from({ length: n }, (_, i) => ({ book: "PSA", chapter: 119, verseStart: 1 + (i % 160), verseEnd: (i % 160) + len }));
    expect((await ask(many(201, 1))).status).toBe(400); // over 200 ranges
    expect((await ask(many(101, 10))).status).toBe(400); // over 1,000 verses
    expect((await ask(many(100, 10))).status).toBe(200);
  });
});
