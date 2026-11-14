# Lampstand design system

Every screen and component follows this file. If code and this file disagree, this file wins; change it here first, then in code.

Companion rules: `/hig` (touch sizes and contrast) and `/my-tone` (copy). Tokens live in `app/globals.css`. Names here match the CSS variables (`--gold-text` = `gold-text`).

Approved mockup: https://claude.ai/artifact/Gi5QnytNyzQ6jgjaSydyJH (v3, 2026-10-16).

## 1. Direction: the illuminated page

Lampstand looks like a well-made book lit by one small lamp, not like a settings app.

- **The lamp is the progress.** Today's reading fills the lamp: the flame and its glow grow from an ember to full as chapters are read. No rings, no bars for the daily goal.
- **Gold leaf, used once per view.** A gold-leaf drop cap opens each chapter and the Up next excerpt. The gold gradient (`leaf-*`) is for drop caps, the lamp flame and the reading progress line only.
- **Books are objects.** Read shows books as spines on six shelves. A spine's height grows with its chapter count, so Psalms stands tallest and Obadiah shortest.
- **Manuscript pigments sort the canon.** Each kind of book has one pigment (§2). Pigments mark kind only: shelf, swatch, spine. They are never text color and never the accent.
- **Quiet everywhere else.** Paper grain, hairlines, warm neutrals, one filled button per screen.

## 2. Color tokens

Contrast ratios are against `bg` in the same theme, checked for WCAG AA.

| Token | Day | Night | Use |
|---|---|---|---|
| `bg` | `#F5EFE3` | `#16120D` | Page (paper) |
| `bg-soft` | `#F5EFE3` | `#16120D` | Reader page (same as `bg`) |
| `surface` | `#ECE3D1` | `#1F1912` | Inset areas: lamp card, inputs, shelves, chapter cells |
| `surface-raised` | `#FBF8F1` | `#261F16` | Raised cards, sheets, popovers, verse bar |
| `text` | `#241C13` (14.7:1) | `#F1E7D3` (15.2:1) | Body and titles |
| `text-secondary` | `#5D5244` (6.7:1; 6.0:1 on `surface`) | `#B7A78C` (7.9:1; 6.9:1 on `surface-raised`) | Metadata, captions |
| `text-tertiary` | `#8A7D6A` | `#7D705C` | Decorative only, never text people must read |
| `divider` | `#D9CCB4` | `#3B3125` | Hairlines (1px) |
| `gold` | `#A8791F` (3.4:1) | `#DCAF55` | Non-text: flame, focus ring, dots, progress |
| `gold-text` | `#77560F` (5.9:1; 5.1:1 on `gold-wash`) | `#E8C579` (11.3:1; 7.7:1 on `gold-wash`) | Gold links and labels |
| `gold-wash` | `#EFDFB8` | `#3D311C` | Selection, active rail item, read chapters |
| `gold-strong` | `#7A5810` | `#DCAF55` | Primary button fill |
| `on-gold` | `#FFFAF0` (6.3:1) | `#1B150E` (8.9:1) | Text on `gold-strong` |
| `leaf-1/2/3` | `#D9AD4B` `#8D6214` `#E8C877` | `#F0CD7A` `#B8862C` `#FFE3A1` | Gold-leaf gradient only |
| `glow` | `rgba(214,160,52,.28)` | `rgba(240,180,70,.30)` | Lamp glow |
| `danger` | `#B23A2C` | `#F07A6C` | Destructive actions only |
| `scrim` | `rgba(30,20,8,.32)` | `rgba(0,0,0,.55)` | Behind sheets |

**Pigments** (one per kind of book, §8 Shelves). Day / Night:

| Token | Kind | Day | Night |
|---|---|---|---|
| `pg-law` | Law (Genesis–Deuteronomy) | `#3B5888` lapis | `#8EA8D8` |
| `pg-history` | History (Joshua–Esther) | `#426D5D` verdigris | `#8CC4AE` |
| `pg-poetry` | Poetry and Wisdom (Job–Song of Solomon) | `#8A5D16` ochre | `#E0B366` |
| `pg-prophets` | Prophets (Isaiah–Malachi) | `#A4473A` vermilion | `#E48E7D` |
| `pg-gospels` | Gospels and Acts | `#94506A` madder | `#D995B0` |
| `pg-letters` | Letters and Revelation | `#6A4D86` murex | `#B9A0DE` |

Spine labels are `#FFF8EA` on Day pigments (5.4:1 or more) and `#1B150E` on Night pigments (7.3:1 or more).

**Highlights** use the stored names `gold`, `sky`, `sage`, `rose` (matches `highlights.color` in the migration), painted at 22 to 26% over the text: `gold`, `pg-law`, `pg-history`, `pg-gospels`.

Rules:
- **No glare.** Never pure white `#FFF` or pure black `#000` as a page. Night is warm brown with cream text, built for long evening reading. High-contrast near-black with white text (developer-tool style) is not allowed: it causes halation over long passages.
- **Depth.** Day uses `shadow-soft` on raised cards. Night uses no shadows; depth comes from the surface ladder `bg` → `surface` → `surface-raised`.
- **Color is never the only signal.** Selection also gets a ring or check; highlighted verses say so to screen readers.
- **Paper grain:** a fixed SVG noise layer at 50% (Day, multiply) / 35% (Night, soft-light), `pointer-events: none`.

## 3. Typography

| Role | Family | Use |
|---|---|---|
| Display | **Cormorant Garamond** 500/600/700 | Page titles, chapter numerals, card titles, drop caps, the lamp count |
| Scripture | **Literata** (opsz axis) 400/500 + italic | Bible text, quotes in notes |
| Interface | **Hanken Grotesk** 400/500/600 | Everything else |

All three are self-hosted with `next/font/google`. Never fall back to bare system UI fonts as the design font; `system-ui` is only the last fallback.

**Scale** (rem, so browser zoom works):

| Style | Size / line | Font | Use |
|---|---|---|---|
| `display` | 44 / 44 (38 on phones) | Display 600 | Top of each tab |
| `title` | 30 / 33 | Display 600 | Card and sheet titles, "John 3" |
| `numeral` | 80 / 72 | Display 600 `gold-text` | Chapter number in the reader |
| `headline` | 17 / 22 | UI 600 | Row titles, buttons |
| `body` | 17 / 24 | UI 400 | UI body |
| `subhead` | 15 / 21 | UI 400 | Secondary text |
| `footnote` | 13 / 18 | UI 400 | Metadata |
| `eyebrow` | 12 / 16 | UI 600, uppercase, tracking .14em | Labels above titles and groups |

**Scripture:** default 19px, sizes 16, 17, 19, 21, 23, 26. Line spacing Snug 1.6 / Easy 1.78 (default) / Airy 2.0. Column `max-width: 64ch`. Verse numbers in UI font at .72em, `text-secondary`, lifted slightly. Verse 1 has no number; it opens with the drop cap.

Minimum text size anywhere: 12px. Body text is never under 16px.

## 4. Space, layout, shape

- **Grid:** 4px. Steps: 4, 8, 12, 16, 20, 24, 28, 32, 40, 48.
- **Side gutter:** 16px phones, 40px desktop. Content column max 680px; Today on desktop is 960px with two columns (lamp 340px + passage).
- **Radius:** `r-sm` 10 (chips, cells), `r-md` 14 (buttons, inputs), `r-lg` 20 (cards), `r-xl` 24–28 (lamp card, sheets). Not everything gets a card: the reader text, page titles and shelves sit on the paper.
- **Safe areas:** every fixed bar adds its edge's `env(safe-area-inset-*)`.

## 5. Ergonomics

### 5.1 Phones: thumb first

The bottom third of the screen is the easy zone; the top corners are the hardest. Main actions live low.

- **Tab bar** at the bottom, 56px + safe area, labels always shown.
- **Today:** the lamp card is a compact strip so the passage sits high, and **Continue reading** is `position: sticky` just above the tab bar.
- **Read:** the **Go to** search bar floats above the tab bar (§5.3).
- **Reader:** the tab bar stays (Today, Read, Notes, Circles, Me), so every tab is one tap away while reading. Just above it sits the reader's **thumb bar**: Previous, chapter picker ("John 3 ▾"), Text, Next. Each 52px tall, at least 56px wide. Top-right reader icons are desktop only.
- **Bars stay put.** The tab bar (on every screen, the reader included), the reader's top bar and its thumb bar stay on screen while you scroll, so the menu is always one tap away. Pages keep bottom padding (bar height + safe area + 40px) so the last row is never covered.
- **Swipe** sideways on the text (more than 70px, mostly horizontal) for the next or previous chapter.
- **Sheets** open from the bottom on phones, centered from 640px, with a Close button, Escape, and focus returned to the trigger.
- **The verse bar** (highlight, note, copy) docks at the bottom above the thumb bar, never as a popover near the top.

### 5.2 Touch sizes

- Every control is at least **44×44px**. Defaults: buttons 48px, large buttons 54px, list rows 56px, palette rows 52px, chapter cells 52px, book spines 44px wide.
- At least 8px between controls.
- Raycast-style 36px buttons and 6px row padding are **not** allowed: they are mouse sizes.

### 5.3 Keyboard: the Go to palette

One box finds anything and runs any action, after Raycast's command palette, sized for touch.

- **Open:** `⌘K` / `Ctrl K` anywhere, `/` when not typing, the **Go to…** button in the desktop rail, the Go to bar on Read.
- **Finds:** references as people type them (`jn 3:16`, `ps 23`, `1cor 13`, `rom`), notes by text, and actions (Continue reading, Mark as read, Add a note, Text settings, Day/Night, Notes, Daily goal). Empty query shows Recent, then Actions.
- **Matching:** a book matches when its name or short form starts with the query, or the letters appear in order with the same first letter. Starts rank first, then shorter names (`jn` → John before Jonah). Chapter and verse must exist.
- **Keys:** ↑ ↓ move, ↵ opens, Esc closes. ARIA combobox + listbox, `aria-activedescendant`.

**Reader keys:** ← → chapter, ↑ ↓ verse, ⇧↑ ⇧↓ select more verses (or fewer), ⇧ Enter or ⇧ click extends to that verse, `1`–`4` highlight colors (every selected verse), `N` note, `C` copy, `A` text settings, Esc clears the selection.

**Key caps** (`Kbd`) show shortcuts where they apply: palette footer, rail, verse bar, end of chapter. Shown only on `(hover: hover) and (pointer: fine)`, so phones stay clean. Mac shows `⌘ K`, others `Ctrl K`.

### 5.4 Desktop

- From 960px a **side rail** (232px) replaces the tab bar: brand, Go to…, Today, Read, Notes, Circles, Me (the same five tabs as the phone bar, in the same order, with the same unread dot on Circles).
- The reader keeps its top bar with version and text controls; the thumb bar is hidden.

### 5.5 Reading comfort

- Line length 64ch, line spacing 1.78 by default, adjustable size and spacing in the Text sheet.
- Warm Night theme (no blue-white glare), chosen by Day / Night / Auto.
- A 2px gold progress line under the reader top bar shows how far through the chapter you are.

## 6. Interaction and motion

- **Pressed:** buttons scale to .97 and dim to .88 (150ms).
- **Focus:** 2px `gold` outline, 2px offset, on `:focus-visible`. Never just a brighter border.
- **Arrive:** views fade up 8px over 350ms with `ease-out` `cubic-bezier(.2,.8,.2,1)`.
- **The lamp:** flame scale and glow follow progress over 900ms. The flame flickers gently (3.2s). Marking a chapter read kindles it once (900ms) and the glow blooms (1.4s). This is the one orchestrated moment.
- **Reduced motion:** no flicker, kindle, bloom, slide or scale. Instant state changes only.
- Nothing auto-dismisses on a timer except the short "Copied" / "Note saved" status, which also stays readable to screen readers via `role="status"`.

## 7. Icons and drawings

- **Lucide** through Iconify (`icon-[lucide--name]`) for UI icons, 20px in rows, 24px in bars.
- **Book plates.** One photoreal plate per book (`public/plates/<BOOK>.real.webp`, 1200×800; rename the suffix whenever images are replaced so caches refresh), made with Higgsfield in one shared photoreal style: a cinematic 35mm film still of the ancient Near East and Mediterranean world, natural light and color, no frame. God is shown only as light, people are seen from behind or at a distance, and there are no anachronisms (domes, modern buildings) and never text in the image. Shown cropped to 16:7 in the reader and 16:6 on Today.
- **Custom SVG** only for the lamp (`components/brand/LampMark.tsx` and `Lamp.tsx`) and the fleuron ornament under chapter numbers.
- Icon-only buttons always have an `aria-label`.

## 8. Components

**Button.** `primary` (`gold-strong` fill, `on-gold` text, soft glow), `secondary` (`surface` fill), `plain` (`gold-text`). Default 48px, large 54px full width. At most one `primary` per screen.

**Lamp.** Sizes 132 (Today desktop), 84 (Today phone strip), 104 (chapter done), 28 (week). `progress` 0–1 drives flame scale `.35 + p × .75` and glow. Has `role="img"` and a label like "1 of 3 chapters read today".

**Week of lamps.** Seven small lamps, Monday first: lit (goal met, gold flame), rest day (dashed outline), not yet or missed (muted outline). Each has an `sr-only` label. Replaces the flame-icon streak line on Today.

**Passage card.** The book plate across the top, an eyebrow with pigment swatch and kind ("Up next · Gospels"), title, a three-line excerpt with drop cap, an "In this chapter" line (falls back to the context card), and the one primary button.

**Shelves.** One shelf per kind with pigment diamond, name and count. Spines are buttons: 44px wide, height `88 + √chapters × 9` px, short name written vertically, gold bands top and bottom, a gold dot when started. Each shelf scrolls sideways inside itself. A spine opens the chapter grid sheet.

**Chapter grid.** 52px cells; read chapters get `gold-wash` and a dot; where you are gets a gold ring; a legend explains both.

**Reader header.** Eyebrow with the book's full title, the `numeral`, a fleuron rule.

**In this chapter.** One raised card under the chapter header: the book plate, eyebrow "In this chapter", the chapter title, a two-sentence explanation, and "Key verse 3:16", which selects and scrolls to that verse. Content is `content/chapters/<BOOK>.json` (status `draft` until reviewed; `node scripts/check-chapter-notes.mjs` checks counts and verse numbers). The context card sits at the bottom of the same card.

**Context card ("Before you read").** Inside the In this chapter card, collapsed by default to one line (author · date · setting). Expands to five rows (Author, Date, First readers, Setting, Why it was written) and the footnote that these are background notes and traditions differ. It never covers the text as a sheet.

**Verse.** Inline paragraphs. Tap or Enter selects (`gold-wash`, ring if highlighted) and shows the verse bar. Notes show a gold dot after the verse.

**Selecting several verses.** Every selected verse shows the selection style while it's being chosen, so a drag is easy to follow.
- Mouse: press and drag across verses. Range mode starts only once the pointer reaches a second verse, so selecting words inside one verse still works as usual.
- Phones: long-press a verse (450ms, held still; a light buzz where supported), then drag. Moving before then is a scroll or a chapter swipe, never a selection. During the drag the page doesn't scroll under the finger; it moves on its own near the top and bottom. The browser's own long-press (word selection, the Copy menu) is off on Bible text on touch screens, so the two never fight; Copy in the verse bar copies the selection instead.
- Fallbacks: ⇧ click a last verse, or **Select more** in the verse bar, then tap the last verse ("Tap the last verse" shows under the reference).
- A highlight covers a run of verses as one ("John 3:16–18"). Verses never carry two colors: a new color over part of a highlight trims or splits it. If every selected verse already has the color, tapping it again takes the color off just those verses.

**Verse bar.** The selected reference ("John 3:16–18"), Select more (pressed while waiting for the last verse), Close; four highlight swatches (44px, check when every selected verse has that color), Note (on the selected verses), Copy (the selected verses, numbered when there are several).

**Highlights on Notes.** Below the notes, a Highlights section grouped by book like notes. Each row: the color dot (named for screen readers), the reference ("John 3:16", or "John 3:16–18" for several verses), the highlighted words in Literata (KJV, marked "KJV"; left out when offline; the first 10 verses of a longer highlight, saying so), and a two- or three-sentence summary under a thin rule of that verse with the footnote "Summary written by AI to help you remember this verse." Tapping a row opens the reader with those verses selected. Summaries are written for highlights of up to 20 verses; a longer one says so instead. The summary is written in the background when the highlight is made, from the verse's KJV text only (`app/api/highlight-summary`, cached per verse for every reader); until then the row says one will appear. A new color keeps the summary; removing the highlight removes it. Summaries sync with the account and are never shared with Circles.

**Chapter done.** Replaces the Mark as read button in place: the lamp kindles, "John 3 is read", today's count, then Add a note and the next chapter, then, under a rule, three plain actions: "Explain in depth", "Pray over what you read" and "Make a song" (stacked on phones, side by side from 480px, wrapping as needed). Make a song appears only here, after Mark as read: never on the Mark as read button, Today or Go to.

**In depth sheet.** Pre-written per chapter (Claude Opus 5.5, grounded in KJV text and OpenBible cross-references, every reference checked) and reviewed on /review; the footnote says "not yet reviewed" or "reviewed by …", credits OpenBible.info, and ends with "Was this helpful? · Helpful · Something's wrong" (saved to the Supabase feedback table). Opens from the chapter done card, the In this chapter card, or Go to. A Claude-written explanation in five sections (Background, What happens, Key words and ideas, Connections, For reflection), streamed; headings are gold eyebrows, lists use gold diamonds. Grounded in the KJV text of the chapter whatever version is on screen, so licensed text never leaves the app. Finished explanations are reused for every reader. Footer: Pray over what you read.

**Start over.** Reading rounds: once all 1,189 chapters are read, Today and Read show "You've read the whole Bible" with a lamp and a Start over button; Me has a Start over row any time, with this round's progress. A confirm sheet (Not now / Begin again) explains that read marks clear while streak, notes, highlights and history stay, then opens Genesis 1. Read shows a thin gold "Through the Bible" bar with the round's count.

**Pray sheet.** Opens from the chapter done card, a row on Today, or Go to. It prays over the chapter on screen plus the most recent reads, three in all, named at the top ("Praying over John 3, John 2, and John 1"). The prayer streams in Literata at reading size and always ends "In Jesus' Name, Amen." (added by the app, not left to the model); Copy and Pray again sit in the footer. A footnote says it was written by AI and should start, not replace, the reader's own prayer. Only chapter references leave the device, never notes or highlights.

**Make a song sheet.** Opens only from the chapter done card. It names the chapters at the top ("From John 3, John 2, and John 1": the one just read, then the most recent reads, three at most), then Praise / Worship (a Segmented control, Praise by default, with one line on how each sounds), then **Make a song** in the footer. Nothing is made until it's pressed; while it works the button reads "Making the song". Status lines: "Writing the words.", then "Recording the song." (§9: no ellipses). The title and lyrics (verse, chorus, verse, chorus, with small sans labels) show in Literata at reading size as soon as they're written, then an `<audio controls>` player for the sung song (about 70 seconds, ElevenLabs Music). Footer: Copy words and Make another (same chapters, the choice now selected; it replaces the song). If only the recording failed, the primary button is **Record again** (the same words, within the hour, so nothing new is written or paid for), with a plain "Make new words instead" under the message. Closing the sheet stops playback. Footnote: "This song was written by AI from the chapters you read. It is a starting point, not a substitute for worship." Words are original, from the chapter notes (KJV when a chapter has none), never the reader's notes or highlights. **Songs need an account:** signed out, the sheet still names the chapters, says "Songs need an account, so the daily limit stays fair for everyone. Three songs a day.", and the footer button is **Sign in to make a song** (it closes this sheet and opens the account sheet). Three songs a day per person and a daily ceiling for the whole app (both set on the server); a song that fails to record doesn't count. The mp3 is never stored.

**Go to palette.** §5.3. 60px input, 52px rows with icon or pigment swatch, title, subtitle, and an ↵ key cap on the active row.

**Kbd.** 24px key cap, `r` 6px, gradient `surface-raised` → `surface`, 1px `divider` border.

## 9. Copy

Follow `/my-tone`. Lampstand rules:
- One idea per screen. Headings are 2 to 5 words.
- Plain, quiet words: "Continue reading", "Mark John 3 as read", "Go to a book or verse". No exclamation marks, no streak guilt.
- Book and chapter names in full in headings ("John 3"); short forms only on spines.
- Background notes stay neutral across Catholic, Orthodox and Protestant traditions. "Traditionally attributed to…" where authorship is debated; dates as ranges.
- US English. Numbers one to nine are words in sentences; numerals in counts and references.
- Lists of three or more take the Oxford comma: "John 3, John 2, and John 1". Two items take none: "John 3 and John 2".
- No ellipses or dashes for effect. Status lines are plain sentences with a period ("Writing the words.", "Recording the song."), and a busy button names what it's doing ("Making the song"). An ellipsis is kept only on a command that opens a place to type, like "Go to…" (a standard UI convention). Older lines that still use one ("Loading…" in chat, "is typing…") change the next time those screens are edited.
- No filler words: just, simply, easy, seamless, "just now" in errors. Say what happened: "The song couldn't be recorded."

## 10. Checklist (every screen)

- [ ] Main action is in the bottom third on phones.
- [ ] Every tap target is at least 44×44.
- [ ] Text contrast at least 4.5:1 (3:1 for 18px+ or bold) in Day and Night.
- [ ] Works with keyboard only; visible focus; Escape closes; `⌘K` opens Go to.
- [ ] Every icon-only control has a label; `header`, `nav`, `main` are present.
- [ ] Reflows at 200% zoom and at 26px Scripture.
- [ ] Reduced motion respected.
- [ ] At most one filled button.
- [ ] Copy passes `/my-tone`.

## 11. Lamplighters (Circles)

Private, invite-only groups of friends who read together. Same tokens, type and touch sizes as everywhere else, with one **playful layer** (approved 2026-10-29) that applies only to the mascot and Lamplighters moments:

- **Mascot.** The flat lamp character from `assets/mascot`, chosen by mood from its file name (`cheer`, `wave`, `read`, `gentle`). Its flat colors (including the navy) live in the art only; the UI keeps gold and cream. It is decorative (`alt=""`); the words beside it carry the meaning. The art is cropped to its top so a wordmark under the character never shows.
- **Exclamation marks are allowed** in mascot lines, celebrations and nudge presets ("Nice work!", "Time to light your lamp!"). Everything else keeps §9. Never guilt: missed days get "Welcome back", not a broken-streak warning.
- **The mascot pops out.** A finished chapter springs a small cheer up from the bottom (above the tab bar; bottom right on desktop), which leaves after 5s, or stays while hovered. A milestone is a centered card: the mascot bursts out of a turning gold glow with a ring of confetti (36 pieces, leaf gold and the pigments, about 1.3s). Wherever it shows, the mascot says hello with a hop, then breathes. Tap it to make it bounce, throw a few stars and reply with a line from `tap` in content/mascot.json; at milestones a tap throws more confetti. With reduced motion, the confetti, stars and glow are hidden.
- **Confetti** only at milestones.
- **Mascot celebrations** can be turned off on Me (Reading → Mascot celebrations). Off hides the bubble, the milestone sheet and Today's line; empty states keep the mascot.

Components:

**Avatar.** A round image from `assets/avatars` (made small by `npm run assets`), with a 1px `divider` ring. Missing or unchosen: the lamp on `gold-wash`. Sizes 28 (chat header), 32 (feed, chat), 40–44 (rows), 56–84 (sheets).

**Read-today lamp.** A 22px badge on the avatar's corner: lit flame when they've read today, muted outline when not. It only ever means "read today", never what or how much. Always visible to the Circle, whatever the member's sharing choice.

**Avatar picker.** A radio group grid (4 columns, 5 from 420px), each cell at least 64px, the chosen one with `gold-wash`, a 2px `gold` ring and a check. Arrow keys move. A large preview with the name sits above.

**Circle card.** Three stacked avatars, name, "3 of 5 lamps lit today", an unread count pill (`gold-strong`).

**Circle dashboard.** The week strip (lamps + "Your Circle read 18 chapters this week", counting only members who share chapters), Chat (primary) and Nudge all, the members list (avatar with lamp, name, Owner tag, "Read today" / "Not yet today", streak and week count when shared, a bell to nudge), Recently (chapters, milestones, nudges, joins, with 🙏 and 🔥 reactions at 44px), then the Circle's settings. A new Circle shows the mascot asking for the first Lamplighter.

**Nudge sheet.** Preset lines as a radio list, an optional note (140), a preview with both avatars, the daily limits in a footnote.

**Notifications.** A bell (44px, red count) beside the avatar on Circles opens a sheet of chat messages and nudges that reached you, newest first: avatar, name · Circle · time, the message or nudge line (and note). Unread rows sit on `gold-wash`. Tapping a message opens that Circle's chat; tapping a nudge shows it in the Nudges inbox. Opening marks it read, and the Circles tab dot counts unread ones. People you muted or blocked never notify you. Email copies are opt-in on Me ("Email me nudges", "Email me Circle messages"), one per person, never to the sender.

**Chat.** Full screen like the reader (no tab bar): header with back, name and "Maria is typing…", bubbles (mine `gold-wash` on the right, others `surface-raised` with name and avatar), day separators, verse cards (Literata with a gold rule, always KJV), a composer pinned to the bottom with Share a verse and Send (44px each). Tapping a message opens Copy, Delete, Report and Block.
