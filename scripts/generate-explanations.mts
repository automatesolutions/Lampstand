// Writes "In depth" explanations and saves them to content/explanations/<BOOK>.json
// as drafts for review. Needs ANTHROPIC_API_KEY in .env.local.
//
//   npx tsx scripts/generate-explanations.mts --sample GEN.2,JHN.3   write a few now and print the cost
//   npx tsx scripts/generate-explanations.mts --estimate             estimate the cost of every missing chapter
//   npx tsx scripts/generate-explanations.mts --batch                send every missing chapter as one batch (50% off)
//   npx tsx scripts/generate-explanations.mts --collect <batch id>   save a finished batch's results
//
// Chapters that already have a saved explanation are skipped unless --force is given.

import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXPLAIN_MODEL, chapterName, explainParams, finishExplanation, writeExplanation, type Explanation, type ExplainInput } from "../lib/explain/generate";

const root = join(import.meta.dirname, "..");
process.loadEnvFile(join(root, ".env.local"));

// Claude Opus 5.5 list prices, $ per million tokens; the Batches API halves them.
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

const readJson = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));
const counts: Record<string, number[]> = readJson("lib/bible/verse-counts.json");
const cards: Record<string, ExplainInput["card"]> = readJson("content/context-cards.json").cards;

export interface SavedExplanation {
  status: "draft" | "reviewed";
  text: string;
  model: string;
  generatedAt: string;
  fixed: string[];
  dropped: string[];
  reviewedBy?: string;
}

function input(book: string, chapter: number): ExplainInput {
  const kjv: string[][] = readJson(`content/kjv/${book}.json`).chapters;
  const notes = readJson(`content/chapters/${book}.json`).chapters;
  const xrefs = readJson(`content/xrefs/${book}.json`).chapters;
  return {
    ref: { book, chapter },
    verses: kjv[chapter - 1].map((text, i) => ({ number: i + 1, text })),
    card: cards[book] ?? null,
    note: notes[chapter - 1] ? { title: notes[chapter - 1].title, summary: notes[chapter - 1].summary } : null,
    xrefs: xrefs[chapter - 1] ?? [],
  };
}

const file = (book: string) => join(root, "content/explanations", `${book}.json`);

function load(book: string): { source: string; chapters: Record<string, SavedExplanation> } {
  return existsSync(file(book)) ? JSON.parse(readFileSync(file(book), "utf8")) : { source: "Written by Claude for Lampstand; cross-references from OpenBible.info (CC BY). Drafts until reviewed.", chapters: {} };
}

function save(book: string, chapter: number, e: Explanation) {
  mkdirSync(join(root, "content/explanations"), { recursive: true });
  const data = load(book);
  data.chapters[String(chapter)] = { status: "draft", text: e.text, model: e.model, generatedAt: new Date().toISOString(), fixed: e.fixed, dropped: e.dropped };
  const sorted = Object.fromEntries(Object.entries(data.chapters).sort((a, b) => Number(a[0]) - Number(b[0])));
  writeFileSync(file(book), JSON.stringify({ ...data, chapters: sorted }, null, 2) + "\n");
}

const cost = (u: Explanation["usage"], batch = false) => ((u.input * PRICE.input + u.output * PRICE.output + u.cacheRead * PRICE.cacheRead) / 1e6) * (batch ? 0.5 : 1);

function missing(force: boolean) {
  const out: { book: string; chapter: number }[] = [];
  for (const [book, verses] of Object.entries(counts)) {
    const have = load(book).chapters;
    verses.forEach((_, i) => {
      if (force || !have[String(i + 1)]) out.push({ book, chapter: i + 1 });
    });
  }
  return out;
}

const client = new Anthropic();
const args = process.argv.slice(2);
const force = args.includes("--force");

if (args[0] === "--sample") {
  const refs = (args[1] ?? "").split(",").filter(Boolean).map((r) => {
    const [book, chapter] = r.split(".");
    return { book: book.toUpperCase(), chapter: Number(chapter) };
  });
  let total = 0;
  let outTokens = 0;
  for (const r of refs) {
    const e = await writeExplanation(client, input(r.book, r.chapter));
    save(r.book, r.chapter, e);
    total += cost(e.usage);
    outTokens += e.usage.output;
    console.log(`${chapterName(r)}: ${e.text.split(/\s+/).length} words, $${cost(e.usage).toFixed(3)}${e.fixed.length ? `, fixed ${e.fixed.join("; ")}` : ""}${e.dropped.length ? `, dropped ${e.dropped.join("; ")}` : ""}`);
  }
  const per = total / refs.length;
  console.log(`\nAverage $${per.toFixed(3)} a chapter (${Math.round(outTokens / refs.length)} output tokens).`);
  console.log(`All 1,189 chapters: about $${(per * 1189).toFixed(0)} one at a time, about $${((per * 1189) / 2).toFixed(0)} as a batch.`);
} else if (args[0] === "--estimate") {
  const todo = missing(force);
  // Count the real input of a sample, and use the samples' measured output length.
  const sample = todo.filter((_, i) => i % Math.max(1, Math.floor(todo.length / 20)) === 0).slice(0, 20);
  let inTokens = 0;
  for (const r of sample) {
    const p = explainParams(input(r.book, r.chapter));
    inTokens += (await client.messages.countTokens({ model: p.model, system: p.system, messages: p.messages })).input_tokens;
  }
  const avgIn = inTokens / sample.length;
  const avgOut = 3500; // measured from samples, including thinking
  const perChapter = (avgIn * PRICE.input + avgOut * PRICE.output) / 1e6;
  console.log(`${todo.length} chapters to write. About ${Math.round(avgIn)} input tokens each.`);
  console.log(`Estimated cost: about $${((perChapter * todo.length) / 2).toFixed(0)} as a batch (one at a time: $${(perChapter * todo.length).toFixed(0)}).`);
} else if (args[0] === "--batch") {
  const todo = missing(force);
  const batch = await client.messages.batches.create({
    requests: todo.map((r) => ({ custom_id: `${r.book}.${r.chapter}`, params: explainParams(input(r.book, r.chapter)) })),
  });
  writeFileSync(join(root, "content/explanations/.last-batch"), batch.id + "\n");
  console.log(`Sent ${todo.length} chapters as batch ${batch.id}. Most batches finish within an hour.`);
  console.log(`When it's done: npx tsx scripts/generate-explanations.mts --collect ${batch.id}`);
} else if (args[0] === "--collect") {
  const id = args[1] ?? readFileSync(join(root, "content/explanations/.last-batch"), "utf8").trim();
  const status = await client.messages.batches.retrieve(id);
  if (status.processing_status !== "ended") {
    console.log(`Batch ${id} is still ${status.processing_status}: ${status.request_counts.processing} chapters left.`);
    process.exit(0);
  }
  let ok = 0;
  let total = 0;
  const failed: string[] = [];
  for await (const result of await client.messages.batches.results(id)) {
    const [book, chapter] = result.custom_id.split(".");
    if (result.result.type !== "succeeded") {
      failed.push(`${result.custom_id} (${result.result.type})`);
      continue;
    }
    try {
      const e = await finishExplanation(client, input(book, Number(chapter)), result.result.message);
      save(book, Number(chapter), e);
      total += cost(e.usage, true);
      ok++;
      if (e.fixed.length || e.dropped.length) console.log(`${result.custom_id}: fixed ${e.fixed.length}, dropped ${e.dropped.length}`);
    } catch (err) {
      failed.push(`${result.custom_id} (${(err as Error).message})`);
    }
  }
  console.log(`Saved ${ok} explanations (about $${total.toFixed(2)}).`);
  if (failed.length) console.log(`Not saved (run --batch again to retry just these):\n${failed.join("\n")}`);
} else {
  console.log("Use --sample BOOK.CHAPTER,..., --estimate, --batch, or --collect <batch id>. Model: " + EXPLAIN_MODEL);
}
