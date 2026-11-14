-- Daily usage limits for paid features (songs, highlight summaries, and later narration,
-- voice clones and quiz questions). Run after 0008_song_usage.sql.
--
-- One row per day, feature and subject. A subject is a person (scope 'user'), a hashed
-- network address ('ip'), the whole app ('app'), or a one-time key such as a song token
-- ('key'). Counts are shared by every server instance and survive restarts, unlike the
-- in-memory burst limit in lib/ai/server.ts. Addresses are stored only as a keyed hash
-- (lib/ai/usage.ts), never as the address itself.
--
-- Server only, like ai_usage: no policies and no grants, so browsers can't read or change
-- it. The server uses the secret key. Tested in lib/ai/usage.test.ts.

create table if not exists public.usage_counters (
  day date not null,
  feature text not null check (feature ~ '^[a-z][a-z0-9_]{0,39}$'),
  scope text not null check (scope in ('app', 'user', 'ip', 'key')),
  subject text not null check (char_length(subject) between 1 and 128),
  -- Requests, or units such as characters for narration.
  amount bigint not null default 0 check (amount >= 0),
  primary key (day, feature, scope, subject)
);
alter table public.usage_counters enable row level security;
revoke all on public.usage_counters from anon, authenticated;

/**
 * Checks every limit in p_checks and, only if all of them have room for p_amount, adds
 * p_amount to each. Returns null when allowed, or the scope that was full (and then counts
 * nothing). p_checks is a JSON array like
 *   [{"scope": "user", "subject": "<id>", "max": 3}, {"scope": "app", "subject": "all", "max": 3}]
 * Rows are locked in a fixed order, so two requests at the same moment can't both take
 * the last place, and can't deadlock each other.
 */
create or replace function public.use_quota(p_feature text, p_checks jsonb, p_amount bigint default 1)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'utc')::date;
  chk jsonb;
  have bigint;
begin
  if p_amount is null or p_amount < 1 then raise exception 'bad_amount' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_checks) <> 'array' or jsonb_array_length(p_checks) = 0 then
    raise exception 'bad_checks' using errcode = 'P0001';
  end if;

  for chk in select value from jsonb_array_elements(p_checks) order by value->>'scope', value->>'subject' loop
    if coalesce(chk->>'max', '') !~ '^[0-9]{1,12}$' then raise exception 'bad_checks' using errcode = 'P0001'; end if;
    insert into public.usage_counters (day, feature, scope, subject)
    values (today, p_feature, chk->>'scope', chk->>'subject')
    on conflict do nothing;
    select u.amount into have from public.usage_counters u
    where u.day = today and u.feature = p_feature and u.scope = chk->>'scope' and u.subject = chk->>'subject'
    for update;
    if have + p_amount > (chk->>'max')::bigint then return chk->>'scope'; end if;
  end loop;

  update public.usage_counters u set amount = u.amount + p_amount
  from jsonb_array_elements(p_checks) x
  where u.day = today and u.feature = p_feature and u.scope = x->>'scope' and u.subject = x->>'subject';

  -- Now and then, forget old days (kept 30 days for looking back in the dashboard).
  if random() < 0.01 then
    delete from public.usage_counters where day < today - 30;
  end if;
  return null;
end $$;

/** Gives back what use_quota took, when the paid call failed before it started. */
create or replace function public.release_quota(p_feature text, p_checks jsonb, p_amount bigint default 1)
returns void
language plpgsql security definer set search_path = '' as $$
declare today date := (now() at time zone 'utc')::date;
begin
  update public.usage_counters u set amount = greatest(0, u.amount - coalesce(p_amount, 1))
  from jsonb_array_elements(p_checks) x
  where u.day = today and u.feature = p_feature and u.scope = x->>'scope' and u.subject = x->>'subject';
end $$;

revoke execute on function public.use_quota(text, jsonb, bigint) from public, anon, authenticated;
revoke execute on function public.release_quota(text, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.use_quota(text, jsonb, bigint) to service_role;
grant execute on function public.release_quota(text, jsonb, bigint) to service_role;
