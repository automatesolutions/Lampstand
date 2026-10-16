// Converts the public-domain KJV JSON (github.com/aruljohn/Bible-kjv) into
// content/kjv/<USFM>.json, shaped as { "chapters": [["verse 1", "verse 2", ...], ...] }.
//
// Usage: node scripts/import-kjv.mjs <path-to-Bible-kjv-folder>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_FILES = {
  GEN: "Genesis", EXO: "Exodus", LEV: "Leviticus", NUM: "Numbers", DEU: "Deuteronomy",
  JOS: "Joshua", JDG: "Judges", RUT: "Ruth", "1SA": "1Samuel", "2SA": "2Samuel",
  "1KI": "1Kings", "2KI": "2Kings", "1CH": "1Chronicles", "2CH": "2Chronicles",
  EZR: "Ezra", NEH: "Nehemiah", EST: "Esther", JOB: "Job", PSA: "Psalms", PRO: "Proverbs",
  ECC: "Ecclesiastes", SNG: "SongofSolomon", ISA: "Isaiah", JER: "Jeremiah",
  LAM: "Lamentations", EZK: "Ezekiel", DAN: "Daniel", HOS: "Hosea", JOL: "Joel",
  AMO: "Amos", OBA: "Obadiah", JON: "Jonah", MIC: "Micah", NAM: "Nahum", HAB: "Habakkuk",
  ZEP: "Zephaniah", HAG: "Haggai", ZEC: "Zechariah", MAL: "Malachi",
  MAT: "Matthew", MRK: "Mark", LUK: "Luke", JHN: "John", ACT: "Acts", ROM: "Romans",
  "1CO": "1Corinthians", "2CO": "2Corinthians", GAL: "Galatians", EPH: "Ephesians",
  PHP: "Philippians", COL: "Colossians", "1TH": "1Thessalonians", "2TH": "2Thessalonians",
  "1TI": "1Timothy", "2TI": "2Timothy", TIT: "Titus", PHM: "Philemon", HEB: "Hebrews",
  JAS: "James", "1PE": "1Peter", "2PE": "2Peter", "1JN": "1John", "2JN": "2John",
  "3JN": "3John", JUD: "Jude", REV: "Revelation",
};

const src = process.argv[2];
if (!src) {
  console.error("Usage: node scripts/import-kjv.mjs <path-to-Bible-kjv-folder>");
  process.exit(1);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "kjv");
mkdirSync(outDir, { recursive: true });

let verseCount = 0;
const verseCounts = {};
for (const [code, file] of Object.entries(SOURCE_FILES)) {
  const raw = JSON.parse(readFileSync(join(src, `${file}.json`), "utf8"));
  const chapters = raw.chapters
    .sort((a, b) => Number(a.chapter) - Number(b.chapter))
    .map((c) =>
      c.verses
        .sort((a, b) => Number(a.verse) - Number(b.verse))
        .map((v) => String(v.text).replace(/\s+/g, " ").trim()),
    );
  verseCount += chapters.reduce((n, c) => n + c.length, 0);
  verseCounts[code] = chapters.map((c) => c.length);
  writeFileSync(join(outDir, `${code}.json`), JSON.stringify({ chapters }));
}
// Verse counts let the client check references (Go to palette) without loading text.
writeFileSync(join(outDir, "..", "..", "lib", "bible", "verse-counts.json"), JSON.stringify(verseCounts));
console.log(`Wrote ${Object.keys(SOURCE_FILES).length} books, ${verseCount} verses to ${outDir}`);
