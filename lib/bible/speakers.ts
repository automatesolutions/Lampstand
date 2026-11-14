// Speaker colors in the KJV (DESIGN.md §8 Speaker colors): words of Jesus, and words of
// other speakers, as character ranges in our own KJV text (content/kjv). Pure, so the
// reader, the importer (scripts/import-speakers.mts) and the tests share it.
//
// Words of Jesus come from the eBible.org KJV (eng-kjv2006, public domain), whose USFM
// marks them with \wj ... \wj*. Our text comes from another public-domain KJV file, so the
// importer lines the two up letter by letter and never guesses: a verse whose letters
// don't match exactly is left uncolored and listed in the import report.

export type Speaker = "jesus" | "other";

/** [start, end) in the verse's text, who speaks there, and (for other speakers) their name. */
export type SpeakerSpan = [number, number, Speaker, string?];

/** One book: chapter -> verse -> spans. Only verses with speech are listed. */
export interface SpeakerBook {
  source: string;
  status: "draft" | "reviewed";
  chapters: Record<string, Record<string, SpeakerSpan[]>>;
}

export interface Segment {
  text: string;
  who?: Speaker;
}

/** Splits a verse into plain and spoken parts, for coloring. Bad or overlapping spans are ignored. */
export function speakerSegments(text: string, spans: SpeakerSpan[] | undefined): Segment[] {
  if (!spans?.length) return [{ text }];
  const out: Segment[] = [];
  let at = 0;
  for (const [s, e, who] of [...spans].sort((a, b) => a[0] - b[0])) {
    const start = Math.max(s, at);
    const end = Math.min(e, text.length);
    if (end <= start) continue;
    if (start > at) out.push({ text: text.slice(at, start) });
    out.push({ text: text.slice(start, end), who });
    at = end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

/** The same spans, for the text from `offset` on (verse 1 opens with a separate drop cap). */
export const shiftSpans = (spans: SpeakerSpan[] | undefined, offset: number): SpeakerSpan[] | undefined =>
  spans
    ?.map(([s, e, w, name]): SpeakerSpan => (name ? [Math.max(0, s - offset), Math.max(0, e - offset), w, name] : [Math.max(0, s - offset), Math.max(0, e - offset), w]))
    .filter(([s, e]) => e > s);

// ---- Reading USFM ---------------------------------------------------------------

/** A verse from USFM: its words, and for each character whether it's inside \wj. */
export interface UsfmVerse {
  chapter: number;
  verse: number;
  text: string;
  jesus: boolean[];
}

/**
 * Reads the verses of one USFM book. Keeps the words (including \add italics and \nd),
 * drops footnotes, cross references, Strong's numbers and headings, and notes which
 * characters are inside \wj ... \wj* (words of Jesus).
 */
export function parseUsfm(usfm: string): UsfmVerse[] {
  const out: UsfmVerse[] = [];
  let chapter = 0;
  let cur: UsfmVerse | null = null;
  let jesus = false;
  // Footnotes and cross references, with their contents.
  const src = usfm.replace(/\\f\s[\s\S]*?\\f\*/g, "").replace(/\\x\s[\s\S]*?\\x\*/g, "").replace(/\\fe\s[\s\S]*?\\fe\*/g, "");
  const push = (s: string) => {
    if (!cur) return;
    for (const ch of s) {
      cur.text += ch;
      cur.jesus.push(jesus);
    }
  };
  // Tokens: a marker (\name, \name*, \+name, \+name*) or a run of text.
  const re = /\\(\+?[a-z]+\d*\*?)|([^\\]+)/g;
  let m: RegExpExecArray | null;
  let skipLine = false;
  while ((m = re.exec(src))) {
    if (m[1]) {
      const tag = m[1].replace(/^\+/, "");
      if (tag === "c") {
        const num = /^\s*(\d+)/.exec(src.slice(re.lastIndex));
        if (num) {
          chapter = Number(num[1]);
          re.lastIndex += num[0].length;
        }
        cur = null;
        jesus = false;
      } else if (tag === "v") {
        const num = /^\s*(\d+)(?:-\d+)?\s?/.exec(src.slice(re.lastIndex));
        if (num) {
          re.lastIndex += num[0].length;
          cur = { chapter, verse: Number(num[1]), text: "", jesus: [] };
          out.push(cur);
        }
        skipLine = false;
      } else if (tag === "wj") jesus = true;
      else if (tag === "wj*") jesus = false;
      else if (/^(s\d?|ms\d?|mt\d?|mr|r|d|h|toc\d|id|ide|rem|cl|sp|cp|ca)$/.test(tag)) {
        // Headings and book data: skip to the end of the line.
        skipLine = true;
      } else if (/^(p|m|q\d?|pi\d?|nb|b|li\d?|pc|pmo|mi)$/.test(tag)) {
        skipLine = false;
        if (cur && cur.text && !/\s$/.test(cur.text)) push(" ");
      }
      // Character styles (\add, \nd, \w, \qs, \tl ...) keep their words.
    } else if (m[2]) {
      let t = m[2];
      if (skipLine) {
        const nl = t.indexOf("\n");
        if (nl < 0) continue;
        t = t.slice(nl + 1);
        skipLine = false;
      }
      // \w word|strong="H1234"\w*: keep the word only.
      t = t.replace(/\|[^\\]*$/, "");
      push(t.replace(/\s+/g, " "));
    }
  }
  for (const v of out) {
    // One space between words, none at the ends, keeping each character's flag in step
    // with it (a flag that slid by even one place would color the wrong letters).
    let text = "";
    const flags: boolean[] = [];
    for (let i = 0; i < v.text.length; i++) {
      const ch = /\s/.test(v.text[i]) ? " " : v.text[i];
      if (ch === " " && (text === "" || text.endsWith(" "))) continue;
      text += ch;
      flags.push(v.jesus[i]);
    }
    if (text.endsWith(" ")) {
      text = text.slice(0, -1);
      flags.pop();
    }
    v.text = text;
    v.jesus = flags;
  }
  return out;
}

// ---- Lining up with our text ------------------------------------------------------

const isLetter = (ch: string) => /[\p{L}\p{N}]/u.test(ch);
const fold = (ch: string) => ch.toLowerCase();

/**
 * Carries the words-of-Jesus flags from the USFM verse onto our verse text, letter by
 * letter (punctuation and spacing may differ between the two files). Returns null when
 * the letters don't match: then the verse is left uncolored and reported.
 */
export function alignJesus(ours: string, usfm: UsfmVerse): SpeakerSpan[] | null {
  // eBible writes "Cæsar" and "Alphæus" where our text has "Caesar" and "Alphaeus": æ and œ
  // count as the two letters they stand for.
  const LIGATURES: Record<string, string> = { æ: "ae", œ: "oe" };
  const theirs: { ch: string; j: boolean }[] = [];
  for (let i = 0; i < usfm.text.length; i++) {
    if (!isLetter(usfm.text[i])) continue;
    for (const ch of LIGATURES[fold(usfm.text[i])] ?? fold(usfm.text[i])) theirs.push({ ch, j: usfm.jesus[i] });
  }
  if (!theirs.some((x) => x.j)) return [];
  const flags = new Array<boolean>(ours.length).fill(false);
  let k = 0;
  for (let i = 0; i < ours.length; i++) {
    if (!isLetter(ours[i])) continue;
    if (k >= theirs.length || theirs[k].ch !== fold(ours[i])) return null;
    flags[i] = theirs[k].j;
    k++;
  }
  if (k !== theirs.length) return null;

  // Runs of flagged letters, joined across spaces and punctuation between them, then
  // stretched over closing punctuation right after (", . ; : ? !").
  const spans: SpeakerSpan[] = [];
  let i = 0;
  while (i < ours.length) {
    if (!flags[i]) {
      i++;
      continue;
    }
    const start = i;
    let end = i + 1;
    let j = end;
    while (j < ours.length) {
      if (flags[j]) end = j + 1;
      else if (isLetter(ours[j])) break;
      j++;
    }
    while (end < ours.length && /[,.;:?!'’)]/.test(ours[end])) end++;
    spans.push([start, end, "jesus"]);
    i = Math.max(j, end);
  }
  return spans;
}
