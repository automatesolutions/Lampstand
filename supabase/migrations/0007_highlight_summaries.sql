-- Highlight summaries. Run after 0006_notifications.sql.
--
-- Each highlight keeps a short summary of the verse it marks, written by AI from that
-- verse's text alone (app/api/highlight-summary). It syncs with the highlight, belongs
-- only to its owner (the "own rows" policy from 0001), and goes away with it.

alter table public.highlights
  add column if not exists summary text check (summary is null or char_length(summary) between 1 and 800);

-- The same verse range always gets the same summary, so each is written (and paid for)
-- once for every reader. Server only, like explanations: no policies, no grants.
create table if not exists public.verse_summaries (
  book text not null,
  chapter smallint not null,
  verse_start smallint not null,
  verse_end smallint not null,
  text text not null,
  model text not null,
  created_at timestamptz not null default now(),
  primary key (book, chapter, verse_start, verse_end)
);
alter table public.verse_summaries enable row level security;
revoke all on public.verse_summaries from anon, authenticated;

-- Count highlight summaries toward the daily AI budget (lib/ai/budget.ts).
alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check check (feature in ('prayer', 'explain', 'highlight'));
