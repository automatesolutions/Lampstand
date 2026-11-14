-- Listen to a chapter in a natural voice (ElevenLabs). Run after 0012_bible_challenge.sql.
--
-- Each chapter is recorded once per voice, stored in the public "narration" Storage bucket
-- (KJV, public domain, so anyone may play it), and replayed for everyone after that. Only
-- the server records and stores (secret key); browsers ask /api/narration. Recording is
-- limited by usage_counters (0009): new chapters a day per person and for the whole app,
-- and characters a month, so it stays inside the ElevenLabs plan. Tested in
-- lib/narration/narration.db.test.ts.

create table if not exists public.narration_audio (
  voice text not null check (voice ~ '^[A-Za-z0-9]{10,40}$'), -- the ElevenLabs voice id
  book text not null check (book ~ '^[1-3A-Z]{3}$'),
  chapter smallint not null check (chapter >= 1),
  path text not null, -- in the narration bucket
  chars integer not null check (chars > 0),
  verse_starts real[] not null, -- seconds into the recording where each verse begins
  model text not null,
  created_at timestamptz not null default now(),
  primary key (voice, book, chapter)
);
alter table public.narration_audio enable row level security;
revoke all on public.narration_audio from anon, authenticated;

/** Server only: how much of a feature was used since the first of this month (UTC), app-wide. */
create or replace function public.usage_this_month(p_feature text) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount), 0)::bigint from public.usage_counters
  where feature = p_feature and scope = 'app'
    and day >= date_trunc('month', now() at time zone 'utc')::date
$$;
revoke execute on function public.usage_this_month(text) from public, anon, authenticated;
grant execute on function public.usage_this_month(text) to service_role;

-- The bucket (Supabase only). Public to read; only the server (secret key) writes.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
    insert into storage.buckets (id, name, public) values ('narration', 'narration', true) on conflict (id) do nothing;
  end if;
end $$;
