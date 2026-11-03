# Lampstand

A Bible study web app that helps you read the Bible each day and understand what you read.

Built with Next.js 16, TypeScript and Tailwind CSS 4. Every screen follows [DESIGN.md](DESIGN.md).

## Run it

```bash
npm install
npm run dev      # http://localhost:3000 (builds the avatar and mascot images first)
npm test         # streak, plan and milestone logic, and the Circles database rules
npm run build    # prerenders all 1,189 KJV chapters
```

Server keys go in `.env.local` (never committed):

```bash
NLT_API_KEY=...        # New Living Translation, from api.nlt.to (non-commercial: 500 verses a request, 5,000 requests a day)
ESV_API_KEY=...        # English Standard Version, from api.esv.org (non-commercial: 5,000 queries a day, at most 500 verses stored)
ANTHROPIC_API_KEY=...  # Pray and Explain in depth
NEXT_PUBLIC_SUPABASE_URL=...              # accounts and sync (public)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...  # accounts and sync (public)
SUPABASE_SECRET_KEY=...   # server only: daily AI cap and saved explanations
DAILY_AI_BUDGET_USD=2     # optional: Claude API spend per day before Pray and Explain pause (default 2)
APP_URL=https://your-domain   # Circles: the address used in invite and nudge emails
RESEND_API_KEY=...            # Circles: send invite and nudge emails through resend.com (optional)
EMAIL_FROM="Lampstand <hello@your-domain>"  # Circles: a sender on a domain verified in Resend
```

Without `RESEND_API_KEY`, `EMAIL_FROM` and `APP_URL`, invites still work: the inviter copies the link and sends it themselves, and nudges are in-app only.

Without the Anthropic key, Pray shows "Prayer isn't set up on this server yet." Without the secret key, the daily cap still works but only per server instance, and on-the-spot explanations are kept in memory only.

Run the Supabase migrations in order in the SQL Editor: `0001_init.sql` to `0005_lamplighters.sql`.

For Circles (Lamplighters), also in the Supabase dashboard:
- **Realtime → Settings:** keep private channels allowed. Chat messages stream through row-level security; the typing indicator uses the members-only `circle:<id>` channel set up by `0005`.
- **Authentication → URL Configuration:** the Redirect URLs entry `https://your-domain/**` also covers invite links (`/auth/callback?next=/circles/join…`).
- Abuse reports land in the `reports` table (Table Editor). Nobody can read them through the app.

**Sign in with Google** (beside the email link): in Google Cloud, create an OAuth client (APIs & Services → Credentials → Web application) with the authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`. Then in Supabase, Authentication → Sign In / Providers → Google: switch it on and paste the client ID and secret. Until then the button says Google sign-in isn't switched on.

**Emails from your own address:** verify the domain in Resend (it adds DNS records; with Cloudflare it can add them for you), then set `EMAIL_FROM="Lampstand <hello@your-domain>"`. Cloudflare Email Routing only receives mail, so replies to that address still reach your inbox. To send Supabase's sign-in emails the same way, use Resend's SMTP in Authentication → Emails → SMTP Settings (host `smtp.resend.com`, port 465, user `resend`, password: the API key).

### Deploying (Cloud Run)

- The two `NEXT_PUBLIC_…` values are built into the app, so pass them as build arguments: `--build-arg NEXT_PUBLIC_SUPABASE_URL=… --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…`.
- Set the server secrets on the Cloud Run service (Secret Manager is best): `ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY`, `NLT_API_KEY`, `ESV_API_KEY`, and optionally `DAILY_AI_BUDGET_USD`.
- Add the live address to Supabase **Authentication → URL Configuration** (Site URL and `https://your-domain/**` in Redirect URLs).
- Also set a monthly spend limit in the Claude Console as a backstop.

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
- `/review` (only with `npm run dev`) is where a pastor or teacher reads, edits and approves explanations; commit `content/explanations` to publish. Explanations written when a reader first asked are kept in Supabase; copy them in for review with `npx tsx scripts/pull-explanations.mts` (free).
- `lib/explain/examples.ts` holds the model explanation and prayer that set the style. Edit them to change every future explanation and prayer.
- `app/api/prayer/` writes a prayer from recent chapters with the Claude API.
- `supabase/migrations/` holds the database schema with row-level security.
- **Lamplighters (Circles)**: `0005_lamplighters.sql` holds every rule (membership, invites, nudge and chat limits, sharing choices) in the database; `lib/lamplighters/db.test.ts` runs them in PGlite. Screens are in `app/(tabs)/circles`, `app/chat` and `components/lamplighters/`; routes that may send email are in `app/api/lamplighters/`. Limits for the screens are in `lib/lamplighters/config.ts` (the database cap is `public.circle_member_limit()`).
- `content/mascot.json` holds everything the mascot says and the milestone thresholds. Edit freely; `{count}`, `{days}` and `{book}` are filled in.

### Adding avatars and mascot images

1. Drop `.png`, `.jpg` or `.webp` files into `assets/avatars` or `assets/mascot`. Square images of at least 256px (avatars) or 640px (mascot) look best.
2. Run `npm run dev` (or `npm run assets`). It makes small WebP copies in `public/lamplighters/` and lists them in `lib/lamplighters/assets.json`.
3. Commit `public/lamplighters/` and `lib/lamplighters/assets.json` (the Docker build doesn't include `assets/` or `scripts/`).

- An avatar's id is its file name in kebab case. Renaming or removing a file sends anyone who chose it back to the default lamp avatar until they pick again.
- Mascot moods come from the file name: include `cheer`, `wave`, `read` or `gentle` (for example `lamp-waving.png`). A file without a mood word stands in for any mood. Each message in `content/mascot.json` names the mood it wants.
- Optional alt text: add `labels.json` next to the images, like `{ "lamp-waving.png": "The lamp waving hello" }`.
