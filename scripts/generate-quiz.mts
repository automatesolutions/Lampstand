// Writes the Circle Bible challenge questions, once, into content/quiz/<BOOK>.json, checking
// every answer against the KJV text (lib/quiz/check.ts). Questions that pass are "checked"
// and can be played; the rest stay "draft" with the reason, for a person to fix or drop.
// Load them into Supabase afterwards with scripts/seed-quiz.mts (free).
// Needs ANTHROPIC_API_KEY in .env.local for the paid steps.
//
//   npx tsx scripts/generate-quiz.mts --estimate [BOOKS]      the cost, from the text alone (free, no API call)
//   npx tsx scripts/generate-quiz.mts --sample JHN.3,GEN.1    write a few chapters now (paid) to check quality
//   npx tsx scripts/generate-quiz.mts --batch [BOOKS]         send every chapter as one batch (paid, 50% off)
//   npx tsx scripts/generate-quiz.mts --collect <batch id>    save a finished batch
//
// BOOKS is a comma list of codes (GEN,JHN); without it, every book. Chapters that already
// have questions are skipped, so each is written (and paid for) once.

import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BOOKS } from "../lib/bible/books";
import { checkQuestion, type DraftQuestion } from "../lib/quiz/check";
import { estimateQuizCost, QUIZ_MODEL, quizParams } from "../lib/quiz/generate";

const root = join(import.meta.dirname, "..");
if (existsSync(join(root, ".env.local"))) process.loadEnvFile(join(root, ".env.local"));
const dir = join(root, "content/quiz");
const kjv = (code: string): string[][] => JSON.parse(readFileSync(join(root, "content/kjv", `${code}.json`), "utf8")).chapters;
const nameOf = (code: string) => BOOKS.find((b) => b.code === code)?.name ?? code;

export interface SavedQuestion extends DraftQuestion {
  id: string;
  status: "draft" | "checked" | "reviewed" | "rejected";
  problems: string[];
  model: string;
}
const file = (code: string) => join(dir, `${code}.json`);
const load = (code: string): { questions: SavedQuestion[] } => (existsSync(file(code)) ? JSON.parse(readFileSync(file(code), "utf8")) : { questions: [] });
const hasChapter = (code: string, chapter: number) => load(code).questions.some((q) => q.chapter === chapter);

function save(code: string, chapter: number, drafts: Omit<DraftQuestion, "chapter">[]) {
  mkdirSync(dir, { recursive: true });
  const verses = kjv(code)[chapter - 1];
  const data = load(code);
  data.questions = data.questions.filter((q) => q.chapter !== chapter);
  let passed = 0;
  for (const d of drafts) {
    const q: DraftQuestion = { ...d, chapter };
    const problems = checkQuestion(q, verses);
    if (!problems.length) passed++;
    data.questions.push({ id: randomUUID(), ...q, status: problems.length ? "draft" : "checked", problems, model: QUIZ_MODEL });
  }
  data.questions.sort((a, b) => a.chapter - b.chapter || a.verse_start - b.verse_start);
  writeFileSync(file(code), JSON.stringify(data, null, 1));
  // A list to read through.
  const md = [`# ${nameOf(code)}: challenge questions (${QUIZ_MODEL})`, "", "Checked questions can be played. Fix or delete drafts in the JSON, then run scripts/seed-quiz.mts.", ""];
  for (const q of data.questions) {
    md.push(`- **${q.status}** ${nameOf(code)} ${q.chapter}:${q.verse_start}${q.verse_end > q.verse_start ? `-${q.verse_end}` : ""} (${q.difficulty}): ${q.question}`);
    md.push(`  ${q.choices.map((c, i) => (i === q.answer ? `**${c}**` : c)).join(" / ")}. Evidence: "${q.evidence}"${q.problems.length ? `. Problems: ${q.problems.join("; ")}` : ""}`);
  }
  writeFileSync(join(dir, `${code}.md`), md.join("\n") + "\n");
  return { passed, total: drafts.length };
}

function draftsFrom(msg: Anthropic.Message): Omit<DraftQuestion, "chapter">[] {
  if (msg.stop_reason !== "end_turn") throw new Error(`stopped: ${msg.stop_reason}`);
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return (JSON.parse(text) as { questions: Omit<DraftQuestion, "chapter">[] }).questions;
}

const args = process.argv.slice(2);
const books = (list?: string) => (list ? list.split(",").map((s) => s.trim().toUpperCase()) : BOOKS.filter((b) => existsSync(join(root, "content/kjv", `${b.code}.json`))).map((b) => b.code));
const todo = (codes: string[]) => codes.flatMap((code) => kjv(code).map((verses, i) => ({ code, chapter: i + 1, verses }))).filter((c) => !hasChapter(c.code, c.chapter));

if (args[0] === "--estimate") {
  const list = todo(books(args[1])).map((c) => ({ chars: c.verses.join(" ").length + c.verses.length * 4 }));
  const e = estimateQuizCost(list);
  console.log(`${e.chapters} chapters (${e.questions} questions), about ${(e.inputTokens / 1e6).toFixed(2)}M input and ${(e.outputTokensLow / 1e6).toFixed(2)}M to ${(e.outputTokensHigh / 1e6).toFixed(2)}M output tokens.`);
  console.log(`Estimated cost with ${QUIZ_MODEL} through the Batches API (half price): $${e.usdLow.toFixed(2)} to $${e.usdHigh.toFixed(2)}. Nothing was sent.`);
} else if (args[0] === "--sample") {
  const client = new Anthropic();
  for (const ref of (args[1] ?? "").split(",").filter(Boolean)) {
    const [code, ch] = ref.split(".");
    const res = await client.messages.create(quizParams(nameOf(code), Number(ch), kjv(code)[Number(ch) - 1]));
    const r = save(code, Number(ch), draftsFrom(res));
    console.log(`${ref}: ${r.passed} of ${r.total} questions checked, $${((res.usage.input_tokens * 4 + res.usage.output_tokens * 20) / 1e6).toFixed(3)}. See content/quiz/${code}.md`);
  }
} else if (args[0] === "--batch") {
  const client = new Anthropic();
  const list = todo(books(args[1]));
  const batch = await client.messages.batches.create({ requests: list.map((c) => ({ custom_id: `${c.code}.${c.chapter}`, params: quizParams(nameOf(c.code), c.chapter, c.verses) })) });
  console.log(`Sent ${list.length} chapters as batch ${batch.id}. When it's done: npx tsx scripts/generate-quiz.mts --collect ${batch.id}`);
} else if (args[0] === "--collect") {
  const client = new Anthropic();
  const id = args[1];
  const status = await client.messages.batches.retrieve(id);
  if (status.processing_status !== "ended") {
    console.log(`Batch ${id} is ${status.processing_status}. Try again later.`);
    process.exit(0);
  }
  let passed = 0;
  let total = 0;
  const failed: string[] = [];
  for await (const r of await client.messages.batches.results(id)) {
    const [code, ch] = r.custom_id.split(".");
    if (r.result.type !== "succeeded") {
      failed.push(`${r.custom_id} (${r.result.type})`);
      continue;
    }
    try {
      const s = save(code, Number(ch), draftsFrom(r.result.message));
      passed += s.passed;
      total += s.total;
    } catch (e) {
      failed.push(`${r.custom_id} (${(e as Error).message})`);
    }
  }
  console.log(`Saved: ${passed} of ${total} questions checked against the KJV.${failed.length ? ` Not saved: ${failed.join(", ")}` : ""} Next: npx tsx scripts/seed-quiz.mts`);
} else {
  console.log("Use --estimate [BOOKS], --sample BOOK.CHAPTER,..., --batch [BOOKS], or --collect <batch id>. Model: " + QUIZ_MODEL);
}
