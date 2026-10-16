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
- **Reader:** the tab bar steps aside. A **thumb bar** replaces it: Home, Previous, chapter picker ("John 3 ▾"), Text, Next. Each 52px tall, at least 56px wide. Top-right reader icons are desktop only.
- **Bars hide while reading.** Scrolling down more than 120px slides the top bar and thumb bar away; any scroll up brings them back. Never while a verse is selected.
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

**Reader keys:** ← → chapter, ↑ ↓ verse, `1`–`4` highlight colors, `N` note, `C` copy, `A` text settings, Esc clears the selection.

**Key caps** (`Kbd`) show shortcuts where they apply: palette footer, rail, verse bar, end of chapter. Shown only on `(hover: hover) and (pointer: fine)`, so phones stay clean. Mac shows `⌘ K`, others `Ctrl K`.

### 5.4 Desktop

- From 960px a **side rail** (232px) replaces the tab bar: brand, Go to…, Today, Read, Notes, Me.
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

**Verse bar.** Reference and Close, four highlight swatches (44px, check when on), Note, Copy.

**Chapter done.** Replaces the Mark as read button in place: the lamp kindles, "John 3 is read", today's count, then Add a note and the next chapter, and a plain "Pray over what you read".

**Pray sheet.** Opens from the chapter done card, a row on Today, or Go to. It prays over the chapter on screen plus the most recent reads, three in all, named at the top ("Praying over John 3, John 2 and John 1"). The prayer streams in Literata at reading size; Copy and Pray again sit in the footer. A footnote says it was written by AI and should start, not replace, the reader's own prayer. Only chapter references leave the device, never notes or highlights.

**Go to palette.** §5.3. 60px input, 52px rows with icon or pigment swatch, title, subtitle, and an ↵ key cap on the active row.

**Kbd.** 24px key cap, `r` 6px, gradient `surface-raised` → `surface`, 1px `divider` border.

## 9. Copy

Follow `/my-tone`. Lampstand rules:
- One idea per screen. Headings are 2 to 5 words.
- Plain, quiet words: "Continue reading", "Mark John 3 as read", "Go to a book or verse". No exclamation marks, no streak guilt.
- Book and chapter names in full in headings ("John 3"); short forms only on spines.
- Background notes stay neutral across Catholic, Orthodox and Protestant traditions. "Traditionally attributed to…" where authorship is debated; dates as ranges.
- US English. Numbers one to nine are words in sentences; numerals in counts and references.

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
