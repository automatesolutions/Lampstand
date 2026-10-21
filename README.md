# Lampstand

A Bible study web app that helps you read the Bible each day and understand what you read.

Built with Next.js 16, TypeScript and Tailwind CSS 4. Every screen follows [DESIGN.md](DESIGN.md).

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # streak and plan logic
npm run build    # prerenders all 1,189 KJV chapters
```

Server keys go in `.env.local` (never committed):

```bash
NLT_API_KEY=...        # New Living Translation, from api.nlt.to (non-commercial: 500 verses a request, 5,000 requests a day)
ESV_API_KEY=...        # English Standard Version, from api.esv.org (non-commercial: 5,000 queries a day, at most 500 verses stored)
ANTHROPIC_API_KEY=...  # the Pray button
```

Without it, Pray shows "Prayer isn't set up on this server yet."

## Where things live

- `app/` contains the routes. `(onboarding)` holds welcome, start and goal. `(tabs)` holds Today, Read, Notes and Me, plus plans and streak. The reader lives at `read/[version]/[book]/[chapter]`.
- `components/ui/` has the design-system parts. `components/reader/` has the reader and its sheets.
- `lib/bible/` is the version layer. The UI only uses `BibleProvider`, so licensed versions plug in as new providers.
- `lib/store/` is the on-device store for guest mode. `lib/streak/` and `lib/plans/` hold pure, tested logic.
- `content/kjv/` holds the KJV text (public domain), made by `scripts/import-kjv.mjs`.
- `lib/bible/providers/nlt-api.ts` fetches the NLT a chapter at a time from Tyndale's API and caches each chapter for days. The NLT copyright notice shows under every NLT chapter and on Me.
- `lib/bible/providers/esv-api.ts` fetches the ESV from Crossway's API. Crossway allows at most 500 verses stored, so chapters live in a small in-memory cache capped at 500 verses. Every page showing ESV text carries Crossway's notice and a link to www.esv.org.
- `content/context-cards.json` holds the book background notes. Their status is `draft` until reviewed.
- `content/chapters/` holds the "In this chapter" explanation and key verse for every chapter, also `draft` until reviewed. Check them with `node scripts/check-chapter-notes.mjs`.
- `public/plates/` holds one photoreal plate per book, made with Higgsfield.
- `content/xrefs/` holds each chapter's best-supported cross-references from OpenBible.info (CC BY), made by `node scripts/import-xrefs.mjs`.
- `content/explanations/` holds the pre-written "In depth" explanations, drafts until reviewed. Write them with `npx tsx scripts/generate-explanations.mts` (`--sample GEN.1,JHN.3`, `--estimate`, `--batch`, `--collect`). They are grounded in the chapter text and cross-references, and every Bible reference is checked against real verse counts (`lib/bible/check-refs.ts`).
- `/review` (only with `npm run dev`) is where a pastor or teacher reads, edits and approves explanations; commit `content/explanations` to publish.
- `lib/explain/examples.ts` holds the model explanation and prayer that set the style. Edit them to change every future explanation and prayer.
- `app/api/prayer/` writes a prayer from recent chapters with the Claude API.
- `supabase/migrations/` holds the database schema with row-level security.
