// Checks an AI-written challenge question against the KJV text before it can be played
// (supabase/migrations/0012: only 'checked' or 'reviewed' questions are used). A question
// passes only when its evidence is copied exactly from the verses it cites, its correct
// choice comes from that evidence, and nothing makes a second choice defensible. Anything
// else stays a draft, listed for a person to look at.

export type Difficulty = "easy" | "medium" | "hard";

export interface DraftQuestion {
  chapter: number;
  verse_start: number;
  verse_end: number;
  difficulty: Difficulty;
  question: string;
  choices: string[];
  answer: number;
  /** The exact KJV words that settle the answer. */
  evidence: string;
}

const STOP = new Set(
  "the and of to in a an he she it they them his her their him that this was were is be been for with on at by from as or not but all unto upon into who what which when where why how did do does shall will said thou thee thy ye you your i my me we our us there then so".split(" "),
);
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const words = (s: string) => (s.toLowerCase().match(/[a-z0-9']+/g) ?? []).map((w) => w.replace(/'s$|'$/g, ""));
const content = (s: string) => words(s).filter((w) => w.length >= 3 && !STOP.has(w));
const NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** Every way a number might be written in the KJV ("12" is also "twelve"). */
function numberForms(choice: string): string[] {
  const n = /^\d+$/.test(choice.trim()) ? Number(choice.trim()) : NUMBERS.indexOf(choice.trim().toLowerCase());
  if (n < 0 || Number.isNaN(n)) return [];
  return [String(n), ...(NUMBERS[n] ? [NUMBERS[n]] : [])];
}

/** True when the evidence supports this choice: its key words (or its number) are in it. */
function grounded(choice: string, evidence: string): boolean {
  const ev = new Set(words(evidence));
  const forms = numberForms(choice);
  if (forms.length) return forms.some((f) => ev.has(f));
  const key = content(choice);
  return key.length > 0 && key.every((w) => ev.has(w) || ev.has(w.replace(/s$/, "")) || ev.has(`${w}s`));
}

/** Problems with a question; an empty list means it can be played. */
export function checkQuestion(q: DraftQuestion, chapterVerses: string[]): string[] {
  const problems: string[] = [];
  if (!["easy", "medium", "hard"].includes(q.difficulty)) problems.push("difficulty is not easy, medium or hard");
  if (!Number.isInteger(q.verse_start) || !Number.isInteger(q.verse_end) || q.verse_start < 1 || q.verse_end < q.verse_start || q.verse_end > chapterVerses.length) {
    problems.push("the verses don't exist");
    return problems;
  }
  if (q.verse_end - q.verse_start > 4) problems.push("cites more than five verses");
  const question = norm(q.question ?? "");
  if (question.length < 10 || question.length > 300 || !question.endsWith("?")) problems.push("the question isn't a 10 to 300 character question");
  const choices = (q.choices ?? []).map(norm);
  if (choices.length !== 4 || choices.some((c) => !c || c.length > 80)) problems.push("needs four short choices");
  if (new Set(choices.map((c) => c.toLowerCase())).size !== choices.length) problems.push("two choices are the same");
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) {
    problems.push("the answer isn't choice 1 to 4");
    return problems;
  }

  const text = norm(chapterVerses.slice(q.verse_start - 1, q.verse_end).join(" "));
  const evidence = norm(q.evidence ?? "");
  if (evidence.length < 3 || !text.includes(evidence)) problems.push("the evidence isn't copied exactly from the verses");
  const right = choices[q.answer] ?? "";
  if (!grounded(right, evidence)) problems.push("the correct choice doesn't come from the evidence");
  choices.forEach((c, i) => {
    if (i !== q.answer && c && grounded(c, evidence) && !grounded(c, right)) problems.push(`choice ${i + 1} is also supported by the evidence`);
  });
  const giveaway = content(right);
  if (giveaway.length && giveaway.every((w) => words(question).includes(w))) problems.push("the question gives the answer away");
  return problems;
}
