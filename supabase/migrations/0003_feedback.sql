-- Reader feedback on "In depth" explanations and prayers ("Helpful" / "Something's wrong").
-- Anyone, including guests, can send it; nobody can read it through the app. Read it in
-- the Supabase dashboard (Table Editor -> feedback). Run after 0002_sync.sql.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('explanation', 'prayer')),
  book text,
  chapter smallint,
  refs text, -- for prayers: the chapters it was drawn from
  helpful boolean not null,
  comment text check (char_length(comment) <= 1000),
  -- Only sent with a report: the prayer as written, so it can be checked.
  content text check (char_length(content) <= 4000),
  user_id uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists feedback_by_chapter on public.feedback (kind, book, chapter);

alter table public.feedback enable row level security;
drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to anon, authenticated;
