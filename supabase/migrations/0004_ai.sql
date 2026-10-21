-- AI spending cap and saved explanations. Run after 0003_feedback.sql.
-- Both tables are server-only: no policies, so browsers (anon / signed-in readers)
-- cannot read or write them. The app's server uses the secret key (SUPABASE_SECRET_KEY).

-- Daily Claude API spend, so Pray and Explain pause for the day once the cap is reached.
create table if not exists public.ai_usage (
  day date not null,
  feature text not null check (feature in ('prayer', 'explain')),
  requests integer not null default 0,
  cost_usd numeric(10, 4) not null default 0,
  primary key (day, feature)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Adds one request's cost and returns today's total across features (UTC day).
create or replace function public.record_ai_usage(p_feature text, p_cost numeric)
returns numeric
language plpgsql security definer set search_path = '' as $$
declare today date := (now() at time zone 'utc')::date;
begin
  insert into public.ai_usage (day, feature, requests, cost_usd)
  values (today, p_feature, 1, p_cost)
  on conflict (day, feature) do update
    set requests = public.ai_usage.requests + 1,
        cost_usd = public.ai_usage.cost_usd + excluded.cost_usd;
  return (select coalesce(sum(cost_usd), 0) from public.ai_usage where day = today);
end $$;
revoke execute on function public.record_ai_usage(text, numeric) from public, anon, authenticated;
grant execute on function public.record_ai_usage(text, numeric) to service_role;

-- "In depth" explanations written when a reader first asks, kept so each chapter is
-- paid for once. Pull them into content/explanations to review:
--   npx tsx scripts/pull-explanations.mts
create table if not exists public.explanations (
  book text not null,
  chapter smallint not null,
  text text not null,
  model text not null,
  status text not null default 'draft' check (status in ('draft', 'reviewed')),
  created_at timestamptz not null default now(),
  primary key (book, chapter)
);
alter table public.explanations enable row level security;
revoke all on public.explanations from anon, authenticated;
