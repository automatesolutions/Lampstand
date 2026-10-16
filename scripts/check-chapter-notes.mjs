// Checks content/chapters/*.json: one entry per chapter, key verses that exist, sane lengths.
// Usage: node scripts/check-chapter-notes.mjs
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const counts = JSON.parse(readFileSync(join(root, "lib/bible/verse-counts.json"), "utf8"));
let problems = 0;
let done = 0;
const missing = [];

for (const [code, verses] of Object.entries(counts)) {
  const file = join(root, "content/chapters", `${code}.json`);
  if (!existsSync(file)) {
    missing.push(code);
    continue;
  }
  const { chapters } = JSON.parse(readFileSync(file, "utf8"));
  const fail = (msg) => {
    problems++;
    console.log(`${code}: ${msg}`);
  };
  if (chapters.length !== verses.length) fail(`${chapters.length} entries for ${verses.length} chapters`);
  chapters.forEach((c, i) => {
    const n = i + 1;
    if (!c.title || c.title.length > 48) fail(`${n} title missing or longer than 48 characters`);
    if (!c.summary || c.summary.length < 60 || c.summary.length > 320) fail(`${n} summary is ${c.summary?.length ?? 0} characters (60–320)`);
    if (!Number.isInteger(c.key) || c.key < 1 || c.key > (verses[i] ?? 0)) fail(`${n} key verse ${c.key} is not in 1–${verses[i]}`);
  });
  done++;
}

console.log(`${done} books checked, ${problems} problems${missing.length ? `, missing: ${missing.join(" ")}` : ""}`);
process.exit(problems ? 1 : 0);
