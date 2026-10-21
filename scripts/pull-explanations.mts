// Copies "In depth" explanations that readers caused to be written (Supabase
// explanations table) into content/explanations as drafts, so they appear on /review.
// Chapters that already have a file entry are left alone. Free: no AI calls.
//
//   npx tsx scripts/pull-explanations.mts
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.

import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
process.loadEnvFile(join(root, ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const rows: { book: string; chapter: number; text: string; model: string; created_at: string }[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("explanations").select("book, chapter, text, model, created_at").order("book").order("chapter").range(from, from + 999);
  if (error) {
    console.error(`Couldn't read explanations: ${error.message}`);
    process.exit(1);
  }
  rows.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

mkdirSync(join(root, "content/explanations"), { recursive: true });
const byBook = Map.groupBy(rows, (r) => r.book);
let added = 0;
for (const [book, list] of byBook) {
  const file = join(root, "content/explanations", `${book}.json`);
  const data = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : { source: "Written by Claude for Lampstand; cross-references from OpenBible.info (CC BY). Drafts until reviewed.", chapters: {} };
  for (const r of list) {
    if (data.chapters[String(r.chapter)]) continue;
    data.chapters[String(r.chapter)] = { status: "draft", text: r.text, model: r.model, generatedAt: new Date(r.created_at).toISOString(), fixed: [], dropped: [] };
    added++;
  }
  data.chapters = Object.fromEntries(Object.entries(data.chapters).sort((a, b) => Number(a[0]) - Number(b[0])));
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}
console.log(`${rows.length} explanations in Supabase; ${added} new ones added to content/explanations for review.`);
