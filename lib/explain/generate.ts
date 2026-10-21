// Writes one chapter's "In depth" explanation with Claude, grounded in the chapter's
// KJV text, its book background, and real cross-references (OpenBible.info), then
// checks every Bible reference it cites and asks for a fix if any is wrong.
// Plain module (no server-only) so scripts/generate-explanations.ts can use it too.

import type Anthropic from "@anthropic-ai/sdk";
import { BOOKS, bookByCode } from "@/lib/bible/books";
import { checkRefs, dropBadLines, type RefProblem } from "@/lib/bible/check-refs";
import type { ChapterRef } from "@/lib/bible/types";
import { EXAMPLE_EXPLANATION, EXAMPLE_EXPLANATION_REF } from "./examples";

/** Opus for the one-time, reviewed batch; the app's live fallback uses Sonnet. */
export const EXPLAIN_MODEL = "claude-opus-5-5";

export interface ExplainInput {
  ref: ChapterRef;
  verses: { number: number; text: string }[];
  card?: { author: string; date: string; audience: string; setting: string; purpose: string } | null;
  note?: { title: string; summary: string } | null;
  /** [verse, "MAT 19:4-6", votes] from content/xrefs. */
  xrefs: [number, string, number][];
}

export const SECTIONS = ["Background", "What happens", "Key words and ideas", "Connections", "For reflection"];

const SYSTEM = `You explain Bible chapters for Lampstand, a Bible reading app, to ordinary readers who have just read the chapter.

Write about 450 to 650 words in plain, warm English, in exactly these sections, in this order, each starting with a line "## " and the heading:
## Background
Who wrote or is speaking, when, where, and what was happening. Mark traditional attributions as traditional.
## What happens
Walk through the chapter in order in a few short paragraphs, citing verse numbers like (v. 7) or (vv. 1–8).
## Key words and ideas
Two to four important words, images or ideas, each explained in a sentence or two. Start each one on a new line with "- ".
## Connections
How the chapter links to other parts of the Bible. Use only references from the list of cross-references you are given (choose the most helpful few and say how each one connects); do not cite any other passage in this section.
## For reflection
Two or three short questions for the reader to think about. Start each on a new line with "- ".

Rules:
- Stay close to what the text says. Base "What happens" on the chapter text you are given.
- Where Catholic, Orthodox and Protestant readers understand a passage differently, say so briefly and fairly instead of taking a side.
- Do not invent facts, dates, quotations or references. Write Bible references as "Book chapter:verse", for example "Matthew 19:4–6", using full book names.
- Use no markdown other than the "## " headings and "- " lines: no bold, no italics, no tables.

Here is an example of a good explanation, for ${EXAMPLE_EXPLANATION_REF}. Match its length, tone and kind of detail, not its content:

${EXAMPLE_EXPLANATION}`;

const NAME = new Map(BOOKS.map((b) => [b.code, b.name]));

/** "MAT 19:4-6" -> "Matthew 19:4–6" */
function refName(usfm: string) {
  const [code, rest] = usfm.split(" ");
  return `${NAME.get(code) ?? code} ${rest.replace("-", "–")}`;
}

export function chapterName(ref: ChapterRef) {
  const name = bookByCode(ref.book)?.name ?? ref.book;
  return ref.book === "PSA" ? `Psalm ${ref.chapter}` : `${name} ${ref.chapter}`;
}

function userPrompt({ ref, verses, card, note, xrefs }: ExplainInput) {
  const links = xrefs.map(([v, to]) => `- v. ${v} → ${refName(to)}`).join("\n");
  return [
    `Chapter: ${chapterName(ref)}`,
    card && `Book background: Author: ${card.author} Date: ${card.date} First readers: ${card.audience} Setting: ${card.setting} Purpose: ${card.purpose}`,
    note && `Short summary already shown to the reader: ${note.title}. ${note.summary}`,
    `Cross-references (from OpenBible.info; the only passages you may cite in "Connections"):\n${links || "- none"}`,
    `Text (King James Version):\n${verses.filter((v) => v.text).map((v) => `${v.number} ${v.text}`).join("\n")}`,
    "Please explain this chapter.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The request for one chapter (also used for the Message Batches API). */
export function explainParams(input: ExplainInput, model = EXPLAIN_MODEL): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model,
    max_tokens: 16000,
    output_config: { effort: "high" },
    // The instructions and example are the same for every chapter: cache them.
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt(input) }],
  };
}

export interface Explanation {
  text: string;
  model: string;
  /** References Claude was asked to correct, and any lines removed because they stayed wrong. */
  fixed: string[];
  dropped: string[];
  usage: { input: number; output: number; cacheRead: number };
}

const textOf = (m: Anthropic.Message) =>
  m.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

function assertComplete(m: Anthropic.Message, label: string) {
  if (m.stop_reason === "refusal") throw new Error(`${label}: declined (${m.stop_details?.category ?? "no category"})`);
  if (m.stop_reason === "max_tokens") throw new Error(`${label}: cut off at the length limit`);
}

export function missingSections(text: string) {
  return SECTIONS.filter((s) => !text.includes(`## ${s}`));
}

/**
 * Checks a first draft's references and section headings, asks Claude once to fix
 * anything wrong, and drops lines that are still wrong after that.
 */
export async function finishExplanation(client: Anthropic, input: ExplainInput, first: Anthropic.Message, model = EXPLAIN_MODEL): Promise<Explanation> {
  const label = chapterName(input.ref);
  assertComplete(first, label);
  let text = textOf(first);
  const usage = { input: first.usage.input_tokens, output: first.usage.output_tokens, cacheRead: first.usage.cache_read_input_tokens ?? 0 };
  let problems: RefProblem[] = checkRefs(text, input.ref);
  const missing = missingSections(text);
  const fixed = problems.map((p) => `${p.text} (${p.reason})`);

  if (problems.length || missing.length) {
    const params = explainParams(input, model);
    const asks = [
      ...problems.map((p) => `- "${p.text}" is not a real reference (${p.reason}).`),
      ...missing.map((s) => `- The "## ${s}" section is missing.`),
    ];
    const second = await client.messages
      .stream({
        ...params,
        messages: [
          ...params.messages,
          { role: "assistant", content: first.content },
          { role: "user", content: `Please fix these problems and send the whole corrected explanation again, with nothing else:\n${asks.join("\n")}` },
        ],
      })
      .finalMessage();
    assertComplete(second, label);
    text = textOf(second);
    usage.input += second.usage.input_tokens;
    usage.output += second.usage.output_tokens;
    usage.cacheRead += second.usage.cache_read_input_tokens ?? 0;
    problems = checkRefs(text, input.ref);
  }

  const dropped = problems.map((p) => `${p.text} (${p.reason})`);
  text = dropBadLines(text, problems);
  const stillMissing = missingSections(text);
  if (stillMissing.length) throw new Error(`${label}: missing sections ${stillMissing.join(", ")}`);
  return { text, model, fixed, dropped, usage };
}

/** One chapter, start to finish (streaming, so long answers never time out). */
export async function writeExplanation(client: Anthropic, input: ExplainInput, model = EXPLAIN_MODEL): Promise<Explanation> {
  const first = await client.messages.stream(explainParams(input, model)).finalMessage();
  return finishExplanation(client, input, first, model);
}
