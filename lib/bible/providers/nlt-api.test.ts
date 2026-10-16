import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: () => {} }));

const { parseNltHtml } = await import("./nlt-api");

// Shape of the NLT API's HTML (John 3:1–3), shortened.
const HTML = `<section><h2 class="bk_ch_vs_header">John 3:1-36, NLT</h2><verse_export orig="john_3_1" bk="john" ch="3" vn="1">
<h2 class="chapter-number"><span class="cw">John</span> <span class="cw_ch">3</span></h2>
<p class="body-ch"><span class="vn">1</span>There was a man named Nicodemus, a Jewish religious leader who was a Pharisee. </verse_export><verse_export orig="john_3_2" bk="john" ch="3" vn="2"><span class="vn">2</span>After dark one evening, he came to speak with Jesus. &#8220;Rabbi,&#8221; he said.<p>
</verse_export><verse_export orig="john_3_3" bk="john" ch="3" vn="3">
<h3 class="subhead">Born Again</h3><p class="body"><span class="vn">3</span>Jesus replied, <span class="red">“I tell you the truth, unless you are born again,<a class="a-tn">*</a><span class="tn"><span class="tn-ref">3:3</span> Or <em>born from above;</em> also in 3:7.</span> you cannot see the Kingdom of God.”</span></p>
</verse_export><verse_export orig="john_3_5" bk="john" ch="3" vn="5"><span class="vn">5</span>Jesus replied.</verse_export></section>`;

describe("parseNltHtml", () => {
  const verses = parseNltHtml(HTML);

  it("keeps the verse text and drops headings, numbers and notes", () => {
    expect(verses[0]).toEqual({ number: 1, text: "There was a man named Nicodemus, a Jewish religious leader who was a Pharisee." });
    expect(verses[1].text).toBe("After dark one evening, he came to speak with Jesus. “Rabbi,” he said.");
    expect(verses[2].text).toBe("Jesus replied, “I tell you the truth, unless you are born again, you cannot see the Kingdom of God.”");
  });

  it("keeps verse n at index n - 1, even across a gap", () => {
    expect(verses.map((v) => v.number)).toEqual([1, 2, 3, 4, 5]);
    expect(verses[3].text).toBe("");
    expect(verses[4].text).toBe("Jesus replied.");
  });

  it("returns nothing for a page without verses", () => {
    expect(parseNltHtml("<html><body>Not found</body></html>")).toEqual([]);
  });
});
