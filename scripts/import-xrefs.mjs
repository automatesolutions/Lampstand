// Builds content/xrefs/<BOOK>.json from OpenBible.info's cross-reference list (CC BY).
// Download https://a.openbible.info/data/cross-references.zip, unzip it, then run:
//   node scripts/import-xrefs.mjs path/to/cross_references.txt
// Each chapter keeps its best-supported links (by OpenBible's community votes) to
// other chapters, so explanations can cite real connections instead of memory.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const counts = JSON.parse(readFileSync(join(root, "lib/bible/verse-counts.json"), "utf8"));
const PER_CHAPTER = 30;
const MIN_VOTES = 5;

// OpenBible (OSIS) book names -> USFM codes used everywhere in Lampstand.
const OSIS = {
  Gen: "GEN", Exod: "EXO", Lev: "LEV", Num: "NUM", Deut: "DEU", Josh: "JOS", Judg: "JDG", Ruth: "RUT",
  "1Sam": "1SA", "2Sam": "2SA", "1Kgs": "1KI", "2Kgs": "2KI", "1Chr": "1CH", "2Chr": "2CH", Ezra: "EZR",
  Neh: "NEH", Esth: "EST", Job: "JOB", Ps: "PSA", Prov: "PRO", Eccl: "ECC", Song: "SNG", Isa: "ISA",
  Jer: "JER", Lam: "LAM", Ezek: "EZK", Dan: "DAN", Hos: "HOS", Joel: "JOL", Amos: "AMO", Obad: "OBA",
  Jonah: "JON", Mic: "MIC", Nah: "NAM", Hab: "HAB", Zeph: "ZEP", Hag: "HAG", Zech: "ZEC", Mal: "MAL",
  Matt: "MAT", Mark: "MRK", Luke: "LUK", John: "JHN", Acts: "ACT", Rom: "ROM", "1Cor": "1CO", "2Cor": "2CO",
  Gal: "GAL", Eph: "EPH", Phil: "PHP", Col: "COL", "1Thess": "1TH", "2Thess": "2TH", "1Tim": "1TI",
  "2Tim": "2TI", Titus: "TIT", Phlm: "PHM", Heb: "HEB", Jas: "JAS", "1Pet": "1PE", "2Pet": "2PE",
  "1John": "1JN", "2John": "2JN", "3John": "3JN", Jude: "JUD", Rev: "REV",
};

function parse(osis) {
  const [b, c, v] = osis.split(".");
  const book = OSIS[b];
  return book ? { book, chapter: Number(c), verse: Number(v) } : null;
}

// "MAT 19:4-6", "GEN 1:1-2:3", or "PSA 23:1".
function target(spec) {
  const [a, z] = spec.split("-");
  const from = parse(a);
  const to = z ? parse(z) : null;
  if (!from) return null;
  if (!to || (to.book === from.book && to.chapter === from.chapter && to.verse === from.verse)) return `${from.book} ${from.chapter}:${from.verse}`;
  if (to.book !== from.book) return `${from.book} ${from.chapter}:${from.verse}`;
  return to.chapter === from.chapter ? `${from.book} ${from.chapter}:${from.verse}-${to.verse}` : `${from.book} ${from.chapter}:${from.verse}-${to.chapter}:${to.verse}`;
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/import-xrefs.mjs path/to/cross_references.txt");
  process.exit(1);
}

const byChapter = new Map(); // "GEN.1" -> [{ v, to, votes }]
for (const line of readFileSync(file, "utf8").split("\n").slice(1)) {
  const [fromSpec, toSpec, votesRaw] = line.split("\t");
  if (!toSpec) continue;
  const votes = Number(votesRaw);
  const from = parse(fromSpec);
  const to = target(toSpec);
  if (!from || !to || votes < MIN_VOTES) continue;
  const toBook = to.split(" ")[0];
  const toChapter = Number(to.split(" ")[1].split(":")[0]);
  if (toBook === from.book && toChapter === from.chapter) continue; // same chapter: not a connection
  const key = `${from.book}.${from.chapter}`;
  if (!byChapter.has(key)) byChapter.set(key, []);
  byChapter.get(key).push({ v: from.verse, to, votes });
}

mkdirSync(join(root, "content/xrefs"), { recursive: true });
let total = 0;
for (const [book, verses] of Object.entries(counts)) {
  const chapters = verses.map((_, i) => {
    const seen = new Set();
    return (byChapter.get(`${book}.${i + 1}`) ?? [])
      .sort((a, b) => b.votes - a.votes)
      .filter((x) => (seen.has(x.to) ? false : seen.add(x.to)))
      .slice(0, PER_CHAPTER)
      .sort((a, b) => a.v - b.v)
      .map((x) => [x.v, x.to, x.votes]);
  });
  total += chapters.reduce((n, c) => n + c.length, 0);
  writeFileSync(
    join(root, "content/xrefs", `${book}.json`),
    JSON.stringify({ source: "OpenBible.info cross references, CC BY (www.openbible.info)", format: "[verse, target, votes]", chapters }) + "\n",
  );
}
console.log(`Wrote ${Object.keys(counts).length} books, ${total} cross-references`);
