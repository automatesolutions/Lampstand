// The one-time AI pass that marks words spoken by people other than Jesus (DESIGN.md §8
// Speaker colors). Results are drafts for review: nothing shows in the app until a book
// is approved. Needs ANTHROPIC_API_KEY in .env.local for the paid steps.
//
//   npx tsx scripts/tag-speakers.mts --estimate [BOOKS]        the cost, from the text alone (free, no API call)
//   npx tsx scripts/tag-speakers.mts --sample JHN.4,GEN.3      tag a few chapters now (paid) to check quality
//   npx tsx scripts/tag-speakers.mts --batch [BOOKS]           send the chapters as one batch (paid, 50% off)
//   npx tsx scripts/tag-speakers.mts --collect <batch id>      save a finished batch as drafts
//   npx tsx scripts/tag-speakers.mts --approve <BOOK|all>      after review: show that book's speakers in the app
//
// BOOKS is a comma list of codes (MAT,MRK,LUK,JHN,ACT); without it, every book.
// Drafts: content/speakers/draft/<BOOK>.json, with a readable list in content/speakers/draft/<BOOK>.md.

import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BOOKS } from "../lib/bible/books";
import { estimateCost, placeClaims, tagParams, TAG_MODEL, type Claim } from "../lib/bible/speaker-tags";
import type { SpeakerBook, SpeakerSpan } from "../lib/bible/speakers";

const root = join(import.meta.dirname, "..");
if (existsSync(join(root, ".env.local"))) process.loadEnvFile(join(root, ".env.local"));
const readJson = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));
const speakersFile = (code: string) => join(root, "content/speakers", `${code}.json`);
const draftDir = join(root, "content/speakers/draft");

const kjv = (code: string): string[][] => readJson(`content/kjv/${code}.json`).chapters;
const nameOf = (code: string) => BOOKS.find((b) => b.code === code)?.name ?? code;
function jesusIn(code: string, chapter: number): Record<number, SpeakerSpan[]> {
  if (!existsSync(speakersFile(code))) return {};
  const book: SpeakerBook = JSON.parse(readFileSync(speakersFile(code), "utf8"));
  const c = book.chapters[String(chapter)] ?? {};
  return Object.fromEntries(Object.entries(c).map(([v, spans]) => [Number(v), spans.filter((s) => s[2] === "jesus")]));
}

const args = process.argv.slice(2);
const books = (list?: string) =>
  list ? list.split(",").map((s) => s.trim().toUpperCase()) : BOOKS.filter((b) => existsSync(join(root, "content/kjv", `${b.code}.json`))).map((b) => b.code);
const chaptersOf = (codes: string[]) => codes.flatMap((code) => kjv(code).map((verses, i) => ({ code, chapter: i + 1, verses })));

/** Saves one chapter's checked results as a draft, and rewrites that book's review list. */
function saveDraft(code: string, chapter: number, claims: Claim[]) {
  mkdirSync(draftDir, { recursive: true });
  const file = join(draftDir, `${code}.json`);
  const draft = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { model: TAG_MODEL, chapters: {}, rejected: {} };
  const verses = kjv(code)[chapter - 1];
  const placed = placeClaims(verses, claims, jesusIn(code, chapter));
  draft.chapters[chapter] = placed.spans;
  draft.rejected[chapter] = placed.rejected;
  writeFileSync(file, JSON.stringify(draft, null, 1));
  // A list to read through: each verse, who speaks, and the words that will be colored.
  const md = [`# ${nameOf(code)}: other speakers (draft, ${TAG_MODEL})`, "", `Check each line. Fix the JSON or rerun a chapter with --sample, then: npx tsx scripts/tag-speakers.mts --approve ${code}`, ""];
  for (const [c, byVerse] of Object.entries(draft.chapters as Record<string, Record<string, SpeakerSpan[]>>).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    md.push(`## ${nameOf(code)} ${c}`, "");
    for (const [v, spans] of Object.entries(byVerse)) for (const [s, e, , who] of spans) md.push(`- ${c}:${v} **${who}**: ${kjv(code)[Number(c) - 1][Number(v) - 1].slice(s, e)}`);
    for (const r of draft.rejected[c] ?? []) md.push(`- ${c}:${r.verse} REJECTED (${r.reason}): ${r.speaker}, "${r.first_words}" to "${r.last_words}"`);
    md.push("");
  }
  writeFileSync(join(draftDir, `${code}.md`), md.join("\n"));
  return placed;
}

function claimsFrom(msg: Anthropic.Message): Claim[] {
  if (msg.stop_reason !== "end_turn") throw new Error(`stopped: ${msg.stop_reason}`);
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return (JSON.parse(text) as { speeches: Claim[] }).speeches;
}

if (args[0] === "--estimate") {
  const list = chaptersOf(books(args[1])).map((c) => ({ chars: c.verses.join(" ").length + c.verses.length * 4 }));
  const e = estimateCost(list);
  console.log(`${e.chapters} chapters, about ${(e.inputTokens / 1e6).toFixed(2)}M input tokens and ${(e.outputTokensLow / 1e6).toFixed(2)}M to ${(e.outputTokensHigh / 1e6).toFixed(2)}M output tokens.`);
  console.log(`Estimated cost with ${TAG_MODEL} through the Batches API (half price): $${e.usdLow.toFixed(2)} to $${e.usdHigh.toFixed(2)}. Nothing was sent.`);
} else if (args[0] === "--sample") {
  const client = new Anthropic();
  for (const ref of (args[1] ?? "").split(",").filter(Boolean)) {
    const [code, ch] = ref.split(".");
    const chapter = Number(ch);
    const res = await client.messages.create(tagParams(nameOf(code), chapter, kjv(code)[chapter - 1], jesusIn(code, chapter)));
    const placed = saveDraft(code, chapter, claimsFrom(res));
    const cost = (res.usage.input_tokens * 4 + res.usage.output_tokens * 20) / 1e6;
    console.log(`${ref}: ${Object.values(placed.spans).flat().length} speeches placed, ${placed.rejected.length} rejected, $${cost.toFixed(3)}. See content/speakers/draft/${code}.md`);
  }
} else if (args[0] === "--batch") {
  const client = new Anthropic();
  const todo = chaptersOf(books(args[1]));
  const batch = await client.messages.batches.create({
    requests: todo.map((c) => ({ custom_id: `${c.code}-${c.chapter}`, params: tagParams(nameOf(c.code), c.chapter, c.verses, jesusIn(c.code, c.chapter)) })),
  });
  console.log(`Sent ${todo.length} chapters as batch ${batch.id}. When it's done: npx tsx scripts/tag-speakers.mts --collect ${batch.id}`);
} else if (args[0] === "--collect") {
  const client = new Anthropic();
  const id = args[1];
  const status = await client.messages.batches.retrieve(id);
  if (status.processing_status !== "ended") {
    console.log(`Batch ${id} is ${status.processing_status}. Try again later.`);
    process.exit(0);
  }
  const failed: string[] = [];
  let placedCount = 0;
  let rejectedCount = 0;
  for await (const r of await client.messages.batches.results(id)) {
    const [code, ch] = r.custom_id.split("-");
    if (r.result.type !== "succeeded") {
      failed.push(`${r.custom_id} (${r.result.type})`);
      continue;
    }
    try {
      const placed = saveDraft(code, Number(ch), claimsFrom(r.result.message));
      placedCount += Object.values(placed.spans).flat().length;
      rejectedCount += placed.rejected.length;
    } catch (e) {
      failed.push(`${r.custom_id} (${(e as Error).message})`); // a refusal or a cut-off answer: rerun with --sample
    }
  }
  console.log(`Saved drafts: ${placedCount} speeches placed, ${rejectedCount} rejected for review.${failed.length ? ` Not saved: ${failed.join(", ")}` : ""}`);
} else if (args[0] === "--approve") {
  const codes = args[1] === "all" ? books() : books(args[1]);
  for (const code of codes) {
    const file = join(draftDir, `${code}.json`);
    if (!existsSync(file)) continue;
    const draft = JSON.parse(readFileSync(file, "utf8")) as { chapters: Record<string, Record<string, SpeakerSpan[]>> };
    const book: SpeakerBook = existsSync(speakersFile(code))
      ? JSON.parse(readFileSync(speakersFile(code), "utf8"))
      : { source: "Other speakers marked by Claude and reviewed for Lampstand", status: "reviewed", chapters: {} };
    for (const [c, byVerse] of Object.entries(draft.chapters)) {
      const chapter = (book.chapters[c] ??= {});
      for (const v of Object.keys(chapter)) chapter[v] = chapter[v].filter((s) => s[2] !== "other"); // replace earlier approvals
      for (const [v, spans] of Object.entries(byVerse)) chapter[v] = [...(chapter[v] ?? []), ...spans].sort((a, b) => a[0] - b[0]);
      for (const v of Object.keys(chapter)) if (!chapter[v].length) delete chapter[v];
    }
    if (!book.source.includes("Other speakers") && !book.source.includes("other speakers")) book.source = `${book.source}; other speakers marked by Claude and reviewed`;
    writeFileSync(speakersFile(code), JSON.stringify(book));
    console.log(`Approved ${code}: its other speakers now show in the app.`);
  }
} else {
  console.log("Use --estimate [BOOKS], --sample BOOK.CHAPTER,..., --batch [BOOKS], --collect <batch id>, or --approve <BOOK|all>. Model: " + TAG_MODEL);
}
