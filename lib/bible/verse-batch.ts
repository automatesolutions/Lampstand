// Shared by /api/verse/batch and the screens that call it (Notes).

export interface VerseRange {
  book: string; // USFM code
  chapter: number;
  verseStart: number;
  verseEnd: number;
}

export const MAX_BATCH_RANGES = 200;
export const MAX_RANGE_VERSES = 10;
export const MAX_BATCH_VERSES = 1000;

/** "JHN.3.16-17": the key a range's text comes back under. */
export const rangeKey = (r: VerseRange) => `${r.book}.${r.chapter}.${r.verseStart}-${r.verseEnd}`;

/** The range as the server returns it: at most MAX_RANGE_VERSES verses long. */
export const shownRange = (r: VerseRange): VerseRange => ({ ...r, verseEnd: Math.min(r.verseEnd, r.verseStart + MAX_RANGE_VERSES - 1) });
