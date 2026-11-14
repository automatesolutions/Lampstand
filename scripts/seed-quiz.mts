// Loads content/quiz/*.json into Supabase (public.quiz_questions, migration 0012). Free:
// it only writes to your own database, with SUPABASE_SECRET_KEY from .env.local.
// Every question goes in with its status; games use only "checked" and "reviewed" ones.
// Safe to run again: questions are matched by id.
//
// Usage: npx tsx scripts/seed-quiz.mts

import { createClient } from "@supabase/supabase-js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
if (existsSync(join(root, ".env.local"))) process.loadEnvFile(join(root, ".env.local"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const dir = join(root, "content/quiz");

let total = 0;
const counts: Record<string, number> = {};
for (const f of existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith(".json")) : []) {
  const book = f.replace(/\.json$/, "");
  const { questions } = JSON.parse(readFileSync(join(dir, f), "utf8")) as { questions: Record<string, unknown>[] };
  const rows = questions.map((q) => ({
    id: q.id, book, chapter: q.chapter, verse_start: q.verse_start, verse_end: q.verse_end, difficulty: q.difficulty,
    question: q.question, choices: q.choices, answer: q.answer, evidence: q.evidence, status: q.status, model: q.model,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("quiz_questions").upsert(rows.slice(i, i + 500), { onConflict: "id" });
    if (error) {
      console.error(`${book}: ${error.message}`);
      process.exit(1);
    }
  }
  for (const q of questions) counts[String(q.status)] = (counts[String(q.status)] ?? 0) + 1;
  total += rows.length;
}
console.log(`Loaded ${total} questions: ${Object.entries(counts).map(([s, n]) => `${n} ${s}`).join(", ") || "none yet"}.`);
