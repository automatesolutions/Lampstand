import { kjvLocal } from "./providers/kjv-local";

// KJV words for text that leaves the reader (shared highlights). KJV is public domain, so
// it can be copied into messages; licensed versions never are.

const MAX_TEXT = 2000;

/** The KJV words of the verses, numbered when there are several; cut to fit a message. */
export async function kjvWords(book: string, chapter: number, start: number, end: number): Promise<string | null> {
  const data = await kjvLocal.chapter({ book, chapter });
  const verses = (data?.verses ?? []).filter((v) => v.number >= start && v.number <= end && v.text);
  if (!verses.length) return null;
  const text = verses.map((v) => (verses.length > 1 ? `${v.number} ${v.text}` : v.text)).join(" ");
  return text.length <= MAX_TEXT ? text : `${text.slice(0, MAX_TEXT - 1).replace(/\s+\S*$/, "")}…`;
}
