// Imports the words of Jesus from the eBible.org KJV (eng-kjv2006, public domain), whose
// USFM marks them with \wj ... \wj*, into content/speakers/<BOOK>.json as character
// ranges in our own KJV text (content/kjv). Free: it only reads local files.
//
// Usage: npx tsx scripts/import-speakers.mts <folder with the eng-kjv2006 .usfm files>
//
// A verse whose letters don't match our text exactly is left uncolored (never guessed) and
// listed in content/speakers/report.json, so it can be checked by hand.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { alignJesus, parseUsfm, type SpeakerBook, type SpeakerSpan } from "../lib/bible/speakers";

const src = process.argv[2];
if (!src) {
  console.error("Usage: npx tsx scripts/import-speakers.mts <folder with eng-kjv2006 USFM files>");
  process.exit(1);
}
const root = join(import.meta.dirname, "..");
const outDir = join(root, "content", "speakers");
mkdirSync(outDir, { recursive: true });

const SOURCE = "eBible.org King James Version (eng-kjv2006), public domain; words of Jesus from its \wj markup";
const report: { book: string; chapter: number; verse: number; reason: string }[] = [];
let books = 0;
let colored = 0;

for (const file of readdirSync(src).filter((f) => /\.(usfm|sfm)$/i.test(f))) {
  const usfm = readFileSync(join(src, file), "utf8");
  const code = /\id\s+([1-3A-Z]{3})/.exec(usfm)?.[1];
  if (!code) continue;
  let ours: { chapters: string[][] };
  try {
    ours = JSON.parse(readFileSync(join(root, "content", "kjv", `${code}.json`), "utf8"));
  } catch {
    continue; // a book we don't have (the Apocrypha)
  }
  const book: SpeakerBook = { source: SOURCE, status: "draft", chapters: {} };
  for (const v of parseUsfm(usfm)) {
    if (!v.jesus.some(Boolean)) continue;
    const text = ours.chapters[v.chapter - 1]?.[v.verse - 1];
    if (text == null) {
      report.push({ book: code, chapter: v.chapter, verse: v.verse, reason: "verse not in our text" });
      continue;
    }
    const spans: SpeakerSpan[] | null = alignJesus(text, v);
    if (!spans) {
      report.push({ book: code, chapter: v.chapter, verse: v.verse, reason: "letters differ from our text" });
      continue;
    }
    if (!spans.length) continue;
    (book.chapters[v.chapter] ??= {})[v.verse] = spans;
    colored++;
  }
  if (Object.keys(book.chapters).length) {
    writeFileSync(join(outDir, `${code}.json`), JSON.stringify(book));
    books++;
  }
}

writeFileSync(join(outDir, "report.json"), JSON.stringify({ source: SOURCE, colored, skipped: report }, null, 2));
console.log(`Words of Jesus: ${colored} verses in ${books} books. ${report.length} verses skipped (see content/speakers/report.json).`);
