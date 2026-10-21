import { describe, expect, it } from "vitest";
import { explainBlocks } from "./explain";

describe("explainBlocks", () => {
  it("reads headings, paragraphs and lists", () => {
    const text = "## Background\nJohn writes late in the first century.\n\n## Key words and ideas\n- Born again: a new start.\n- Spirit: the wind.\n\n## For reflection\n- What does new birth mean?";
    expect(explainBlocks(text)).toEqual([
      { kind: "heading", text: "Background" },
      { kind: "para", text: "John writes late in the first century." },
      { kind: "heading", text: "Key words and ideas" },
      { kind: "list", items: ["Born again: a new start.", "Spirit: the wind."] },
      { kind: "heading", text: "For reflection" },
      { kind: "list", items: ["What does new birth mean?"] },
    ]);
  });

  it("copes with half-written text while it streams", () => {
    expect(explainBlocks("## Backgr")).toEqual([{ kind: "heading", text: "Backgr" }]);
    expect(explainBlocks("")).toEqual([]);
  });
});
