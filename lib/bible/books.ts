import type { Book } from "./types";

// Protestant canon order. `code` is the USFM book code used for every stored reference.
// `slug` is the URL segment. Catholic deuterocanonical books join this list when a
// version that includes them (NABRE) is licensed; see `canon` on Book.
export const BOOKS: readonly Book[] = [
  { code: "GEN", slug: "genesis", name: "Genesis", short: "Gen", testament: "OT", chapters: 50, canon: "all" },
  { code: "EXO", slug: "exodus", name: "Exodus", short: "Exod", testament: "OT", chapters: 40, canon: "all" },
  { code: "LEV", slug: "leviticus", name: "Leviticus", short: "Lev", testament: "OT", chapters: 27, canon: "all" },
  { code: "NUM", slug: "numbers", name: "Numbers", short: "Num", testament: "OT", chapters: 36, canon: "all" },
  { code: "DEU", slug: "deuteronomy", name: "Deuteronomy", short: "Deut", testament: "OT", chapters: 34, canon: "all" },
  { code: "JOS", slug: "joshua", name: "Joshua", short: "Josh", testament: "OT", chapters: 24, canon: "all" },
  { code: "JDG", slug: "judges", name: "Judges", short: "Judg", testament: "OT", chapters: 21, canon: "all" },
  { code: "RUT", slug: "ruth", name: "Ruth", short: "Ruth", testament: "OT", chapters: 4, canon: "all" },
  { code: "1SA", slug: "1-samuel", name: "1 Samuel", short: "1 Sam", testament: "OT", chapters: 31, canon: "all" },
  { code: "2SA", slug: "2-samuel", name: "2 Samuel", short: "2 Sam", testament: "OT", chapters: 24, canon: "all" },
  { code: "1KI", slug: "1-kings", name: "1 Kings", short: "1 Kgs", testament: "OT", chapters: 22, canon: "all" },
  { code: "2KI", slug: "2-kings", name: "2 Kings", short: "2 Kgs", testament: "OT", chapters: 25, canon: "all" },
  { code: "1CH", slug: "1-chronicles", name: "1 Chronicles", short: "1 Chr", testament: "OT", chapters: 29, canon: "all" },
  { code: "2CH", slug: "2-chronicles", name: "2 Chronicles", short: "2 Chr", testament: "OT", chapters: 36, canon: "all" },
  { code: "EZR", slug: "ezra", name: "Ezra", short: "Ezra", testament: "OT", chapters: 10, canon: "all" },
  { code: "NEH", slug: "nehemiah", name: "Nehemiah", short: "Neh", testament: "OT", chapters: 13, canon: "all" },
  { code: "EST", slug: "esther", name: "Esther", short: "Esth", testament: "OT", chapters: 10, canon: "all" },
  { code: "JOB", slug: "job", name: "Job", short: "Job", testament: "OT", chapters: 42, canon: "all" },
  { code: "PSA", slug: "psalms", name: "Psalms", short: "Ps", testament: "OT", chapters: 150, canon: "all" },
  { code: "PRO", slug: "proverbs", name: "Proverbs", short: "Prov", testament: "OT", chapters: 31, canon: "all" },
  { code: "ECC", slug: "ecclesiastes", name: "Ecclesiastes", short: "Eccl", testament: "OT", chapters: 12, canon: "all" },
  { code: "SNG", slug: "song-of-solomon", name: "Song of Solomon", short: "Song", testament: "OT", chapters: 8, canon: "all" },
  { code: "ISA", slug: "isaiah", name: "Isaiah", short: "Isa", testament: "OT", chapters: 66, canon: "all" },
  { code: "JER", slug: "jeremiah", name: "Jeremiah", short: "Jer", testament: "OT", chapters: 52, canon: "all" },
  { code: "LAM", slug: "lamentations", name: "Lamentations", short: "Lam", testament: "OT", chapters: 5, canon: "all" },
  { code: "EZK", slug: "ezekiel", name: "Ezekiel", short: "Ezek", testament: "OT", chapters: 48, canon: "all" },
  { code: "DAN", slug: "daniel", name: "Daniel", short: "Dan", testament: "OT", chapters: 12, canon: "all" },
  { code: "HOS", slug: "hosea", name: "Hosea", short: "Hos", testament: "OT", chapters: 14, canon: "all" },
  { code: "JOL", slug: "joel", name: "Joel", short: "Joel", testament: "OT", chapters: 3, canon: "all" },
  { code: "AMO", slug: "amos", name: "Amos", short: "Amos", testament: "OT", chapters: 9, canon: "all" },
  { code: "OBA", slug: "obadiah", name: "Obadiah", short: "Obad", testament: "OT", chapters: 1, canon: "all" },
  { code: "JON", slug: "jonah", name: "Jonah", short: "Jonah", testament: "OT", chapters: 4, canon: "all" },
  { code: "MIC", slug: "micah", name: "Micah", short: "Mic", testament: "OT", chapters: 7, canon: "all" },
  { code: "NAM", slug: "nahum", name: "Nahum", short: "Nah", testament: "OT", chapters: 3, canon: "all" },
  { code: "HAB", slug: "habakkuk", name: "Habakkuk", short: "Hab", testament: "OT", chapters: 3, canon: "all" },
  { code: "ZEP", slug: "zephaniah", name: "Zephaniah", short: "Zeph", testament: "OT", chapters: 3, canon: "all" },
  { code: "HAG", slug: "haggai", name: "Haggai", short: "Hag", testament: "OT", chapters: 2, canon: "all" },
  { code: "ZEC", slug: "zechariah", name: "Zechariah", short: "Zech", testament: "OT", chapters: 14, canon: "all" },
  { code: "MAL", slug: "malachi", name: "Malachi", short: "Mal", testament: "OT", chapters: 4, canon: "all" },
  { code: "MAT", slug: "matthew", name: "Matthew", short: "Matt", testament: "NT", chapters: 28, canon: "all" },
  { code: "MRK", slug: "mark", name: "Mark", short: "Mark", testament: "NT", chapters: 16, canon: "all" },
  { code: "LUK", slug: "luke", name: "Luke", short: "Luke", testament: "NT", chapters: 24, canon: "all" },
  { code: "JHN", slug: "john", name: "John", short: "John", testament: "NT", chapters: 21, canon: "all" },
  { code: "ACT", slug: "acts", name: "Acts", short: "Acts", testament: "NT", chapters: 28, canon: "all" },
  { code: "ROM", slug: "romans", name: "Romans", short: "Rom", testament: "NT", chapters: 16, canon: "all" },
  { code: "1CO", slug: "1-corinthians", name: "1 Corinthians", short: "1 Cor", testament: "NT", chapters: 16, canon: "all" },
  { code: "2CO", slug: "2-corinthians", name: "2 Corinthians", short: "2 Cor", testament: "NT", chapters: 13, canon: "all" },
  { code: "GAL", slug: "galatians", name: "Galatians", short: "Gal", testament: "NT", chapters: 6, canon: "all" },
  { code: "EPH", slug: "ephesians", name: "Ephesians", short: "Eph", testament: "NT", chapters: 6, canon: "all" },
  { code: "PHP", slug: "philippians", name: "Philippians", short: "Phil", testament: "NT", chapters: 4, canon: "all" },
  { code: "COL", slug: "colossians", name: "Colossians", short: "Col", testament: "NT", chapters: 4, canon: "all" },
  { code: "1TH", slug: "1-thessalonians", name: "1 Thessalonians", short: "1 Thess", testament: "NT", chapters: 5, canon: "all" },
  { code: "2TH", slug: "2-thessalonians", name: "2 Thessalonians", short: "2 Thess", testament: "NT", chapters: 3, canon: "all" },
  { code: "1TI", slug: "1-timothy", name: "1 Timothy", short: "1 Tim", testament: "NT", chapters: 6, canon: "all" },
  { code: "2TI", slug: "2-timothy", name: "2 Timothy", short: "2 Tim", testament: "NT", chapters: 4, canon: "all" },
  { code: "TIT", slug: "titus", name: "Titus", short: "Titus", testament: "NT", chapters: 3, canon: "all" },
  { code: "PHM", slug: "philemon", name: "Philemon", short: "Phlm", testament: "NT", chapters: 1, canon: "all" },
  { code: "HEB", slug: "hebrews", name: "Hebrews", short: "Heb", testament: "NT", chapters: 13, canon: "all" },
  { code: "JAS", slug: "james", name: "James", short: "Jas", testament: "NT", chapters: 5, canon: "all" },
  { code: "1PE", slug: "1-peter", name: "1 Peter", short: "1 Pet", testament: "NT", chapters: 5, canon: "all" },
  { code: "2PE", slug: "2-peter", name: "2 Peter", short: "2 Pet", testament: "NT", chapters: 3, canon: "all" },
  { code: "1JN", slug: "1-john", name: "1 John", short: "1 John", testament: "NT", chapters: 5, canon: "all" },
  { code: "2JN", slug: "2-john", name: "2 John", short: "2 John", testament: "NT", chapters: 1, canon: "all" },
  { code: "3JN", slug: "3-john", name: "3 John", short: "3 John", testament: "NT", chapters: 1, canon: "all" },
  { code: "JUD", slug: "jude", name: "Jude", short: "Jude", testament: "NT", chapters: 1, canon: "all" },
  { code: "REV", slug: "revelation", name: "Revelation", short: "Rev", testament: "NT", chapters: 22, canon: "all" },
];

const byCode = new Map(BOOKS.map((b) => [b.code, b]));
const bySlug = new Map(BOOKS.map((b) => [b.slug, b]));

export function bookByCode(code: string): Book | undefined {
  return byCode.get(code);
}

export function bookBySlug(slug: string): Book | undefined {
  return bySlug.get(slug);
}

export function bookIndex(code: string): number {
  return BOOKS.findIndex((b) => b.code === code);
}
