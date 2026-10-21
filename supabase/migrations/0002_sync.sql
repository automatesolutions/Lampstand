-- Account sync: columns for settings and progress added since 0001, and the
-- unique keys the app upserts on. Run after 0001_init.sql.

-- Settings and progress that live on the profile.
alter table public.profiles
  add column if not exists line_spacing numeric(3, 2) not null default 1.78 check (line_spacing between 1.4 and 2.2),
  add column if not exists onboarded boolean not null default false,
  -- Reading the Bible through again: read marks count from round_started_at (null = first round).
  add column if not exists round_number smallint not null default 1 check (round_number >= 1),
  add column if not exists round_started_at timestamptz,
  -- The active reading plan by its slug (plans ship with the app, not in the database).
  add column if not exists plan_slug text,
  add column if not exists plan_started_on date,
  -- When the app last saved these settings; null = never (a brand-new account), so the device's settings win.
  add column if not exists updated_at timestamptz;

alter table public.profiles drop constraint if exists profiles_version_check;
alter table public.profiles add constraint profiles_version_check check (preferred_version in ('KJV', 'NKJV', 'ESV', 'NLT', 'NABRE'));

-- One highlight per verse (the app toggles them), so it can upsert by place.
create unique index if not exists highlights_one_per_verse on public.highlights (user_id, book, chapter, verse_start);

-- Deleting a note or highlight on one device must reach the others: keep a tombstone.
create table if not exists public.deletions (
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('note', 'highlight')),
  item_id uuid not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);
alter table public.deletions enable row level security;
drop policy if exists "own rows" on public.deletions;
create policy "own rows" on public.deletions for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Only the tables the app uses are reachable through the Data API.
revoke all on public.user_streaks, public.bookmarks, public.prayers, public.reminders from anon, authenticated;
