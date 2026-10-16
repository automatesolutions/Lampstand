-- Lampstand schema (plan §4). References are stored as USFM book code + chapter + verse,
-- never tied to a version, so notes and highlights survive version switches.
-- Guests use Supabase anonymous sign-in, so every row has a real auth.users id from day one.

create extension if not exists pgcrypto;

-- Profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  preferred_version text not null default 'KJV',
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  text_size smallint not null default 19 check (text_size between 14 and 32),
  scripture_font text not null default 'serif' check (scripture_font in ('serif', 'sans')),
  created_at timestamptz not null default now()
);

-- Goals and reading ---------------------------------------------------------
create table public.daily_goals (
  user_id uuid not null references auth.users on delete cascade,
  chapters_per_day smallint not null check (chapters_per_day between 1 and 10),
  effective_from date not null,
  primary key (user_id, effective_from)
);

create table public.reading_position (
  user_id uuid primary key references auth.users on delete cascade,
  version text not null,
  book text not null,
  chapter smallint not null,
  verse smallint not null default 1,
  updated_at timestamptz not null default now()
);

create table public.chapter_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  book text not null,
  chapter smallint not null,
  version text not null,
  read_on date not null, -- the reader's local date
  completed_at timestamptz not null default now(),
  unique (user_id, book, chapter, read_on)
);
create index chapter_reads_user_date on public.chapter_reads (user_id, read_on desc);

create table public.user_streaks (
  user_id uuid primary key references auth.users on delete cascade,
  current integer not null default 0,
  longest integer not null default 0,
  last_met_on date
);

-- Plans ---------------------------------------------------------------------
create table public.reading_plans (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  summary text not null,
  total_days smallint not null
);

create table public.plan_days (
  plan_id uuid not null references public.reading_plans on delete cascade,
  day_number smallint not null,
  refs jsonb not null, -- [{ "book": "JHN", "chapter": 1 }, ...]
  primary key (plan_id, day_number)
);

create table public.user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  plan_id uuid references public.reading_plans, -- null = reading freely
  started_on date not null,
  status text not null default 'active' check (status in ('active', 'finished', 'stopped'))
);
create unique index user_plans_one_active on public.user_plans (user_id) where status = 'active';

-- Notes, highlights, bookmarks ----------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  book text not null,
  chapter smallint not null,
  verse_start smallint, -- null = note on the whole chapter
  verse_end smallint,
  body text not null,
  search tsvector generated always as (to_tsvector('english', body)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_user_ref on public.notes (user_id, book, chapter);
create index notes_search on public.notes using gin (search);

create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  book text not null,
  chapter smallint not null,
  verse_start smallint not null,
  verse_end smallint not null,
  color text not null check (color in ('gold', 'sage', 'sky', 'rose')),
  created_at timestamptz not null default now()
);
create index highlights_user_ref on public.highlights (user_id, book, chapter);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  book text not null,
  chapter smallint not null,
  verse smallint,
  label text,
  created_at timestamptz not null default now()
);

-- Prayer (Phase 2) ----------------------------------------------------------
create table public.prayer_prompts (
  id uuid primary key default gen_random_uuid(),
  book text not null,
  chapter smallint not null,
  verse_start smallint,
  verse_end smallint,
  text text not null,
  status text not null default 'draft' check (status in ('draft', 'reviewed'))
);

create table public.prayers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  book text,
  chapter smallint,
  prompt_id uuid references public.prayer_prompts,
  body text not null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

-- Content -------------------------------------------------------------------
create table public.context_cards (
  id uuid primary key default gen_random_uuid(),
  book text not null,
  chapter smallint, -- null = whole book
  author text not null,
  date_range text not null,
  audience text not null,
  setting text not null,
  purpose text not null,
  status text not null default 'draft' check (status in ('draft', 'reviewed')),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (book, chapter)
);

-- Reminders (Phase 2) -------------------------------------------------------
create table public.reminders (
  user_id uuid primary key references auth.users on delete cascade,
  local_time time not null,
  days_of_week smallint[] not null default '{0,1,2,3,4,5,6}',
  channel text not null default 'push' check (channel in ('push', 'email')),
  push_subscription jsonb,
  enabled boolean not null default true
);

-- Row Level Security --------------------------------------------------------
-- Each person sees and changes only their own rows.
do $$
declare t text;
begin
  foreach t in array array['daily_goals', 'reading_position', 'chapter_reads', 'user_streaks', 'user_plans',
                           'notes', 'highlights', 'bookmarks', 'prayers', 'reminders']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Shared content: anyone signed in (including guests) can read; only the service role writes.
alter table public.reading_plans enable row level security;
alter table public.plan_days enable row level security;
alter table public.prayer_prompts enable row level security;
alter table public.context_cards enable row level security;
create policy "read plans" on public.reading_plans for select using (true);
create policy "read plan days" on public.plan_days for select using (true);
create policy "read reviewed or draft prompts" on public.prayer_prompts for select using (true);
create policy "read cards" on public.context_cards for select using (true);

-- Create a profile row for every new user, including anonymous guests.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
