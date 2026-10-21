import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { revalidateTag } from "next/cache";
import { bookByCode } from "@/lib/bible/books";
import { checkRefs } from "@/lib/bible/check-refs";
import { missingSections } from "@/lib/explain/generate";
import { explanationsTag, type SavedExplanation } from "@/lib/explain/saved";

// Review of pre-written explanations (the /review page). It edits the files in
// content/explanations, so it only runs on a developer's own machine: in a
// production build it doesn't exist. Commit the changed files to publish reviews.

const enabled = process.env.NODE_ENV === "development";
const notFound = () => Response.json({ error: "Not found" }, { status: 404 });
const file = (code: string) => join(process.cwd(), "content", "explanations", `${code}.json`);

async function load(code: string) {
  try {
    return JSON.parse(await readFile(file(code), "utf8")) as { source: string; chapters: Record<string, SavedExplanation> };
  } catch {
    return null;
  }
}

/** ?book=GEN: that book's saved explanations. No book: how many each book has, and how many are reviewed. */
export async function GET(req: Request) {
  if (!enabled) return notFound();
  const code = new URL(req.url).searchParams.get("book")?.toUpperCase() ?? "";
  if (!code) {
    const { BOOKS } = await import("@/lib/bible/books");
    const books = [];
    for (const b of BOOKS) {
      const chapters = Object.values((await load(b.code))?.chapters ?? {});
      if (chapters.length) books.push({ code: b.code, name: b.name, chapters: b.chapters, saved: chapters.length, reviewed: chapters.filter((c) => c.status === "reviewed").length });
    }
    return Response.json({ books });
  }
  if (!bookByCode(code)) return notFound();
  return Response.json({ chapters: (await load(code))?.chapters ?? {} });
}

/** Save an edit and/or a review decision for one chapter. */
export async function POST(req: Request) {
  if (!enabled) return notFound();
  const body = (await req.json().catch(() => null)) as { book?: string; chapter?: number; text?: string; status?: "draft" | "reviewed"; reviewer?: string } | null;
  const meta = bookByCode(String(body?.book ?? "").toUpperCase());
  const chapter = Number(body?.chapter);
  const data = meta && (await load(meta.code));
  const entry = data?.chapters[String(chapter)];
  if (!meta || !data || !entry) return Response.json({ error: "That chapter has no saved explanation." }, { status: 404 });

  const text = typeof body?.text === "string" ? body.text.trim() : entry.text;
  const problems = checkRefs(text, { book: meta.code, chapter }).map((p) => `${p.text}: ${p.reason}`);
  const missing = missingSections(text).map((s) => `Missing section: ${s}`);
  if (body?.status === "reviewed" && (problems.length || missing.length)) {
    return Response.json({ error: "Fix these before approving.", problems: [...problems, ...missing] }, { status: 422 });
  }

  data.chapters[String(chapter)] = {
    ...entry,
    text,
    status: body?.status ?? entry.status,
    ...(body?.status === "reviewed" ? { reviewedBy: body.reviewer?.trim().slice(0, 80) || "a reviewer", reviewedAt: new Date().toISOString() } : {}),
    ...(body?.status === "draft" ? { reviewedBy: undefined, reviewedAt: undefined } : {}),
  } as SavedExplanation;
  await writeFile(file(meta.code), JSON.stringify(data, null, 2) + "\n");
  revalidateTag(explanationsTag(meta.code), { expire: 0 });
  return Response.json({ ok: true, entry: data.chapters[String(chapter)], problems: [...problems, ...missing] });
}
