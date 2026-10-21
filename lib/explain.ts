"use client";

// Any screen can open "Explain in depth" for a chapter.

import type { ChapterRef } from "@/lib/bible/types";

const OPEN_EVENT = "lampstand:explain";

export function openExplain(ref: ChapterRef) {
  window.dispatchEvent(new CustomEvent<ChapterRef>(OPEN_EVENT, { detail: ref }));
}

export function onOpenExplain(fn: (ref: ChapterRef) => void) {
  const h = (e: Event) => fn((e as CustomEvent<ChapterRef>).detail);
  window.addEventListener(OPEN_EVENT, h);
  return () => window.removeEventListener(OPEN_EVENT, h);
}

export type ExplainBlock = { kind: "heading"; text: string } | { kind: "para"; text: string } | { kind: "list"; items: string[] };

/** Turns the explanation's "## Heading" and "- item" lines into blocks. Works on partial text while it streams. */
export function explainBlocks(text: string): ExplainBlock[] {
  const blocks: ExplainBlock[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) blocks.push({ kind: "heading", text: line.slice(3).trim() });
    else if (/^[-•*] /.test(line)) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "list") last.items.push(line.slice(2).trim());
      else blocks.push({ kind: "list", items: [line.slice(2).trim()] });
    } else blocks.push({ kind: "para", text: line.replace(/^#+\s*/, "") });
  }
  return blocks;
}
