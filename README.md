# Lampstand

A Bible study web app that helps you read the Bible each day, understand what you read, and read it together with friends.

Built with Next.js 16, TypeScript, Tailwind CSS 4 and Supabase. Every screen follows [DESIGN.md](DESIGN.md).

## What it does

- **Read:** KJV (built in), NLT and ESV, with a thumb-first reader on phones. In the KJV, words of Jesus show in green and other speakers in blue (with a legend; turn it off in Text settings). The tab bar (Today, Read, Notes, Circles, Me) and the reader's controls stay on screen while you scroll.
- **Understand:** "In this chapter" notes, "Before you read" context cards, and "Explain in depth" for every chapter.
- **Pray:** a short prayer written from the chapters you read recently.
- **Make a song:** after you mark a chapter as read, choose Praise or Worship. Claude writes original lyrics from your last three chapters and ElevenLabs Music sings them (about 70 seconds). Needs an account; three songs a day.
- **Notes and highlights:** highlight one verse or several at once (drag, or long-press and drag on phones). Notes lists your notes and your highlights, grouped by book. Each highlight shows the verse (KJV) and a short AI summary to help you remember it. Tap a row to open the reader at that verse.
- **Circles (Lamplighters):** private, invite-only groups. See who has read today, send nudges, and chat. Messages and nudges show up under the bell on Circles and can also be emailed. Play a Bible challenge together: a live quiz with a join code, timer, leaderboard and podium, or the same questions on your own time to compare scores. Share a highlight (one verse or several) to your Circles from Notes or the reader, with your note and its summary if you choose; each Circle can also receive your new highlights automatically (off by default).
- **Guest first:** everything works on the device without an account. Signing in syncs notes, highlights (with their summaries), reading and settings.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000 (builds the avatar and mascot images first)
npm test         # pure logic, sync merging, song plans, the paid API routes (mocked), and the database rules (PGlite)
npm run build    # prerenders all 1,189 KJV chapters
```

## Keys

Server keys go in `.env.local` (never committed). On Cloud Run, set the same names as service variables or secrets.

```bash
# Bible versions
NLT_API_KEY=...        # New Living Translation, from api.nlt.to (non-commercial: 500 verses a request, 5,000 requests a day)
ESV_API_KEY=...        # English Standard Version, from api.esv.org (non-commercial: 5,000 queries a day, at most 500 verses stored)

# AI
ANTHROPIC_API_KEY=...  # Pray, Explain in depth, highlight summaries and song lyrics
ELEVENLABS_API_KEY=... # Make a song: records the lyrics with ElevenLabs Music (server only)
DAILY_AI_BUDGET_USD=2  # optional: Claude API spend per day (UTC) before the AI features pause (default 2)

# Daily limits (optional; UTC days, kept in Supabase so every server instance shares them)
DAILY_SONG_LIMIT=3              # songs a day for the whole app (default 3); 0 turns songs off
SONG_LIMIT_PER_USER=3           # songs a day per person (default 3)
SONG_LIMIT_PER_IP=6             # songs a day per network address (default 6)
HIGHLIGHT_SUMMARIES_PER_IP=40   # new highlight summaries a day per network address (default 40); cached ones are free
TRUSTED_PROXY_HOPS=1            # proxies that add to X-Forwarded-For: 1 on Cloud Run, 2 with a Google load balancer in front
USAGE_HASH_SECRET=...           # optional: the key used to hash network addresses (defaults to one made from SUPABASE_SECRET_KEY)

# Accounts and sync
NEXT_PUBLIC_SUPABASE_URL=...              # public, built into the app
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...  # public, built into the app
SUPABASE_SECRET_KEY=...   # server only: daily AI cap, saved explanations and summaries, Circle emails

# Circle emails (optional)
APP_URL=https://your-domain                 # the address used in links inside emails
RESEND_API_KEY=...                          # sends invite, nudge and message emails through resend.com
EMAIL_FROM="Lampstand <hello@your-domain>"  # a sender on a domain verified in Resend
```

### What happens without a key

| Missing | What readers see |
| --- | --- |
| `ANTHROPIC_API_KEY` | Pray says "Prayer isn't set up on this server yet." Explain in depth works only for chapters already written. Highlights save without a summary. Make a song says "Songs aren't set up on this server yet." |
| `ELEVENLABS_API_KEY` | Make a song says "Songs aren't set up on this server yet." No lyrics are written, so nothing is paid for. |
| `SUPABASE_SECRET_KEY` | The daily AI cap and the daily song and summary limits work per server instance only. Explanations and highlight summaries are kept in memory, not shared. Circle emails are off. |
| `RESEND_API_KEY`, `EMAIL_FROM` or `APP_URL` | Invites still work: the inviter copies the link. Nudges and messages are in-app only. |

### What things cost

- **Claude** (Sonnet 5.5): a prayer or song lyrics cost about $0.01 to $0.02. A highlight summary costs about $0.0015 and is written once per verse for every reader. All of it counts toward `DAILY_AI_BUDGET_USD`.
- **ElevenLabs:** each song is about 70 seconds of music on your ElevenLabs plan. It is **not** counted in the Claude budget; instead songs need an account and have their own daily limits (`DAILY_SONG_LIMIT` for the whole app, `SONG_LIMIT_PER_USER`, `SONG_LIMIT_PER_IP`), checked before every ElevenLabs call. A recording that fails gives its place back. Also set a usage limit in your ElevenLabs account as a backstop.
- **Highlight summaries** work for guests, so each network address has a burst limit (10 in 10 minutes) and a daily cap (`HIGHLIGHT_SUMMARIES_PER_IP`). That way one stranger can't use up the budget Pray, Explain and songs share.
- Set a monthly spend limit in the Claude Console as a backstop too.

## Supabase setup

Run the migrations in order in the SQL Editor:

| File | Adds |
| --- | --- |
| `0001_init.sql` | Profiles, reading, notes, highlights, with row-level security |
| `0002_sync.sql` | Settings and tombstones for account sync |
| `0003_feedback.sql` | "Was this helpful?" feedback |
| `0004_ai.sql` | Daily AI spend and saved explanations |
| `0005_lamplighters.sql` | Circles: members, invites, nudges, chat, mutes, blocks |
| `0006_notifications.sql` | Circle notifications, the "Email me Circle messages" switch, and the email sent marker |
| `0007_highlight_summaries.sql` | The `summary` column on highlights and the shared `verse_summaries` cache |
| `0008_song_usage.sql` | Lets song lyrics count toward the daily AI budget |
| `0009_usage_limits.sql` | Daily limits for paid features (songs, highlight summaries), shared by every server instance. Addresses are stored only as a hash |
| `0010_notification_email_retry.sql` | A Circle message email that failed to send goes out with the sender's next message (within an hour) |
| `0011_highlight_shares.sql` | Sharing highlights to Circles (as chat messages that follow their highlight) and the per-Circle auto-share choice |
| `0012_bible_challenge.sql` | The Circle Bible challenge: the question bank (server only), sets, live games, players, answers and play-on-your-own scores, with the timing and scoring in the database |

The app keeps working if a newer migration hasn't run yet (no notifications, no saved summaries), but run them before you deploy.

For Circles, also in the Supabase dashboard:
- **Realtime → Settings:** keep private channels allowed. Chat messages stream through row-level security; the typing indicator uses the members-only `circle:<id>` channel set up by `0005`.
- **Authentication → URL Configuration:** the Redirect URLs entry `https://your-domain/**` also covers invite links (`/auth/callback?next=/circles/join…`).
- Abuse reports land in the `reports` table (Table Editor). Nobody can read them through the app.

**Sign in with Google** (beside the email link): in Google Cloud, create an OAuth client (APIs & Services → Credentials → Web application) with the authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`. Then in Supabase, Authentication → Sign In / Providers → Google: switch it on and paste the client ID and secret. Until then the button says Google sign-in isn't switched on.

**Emails from your own address:** verify the domain in Resend (it adds DNS records; with Cloudflare it can add them for you), then set `EMAIL_FROM="Lampstand <hello@your-domain>"`. Cloudflare Email Routing only receives mail, so replies to that address still reach your inbox. To send Supabase's sign-in emails the same way, use Resend's SMTP in Authentication → Emails → SMTP Settings (host `smtp.resend.com`, port 465, user `resend`, password: the API key).

## How Circle notifications work

- The database writes the notifications itself (triggers in `0006`), so no browser can create, skip or fake one:
  - a chat message notifies every other member of the Circle
  - a nudge to one person notifies that person
  - a nudge to the whole Circle notifies each person it reached (not people who already read today, were nudged in the last 24 hours, or muted or blocked the sender)
- **Mute** (the bell-off button on a nudge) stops nudges and message notifications from that person or Circle. Their messages still show in the chat. Members turn it back on from Me.
- Emails go only to people who turned on "Email me nudges" or "Email me Circle messages" on Me (both off by default), one email per person, never to the sender. Each notification is marked before it's emailed, so a retried request never sends twice. If sending fails, the mark is cleared and the email goes out with that person's next message in the Circle (within an hour).
- Chat messages are sent through `/api/lamplighters/message`, so email addresses stay on the server.

## Deploying (Cloud Run)

- The two `NEXT_PUBLIC_…` values are built into the app, so pass them as build arguments: `--build-arg NEXT_PUBLIC_SUPABASE_URL=… --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…`.
- Set the server secrets on the Cloud Run service (Secret Manager is best): `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `SUPABASE_SECRET_KEY`, `NLT_API_KEY`, `ESV_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, and optionally `DAILY_AI_BUDGET_USD` and the daily limits above.
- Run any new Supabase migrations before the new version goes live.
- Add the live address to Supabase **Authentication → URL Configuration** (Site URL and `https://your-domain/**` in Redirect URLs).

## Where things live

**Screens**
- `app/` contains the routes. `(onboarding)` holds welcome, start and goal. `(tabs)` holds Today, Read, Notes, Circles and Me, plus plans and streak. The reader lives at `read/[version]/[book]/[chapter]`; Circle chat at `chat/[id]`.
- `components/ui/` has the design-system parts. `components/reader/` has the reader and its sheets.
- `components/prayer/`, `components/explain/` and `components/song/` hold the Pray, Explain in depth and Make a song sheets, mounted once in `app/layout.tsx`.

**Bible text and study content**
- `lib/bible/` is the version layer. The UI only uses `BibleProvider`, so licensed versions plug in as new providers.
- `content/kjv/` holds the KJV text (public domain), made by `scripts/import-kjv.mjs`.
- `lib/bible/providers/nlt-api.ts` fetches the NLT a chapter at a time from Tyndale's API and caches each chapter for days. The NLT copyright notice shows under every NLT chapter and on Me.
- `lib/bible/providers/esv-api.ts` fetches the ESV from Crossway's API. Crossway allows at most 500 verses stored, so chapters live in a small in-memory cache capped at 500 verses. Every page showing ESV text carries Crossway's notice and a link to www.esv.org.
- Text that leaves the reader (verse cards in chat, verses on Notes, anything sent to AI) is always KJV, so licensed text is never copied. Notes gets the words of all its highlights in one request (`app/api/verse/batch`, capped at 200 ranges and 1,000 verses).
- `content/context-cards.json` holds the book background notes. Their status is `draft` until reviewed.
- `content/chapters/` holds the "In this chapter" explanation and key verse for every chapter, also `draft` until reviewed. Check them with `node scripts/check-chapter-notes.mjs`.
- `public/plates/` holds one photoreal plate per book, made with Higgsfield.
- `content/quiz/` holds the Bible challenge questions, written once with `npx tsx scripts/generate-quiz.mts` (`--estimate` is free; `--sample`, `--batch` and `--collect` call Claude) and checked against the KJV text (`lib/quiz/check.ts`): a question is played only when its evidence is copied exactly from the verses and its answer comes from that evidence. Load them into Supabase with `npx tsx scripts/seed-quiz.mts` (free). Read `content/quiz/<BOOK>.md` to review them.
- `content/speakers/` holds who speaks where in the KJV, as character ranges in our text. Words of Jesus: `npx tsx scripts/import-speakers.mts <folder>` with the eBible.org KJV USFM files (eng-kjv2006, public domain; free, local). Other speakers: `npx tsx scripts/tag-speakers.mts` (`--estimate` is free; `--sample`, `--batch` and `--collect` call Claude; `--approve BOOK` after reviewing `content/speakers/draft/BOOK.md`). Every range is checked against our text, and anything that doesn't match exactly is left uncolored and listed.
- `content/xrefs/` holds each chapter's best-supported cross-references from OpenBible.info (CC BY), made by `node scripts/import-xrefs.mjs`.

**AI features** (all on the server; daily Claude spend cap in `lib/ai/budget.ts`, durable daily limits per person, address and app in `lib/ai/usage.ts`, short burst limits per address in `lib/ai/server.ts`)
- `content/explanations/` holds the pre-written "In depth" explanations, drafts until reviewed. Write them with `npx tsx scripts/generate-explanations.mts` (`--sample GEN.1,JHN.3`, `--estimate`, `--batch`, `--collect`). They are grounded in the chapter text and cross-references, and every Bible reference is checked against real verse counts (`lib/bible/check-refs.ts`).
- `/review` (only with `npm run dev`) is where a pastor or teacher reads, edits and approves explanations; commit `content/explanations` to publish. Explanations written when a reader first asked are kept in Supabase; copy them in for review with `npx tsx scripts/pull-explanations.mts` (free).
- `lib/explain/examples.ts` holds the model explanation and prayer that set the style. Edit them to change every future explanation and prayer.
- `app/api/prayer/` writes a prayer from recent chapters. Only chapter references are sent, plus an optional intention the reader types.
- `app/api/highlight-summary/` writes a highlight's summary from that verse's KJV text only. `lib/highlights/summaries.ts` asks for missing summaries in the background, one at a time, and tries again later when offline or paused.
- `app/api/song/lyrics/` writes the song (title, verse, chorus, verse) from the chapter notes, or the KJV text when a chapter has none, and signs it. `app/api/song/audio/` records only signed lyrics, once each, with ElevenLabs `music_v2`, and streams the mp3 without storing it. The sound of Praise and Worship, and the intro, verse and chorus plan, are in `lib/song.ts`.

**Data and sync**
- `lib/store/` is the on-device store for guest mode. `lib/streak/` and `lib/plans/` hold pure, tested logic.
- `lib/sync/` syncs the store with the account; `lib/sync/merge.ts` (tested) settles differences between devices.
- `supabase/migrations/` holds the database schema with row-level security.

**Lamplighters (Circles)**
- `0005_lamplighters.sql` and `0006_notifications.sql` hold every rule (membership, invites, nudge and chat limits, sharing choices, notifications, mutes) in the database; `lib/lamplighters/db.test.ts` runs them in PGlite.
- Screens are in `app/(tabs)/circles`, `app/chat` and `components/lamplighters/`.
- Routes that may send email are in `app/api/lamplighters/`; the email wording is in `lib/lamplighters/notify-email.ts`.
- Limits for the screens are in `lib/lamplighters/config.ts` (the database cap is `public.circle_member_limit()`).
- `content/mascot.json` holds everything the mascot says and the milestone thresholds. Edit freely; `{count}`, `{days}` and `{book}` are filled in.

### Adding avatars and mascot images

1. Drop `.png`, `.jpg` or `.webp` files into `assets/avatars` or `assets/mascot`. Square images of at least 256px (avatars) or 640px (mascot) look best.
2. Run `npm run dev` (or `npm run assets`). It makes small WebP copies in `public/lamplighters/` and lists them in `lib/lamplighters/assets.json`.
3. Commit `public/lamplighters/` and `lib/lamplighters/assets.json` (the Docker build doesn't include `assets/` or `scripts/`).

- An avatar's id is its file name in kebab case. Renaming or removing a file sends anyone who chose it back to the default lamp avatar until they pick again.
- Mascot moods come from the file name: include `cheer`, `wave`, `read` or `gentle` (for example `lamp-waving.png`). A file without a mood word stands in for any mood. Each message in `content/mascot.json` names the mood it wants.
- Optional alt text: add `labels.json` next to the images, like `{ "lamp-waving.png": "The lamp waving hello" }`.
