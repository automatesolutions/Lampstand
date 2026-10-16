export type VersionId = "KJV" | "NKJV" | "ESV" | "NLT" | "NABRE";

export type Testament = "OT" | "NT";

/** "all" = in every canon; "deutero" = Catholic/Orthodox canon only (Tobit, Sirach, ...). */
export type Canon = "all" | "deutero";

export interface Book {
  code: string; // USFM code, e.g. "JHN"
  slug: string; // URL segment, e.g. "john"
  name: string;
  short: string;
  testament: Testament;
  chapters: number;
  canon: Canon;
}

/** A chapter location that does not depend on the version. */
export interface ChapterRef {
  book: string; // USFM code
  chapter: number;
}

export interface VerseRef extends ChapterRef {
  verse: number;
}

export interface Verse {
  number: number;
  text: string;
}

export interface Chapter extends ChapterRef {
  version: VersionId;
  verses: Verse[];
}

export interface VersionInfo {
  id: VersionId;
  name: string;
  available: boolean;
  copyright: string;
  /** A link the publisher asks us to show with the text. */
  link?: { href: string; label: string };
}
