-- Lamplighters: private Circles of accountability partners. Run after 0004_ai.sql.
--
-- Everything a Circle holds is visible only to its members. Row-level security and the
-- checked functions below enforce it in the database, so no client can skip the rules:
-- membership, roles, invite tokens, nudge and chat limits, and each member's sharing choice.
-- Tested in lib/lamplighters/db.test.ts against these exact files.

-- Profiles: what Circles see of a person -------------------------------------
alter table public.profiles
  -- An avatar from assets/avatars, by its id (the file name in kebab case). Null = default.
  add column if not exists avatar_id text check (avatar_id is null or avatar_id ~ '^[a-z0-9-]{1,80}$'),
  -- What Circles see beyond the read-today lamp: nothing, the streak, or chapter progress.
  add column if not exists share_level text not null default 'none' check (share_level in ('none', 'streaks', 'chapters')),
  add column if not exists mascot_enabled boolean not null default true,
  add column if not exists nudge_email boolean not null default false,
  add column if not exists show_email boolean not null default false;

alter table public.profiles drop constraint if exists profiles_display_name_check;
alter table public.profiles add constraint profiles_display_name_check
  check (display_name is null or char_length(btrim(display_name)) between 1 and 40);

-- The device works out the streak (lib/streak) and saves it here, so Circles can show it.
grant select, insert, update on public.user_streaks to authenticated;

-- Settings ----------------------------------------------------------------------
-- The largest Circle. Change it here (create or replace) to raise or lower the cap.
create or replace function public.circle_member_limit() returns smallint
language sql immutable as $$ select 12::smallint $$;

-- Tables ------------------------------------------------------------------------
create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  description text check (description is null or char_length(description) <= 200),
  kind text not null default 'circle' check (kind in ('pair', 'circle')), -- pair = 1-on-1 Lamplighters
  max_members smallint not null check (max_members between 2 and 50),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.circle_members (
  circle_id uuid not null references public.circles on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  last_read_message_at timestamptz not null default now(), -- for the unread count
  primary key (circle_id, user_id)
);
create unique index if not exists circle_members_one_owner on public.circle_members (circle_id) where role = 'owner';
create index if not exists circle_members_by_user on public.circle_members (user_id);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  token_hash bytea not null unique, -- sha256 of the token; the token itself is never stored
  invited_by uuid references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz not null default now()
);
create unique index if not exists invites_one_pending on public.invites (circle_id, email) where status = 'pending';

create table if not exists public.nudges (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles on delete cascade,
  sender_id uuid not null references auth.users on delete cascade,
  recipient_id uuid not null references auth.users on delete cascade,
  to_circle boolean not null default false, -- sent to the whole Circle (one row per person)
  message text not null check (char_length(message) between 1 and 80),
  note text check (note is null or char_length(note) between 1 and 140),
  -- Muted or blocked: kept only so the "1 a day" rule can't reveal a mute. Never shown.
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  emailed_at timestamptz -- set by the server when it emails the nudge
);
create index if not exists nudges_by_recipient on public.nudges (recipient_id, created_at desc);
create index if not exists nudges_by_sender on public.nudges (sender_id, created_at desc);

create table if not exists public.nudge_mutes (
  user_id uuid not null references auth.users on delete cascade,
  muted_user_id uuid references auth.users on delete cascade,
  muted_circle_id uuid references public.circles on delete cascade,
  created_at timestamptz not null default now(),
  check ((muted_user_id is null) <> (muted_circle_id is null))
);
create unique index if not exists nudge_mutes_user on public.nudge_mutes (user_id, muted_user_id) where muted_user_id is not null;
create unique index if not exists nudge_mutes_circle on public.nudge_mutes (user_id, muted_circle_id) where muted_circle_id is not null;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles on delete cascade,
  sender_id uuid not null references auth.users on delete cascade,
  body text check (body is null or char_length(body) between 1 and 1000),
  verse jsonb, -- a shared verse card: { "ref": "John 3:16", "text": "…" }
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (deleted_at is not null or body is not null or verse is not null)
);
create index if not exists messages_by_circle on public.messages (circle_id, created_at desc);

-- Things worth celebrating together, and nudges, for the Circle's recent list.
create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles on delete cascade,
  actor_id uuid references auth.users on delete cascade,
  kind text not null check (kind in ('chapter', 'milestone', 'nudge', 'joined')),
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists activity_by_circle on public.activity (circle_id, created_at desc);

create table if not exists public.reactions (
  activity_id uuid not null references public.activity on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  emoji text not null check (emoji in ('🙏', '🔥')),
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id, emoji)
);

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users on delete cascade,
  blocked_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- Reports of abusive messages. Nobody reads them through the app; see the Supabase dashboard.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users on delete set null,
  circle_id uuid references public.circles on delete set null,
  message_id uuid references public.messages on delete set null,
  reported_user_id uuid references auth.users on delete set null,
  reason text check (reason is null or char_length(reason) <= 500),
  body_snapshot text,
  created_at timestamptz not null default now()
);

-- Server-only counters for rate limits.
create table if not exists public.rate_events (
  user_id uuid not null references auth.users on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_events_lookup on public.rate_events (user_id, action, created_at desc);

-- Helpers -----------------------------------------------------------------------
create or replace function public.is_circle_member(p_circle uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.circle_members where circle_id = p_circle and user_id = (select auth.uid()))
$$;

create or replace function public.is_circle_owner(p_circle uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.circle_members where circle_id = p_circle and user_id = (select auth.uid()) and role = 'owner')
$$;

/** The signed-in person, or an error. Guests have no account and can't use Circles. */
create or replace function public.lamp_require_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from auth.users where id = uid and email is not null) then
    raise exception 'sign_in_required' using errcode = 'P0001';
  end if;
  return uid;
end $$;

/** Counts an action and fails once there were p_max in the window. */
create or replace function public.lamp_rate(p_user uuid, p_action text, p_max integer, p_window interval) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.rate_events where user_id = p_user and action = p_action and created_at > now() - p_window) >= p_max then
    raise exception 'rate_limited:%', p_action using errcode = 'P0001';
  end if;
  insert into public.rate_events (user_id, action) values (p_user, p_action);
  delete from public.rate_events where user_id = p_user and action = p_action and created_at < now() - interval '2 days';
end $$;

/** A person's local date, from the time zone the app saves on their profile. */
create or replace function public.lamp_today(p_user uuid) returns date
language plpgsql stable security definer set search_path = '' as $$
declare tz text;
begin
  select timezone into tz from public.profiles where id = p_user;
  begin
    return (now() at time zone coalesce(tz, 'UTC'))::date;
  exception when others then
    return (now() at time zone 'UTC')::date;
  end;
end $$;

create or replace function public.lamp_read_today(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chapter_reads where user_id = p_user and read_on = public.lamp_today(p_user))
$$;

/** The saved streak, or 0 once it can no longer be running (one grace day allowed). */
create or replace function public.lamp_streak(p_user uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((select case when last_met_on >= public.lamp_today(p_user) - 2 then current else 0 end
                   from public.user_streaks where user_id = p_user), 0)
$$;

create or replace function public.lamp_clean(p_text text, p_max integer) returns text
language sql immutable as $$
  -- Control characters out (newlines kept), spaces trimmed, empty becomes null.
  select nullif(left(btrim(regexp_replace(coalesce(p_text, ''), '[\x01-\x09\x0B-\x1F\x7F]', ' ', 'g')), p_max), '')
$$;

create or replace function public.lamp_new_token(out token text, out token_hash bytea)
language plpgsql volatile as $$
begin
  -- Two random UUIDs: 244 random bits, from the same strong source as gen_random_uuid.
  token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  token_hash := sha256(convert_to(token, 'UTF8'));
end $$;

-- Circles -----------------------------------------------------------------------
create or replace function public.create_circle(p_name text, p_description text default null, p_kind text default 'circle')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.lamp_require_user();
  new_id uuid;
  clean_name text := public.lamp_clean(p_name, 40);
begin
  if clean_name is null then raise exception 'name_required' using errcode = 'P0001'; end if;
  if p_kind not in ('pair', 'circle') then raise exception 'bad_kind' using errcode = 'P0001'; end if;
  perform public.lamp_rate(uid, 'create_circle', 5, interval '1 day');
  insert into public.circles (name, description, kind, max_members, created_by)
  values (clean_name, public.lamp_clean(p_description, 200), p_kind,
          case when p_kind = 'pair' then 2 else public.circle_member_limit() end, uid)
  returning id into new_id;
  insert into public.circle_members (circle_id, user_id, role) values (new_id, uid, 'owner');
  return new_id;
end $$;

-- When someone leaves (or deletes their account), the longest-standing member becomes
-- owner; an empty Circle is deleted.
create or replace function public.lamp_after_member_leaves() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.circles where id = old.circle_id) then return null; end if;
  if not exists (select 1 from public.circle_members where circle_id = old.circle_id) then
    delete from public.circles where id = old.circle_id;
  elsif old.role = 'owner' then
    update public.circle_members set role = 'owner'
    where (circle_id, user_id) = (select circle_id, user_id from public.circle_members
                                  where circle_id = old.circle_id order by joined_at, user_id limit 1);
  end if;
  return null;
end $$;
drop trigger if exists circle_member_left on public.circle_members;
create trigger circle_member_left after delete on public.circle_members
  for each row execute function public.lamp_after_member_leaves();

/** The Circles I'm in, with what the list needs. */
create or replace function public.my_circles()
returns table (id uuid, name text, description text, kind text, my_role text, member_count integer,
               lit_count integer, unread_count integer, avatars text[], created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.description, c.kind, me.role,
         (select count(*)::int from public.circle_members m where m.circle_id = c.id),
         (select count(*)::int from public.circle_members m where m.circle_id = c.id and public.lamp_read_today(m.user_id)),
         (select count(*)::int from public.messages msg
           where msg.circle_id = c.id and msg.created_at > me.last_read_message_at and msg.deleted_at is null
             and msg.sender_id <> me.user_id
             and not exists (select 1 from public.blocks b where b.blocker_id = me.user_id and b.blocked_id = msg.sender_id)),
         array(select coalesce(p.avatar_id, '') from public.circle_members m join public.profiles p on p.id = m.user_id
               where m.circle_id = c.id order by m.joined_at limit 4),
         c.created_at
  from public.circle_members me
  join public.circles c on c.id = me.circle_id
  where me.user_id = (select auth.uid())
  order by c.created_at
$$;

/**
 * Members as their Circle sees them. The read-today lamp always shows; the streak only
 * with share_level streaks or chapters; chapters this week only with chapters; email
 * only when the member chose to show it.
 */
create or replace function public.circle_people(p_circle uuid)
returns table (user_id uuid, display_name text, avatar_id text, role text, joined_at timestamptz,
               read_today boolean, streak integer, chapters_week integer, email text, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_circle_member(p_circle) then raise exception 'not_a_member' using errcode = 'P0001'; end if;
  return query
  select m.user_id, coalesce(p.display_name, 'Lamplighter'), p.avatar_id, m.role, m.joined_at,
         public.lamp_read_today(m.user_id),
         case when p.share_level in ('streaks', 'chapters') then public.lamp_streak(m.user_id) end,
         case when p.share_level = 'chapters' then
           (select count(*)::int from public.chapter_reads r
             where r.user_id = m.user_id and r.read_on > public.lamp_today(m.user_id) - 7) end,
         case when p.show_email then (select u.email::text from auth.users u where u.id = m.user_id) end,
         m.user_id = (select auth.uid())
  from public.circle_members m
  left join public.profiles p on p.id = m.user_id
  where m.circle_id = p_circle
  order by m.joined_at;
end $$;

-- Invites -----------------------------------------------------------------------
/** Creates an invite (or renews a pending one for the same email). Returns the token once. */
create or replace function public.create_invite(p_circle uuid, p_email text)
returns table (invite_id uuid, token text, circle_name text, inviter_name text)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.lamp_require_user();
  addr text := lower(btrim(coalesce(p_email, '')));
  c public.circles;
  t record;
  taken integer;
  existing uuid;
begin
  if not public.is_circle_member(p_circle) then raise exception 'not_a_member' using errcode = 'P0001'; end if;
  if addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(addr) > 254 then raise exception 'bad_email' using errcode = 'P0001'; end if;
  select * into c from public.circles where id = p_circle;
  if exists (select 1 from public.circle_members m join auth.users u on u.id = m.user_id
             where m.circle_id = p_circle and lower(u.email) = addr) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  select id into existing from public.invites where circle_id = p_circle and email = addr and status = 'pending';
  taken := (select count(*) from public.circle_members where circle_id = p_circle)
         + (select count(*) from public.invites where circle_id = p_circle and status = 'pending' and expires_at > now()
              and id is distinct from existing);
  if taken >= c.max_members then raise exception 'circle_full' using errcode = 'P0001'; end if;
  perform public.lamp_rate(uid, 'invite', 20, interval '1 day');

  select * into t from public.lamp_new_token();
  if existing is not null then
    update public.invites set token_hash = t.token_hash, expires_at = now() + interval '7 days', sent_at = now(), invited_by = uid
    where id = existing;
  else
    insert into public.invites (circle_id, email, token_hash, invited_by, expires_at)
    values (p_circle, addr, t.token_hash, uid, now() + interval '7 days') returning id into existing;
  end if;
  return query select existing, t.token::text, c.name,
    coalesce((select display_name from public.profiles where id = uid), 'A friend');
end $$;

/** A fresh link for a pending invite (the old one stops working). Inviter only. */
create or replace function public.resend_invite(p_invite uuid)
returns table (invite_id uuid, token text, email text, circle_name text, inviter_name text)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.lamp_require_user();
  inv public.invites;
  t record;
begin
  select * into inv from public.invites where id = p_invite and invited_by = uid and status = 'pending';
  if inv.id is null then raise exception 'invite_invalid' using errcode = 'P0001'; end if;
  perform public.lamp_rate(uid, 'invite', 20, interval '1 day');
  select * into t from public.lamp_new_token();
  update public.invites set token_hash = t.token_hash, expires_at = now() + interval '7 days', sent_at = now() where id = inv.id;
  return query select inv.id, t.token::text, inv.email, (select name from public.circles where id = inv.circle_id),
    coalesce((select display_name from public.profiles where id = uid), 'A friend');
end $$;

/** The inviter, or the Circle's owner, can revoke a pending invite. */
create or replace function public.revoke_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.lamp_require_user();
begin
  update public.invites i set status = 'revoked'
  where i.id = p_invite and i.status = 'pending' and (i.invited_by = uid or public.is_circle_owner(i.circle_id));
  if not found then raise exception 'invite_invalid' using errcode = 'P0001'; end if;
end $$;

/** What the join page shows before signing in. Only someone holding the token can ask. */
create or replace function public.invite_preview(p_token text)
returns table (circle_name text, inviter_name text, email_hint text, status text)
language sql stable security definer set search_path = '' as $$
  select c.name, coalesce(p.display_name, 'A friend'),
         -- "j•••@gmail.com": enough to know which address to sign in with.
         left(i.email, 1) || '•••' || substring(i.email from position('@' in i.email)),
         case when i.status <> 'pending' then i.status when i.expires_at <= now() then 'expired' else 'pending' end
  from public.invites i
  join public.circles c on c.id = i.circle_id
  left join public.profiles p on p.id = i.invited_by
  where i.token_hash = sha256(convert_to(coalesce(p_token, ''), 'UTF8'))
$$;

/** Joins the Circle. The signed-in email must be the invited one. Returns the Circle id. */
create or replace function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.lamp_require_user();
  inv public.invites;
  my_email text;
begin
  perform public.lamp_rate(uid, 'accept_invite', 20, interval '1 hour');
  select * into inv from public.invites where token_hash = sha256(convert_to(coalesce(p_token, ''), 'UTF8')) for update;
  if inv.id is null or inv.status = 'revoked' then raise exception 'invite_invalid' using errcode = 'P0001'; end if;
  if exists (select 1 from public.circle_members where circle_id = inv.circle_id and user_id = uid) then return inv.circle_id; end if;
  if inv.status = 'accepted' then raise exception 'invite_used' using errcode = 'P0001'; end if;
  if inv.expires_at <= now() then raise exception 'invite_expired' using errcode = 'P0001'; end if;
  select lower(email) into my_email from auth.users where id = uid;
  if my_email is distinct from inv.email then raise exception 'invite_wrong_email' using errcode = 'P0001'; end if;
  if (select count(*) from public.circle_members where circle_id = inv.circle_id)
     >= (select max_members from public.circles where id = inv.circle_id) then
    raise exception 'circle_full' using errcode = 'P0001';
  end if;
  insert into public.circle_members (circle_id, user_id) values (inv.circle_id, uid);
  update public.invites set status = 'accepted', accepted_by = uid where id = inv.id;
  insert into public.activity (circle_id, actor_id, kind) values (inv.circle_id, uid, 'joined');
  return inv.circle_id;
end $$;

-- Nudges ------------------------------------------------------------------------
/**
 * A friendly reminder to one member (p_recipient) or the whole Circle (null).
 * Rules: 3 nudges a day per sender; 1 a day from the same sender to the same person;
 * never to someone who already read today. Muted or blocking recipients are skipped
 * quietly, so the sender can't tell: the answer is how many it went to, counting them.
 */
create or replace function public.send_nudge(p_circle uuid, p_recipient uuid, p_message text, p_note text default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.lamp_require_user();
  msg text := public.lamp_clean(p_message, 80);
  note text := public.lamp_clean(p_note, 140);
  targets uuid[];
  eligible uuid[];
  delivered uuid[];
begin
  if not public.is_circle_member(p_circle) then raise exception 'not_a_member' using errcode = 'P0001'; end if;
  if msg is null then raise exception 'message_required' using errcode = 'P0001'; end if;
  if p_recipient = uid then raise exception 'nudge_self' using errcode = 'P0001'; end if;

  targets := array(select m.user_id from public.circle_members m
                   where m.circle_id = p_circle and m.user_id <> uid and (p_recipient is null or m.user_id = p_recipient));
  if p_recipient is not null and cardinality(targets) = 0 then raise exception 'not_a_member' using errcode = 'P0001'; end if;

  -- Hasn't read today, and hasn't had a nudge from me in the last 24 hours.
  eligible := array(select t from unnest(targets) t
                    where not public.lamp_read_today(t)
                      and not exists (select 1 from public.nudges n where n.sender_id = uid and n.recipient_id = t
                                      and n.created_at > now() - interval '24 hours'));
  if cardinality(eligible) = 0 then
    if p_recipient is not null and public.lamp_read_today(p_recipient) then raise exception 'already_read' using errcode = 'P0001'; end if;
    if p_recipient is not null then raise exception 'already_nudged' using errcode = 'P0001'; end if;
    raise exception 'nobody_to_nudge' using errcode = 'P0001';
  end if;

  perform public.lamp_rate(uid, 'nudge', 3, interval '24 hours');

  -- Skip, without saying so, anyone who muted me or this Circle, or blocked me.
  delivered := array(select t from unnest(eligible) t
                     where not exists (select 1 from public.nudge_mutes mu where mu.user_id = t
                                       and (mu.muted_user_id = uid or mu.muted_circle_id = p_circle))
                       and not exists (select 1 from public.blocks b where b.blocker_id = t and b.blocked_id = uid));
  insert into public.nudges (circle_id, sender_id, recipient_id, to_circle, message, note)
  select p_circle, uid, t, p_recipient is null, msg, note from unnest(delivered) t;
  -- Even skipped people count toward "1 a day", so a muted person can't be told apart.
  insert into public.nudges (circle_id, sender_id, recipient_id, to_circle, message, note, skipped)
  select p_circle, uid, t, p_recipient is null, msg, note, true from unnest(eligible) t where t <> all(delivered);
  insert into public.activity (circle_id, actor_id, kind, data)
  values (p_circle, uid, 'nudge', jsonb_build_object('to', p_recipient));
  return cardinality(eligible);
end $$;

/** Nudges sent to me, newest first, with who sent them. */
create or replace function public.my_nudges(p_limit integer default 30)
returns table (id uuid, circle_id uuid, circle_name text, sender_id uuid, sender_name text, sender_avatar text,
               to_circle boolean, message text, note text, created_at timestamptz, read_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id, n.circle_id, c.name, n.sender_id, coalesce(p.display_name, 'Lamplighter'), p.avatar_id,
         n.to_circle, n.message, n.note, n.created_at, n.read_at
  from public.nudges n
  join public.circles c on c.id = n.circle_id
  left join public.profiles p on p.id = n.sender_id
  where n.recipient_id = (select auth.uid())
    -- Sent before a mute or block: hidden too.
    and not exists (select 1 from public.blocks b where b.blocker_id = n.recipient_id and b.blocked_id = n.sender_id)
    and not n.skipped
  order by n.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

-- Progress shared with Circles ---------------------------------------------------
/**
 * Posts a chapter or milestone to each of my Circles, if my sharing choice allows:
 * chapter and chapter/book milestones need 'chapters'; streak milestones need 'streaks' or more.
 */
create or replace function public.share_progress(p_kind text, p_data jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.lamp_require_user();
  level text;
  clean jsonb;
  n integer;
begin
  select share_level into level from public.profiles where id = uid;
  if p_kind = 'chapter' then
    if coalesce(p_data->>'book', '') !~ '^[1-3A-Z]{3}$' or coalesce(p_data->>'chapter', '') !~ '^[0-9]{1,3}$' then
      raise exception 'bad_data' using errcode = 'P0001';
    end if;
    if level <> 'chapters' then return 0; end if;
    clean := jsonb_build_object('book', p_data->>'book', 'chapter', (p_data->>'chapter')::int);
  elsif p_kind = 'milestone' then
    if coalesce(p_data->>'type', '') not in ('chapters', 'streak', 'book') then raise exception 'bad_data' using errcode = 'P0001'; end if;
    if p_data->>'type' = 'book' then
      if coalesce(p_data->>'book', '') !~ '^[1-3A-Z]{3}$' then raise exception 'bad_data' using errcode = 'P0001'; end if;
      clean := jsonb_build_object('type', 'book', 'book', p_data->>'book');
    else
      if coalesce(p_data->>'value', '') !~ '^[0-9]{1,5}$' then raise exception 'bad_data' using errcode = 'P0001'; end if;
      clean := jsonb_build_object('type', p_data->>'type', 'value', (p_data->>'value')::int);
    end if;
    if level = 'none' or (level = 'streaks' and p_data->>'type' <> 'streak') then return 0; end if;
  else
    raise exception 'bad_kind' using errcode = 'P0001';
  end if;
  perform public.lamp_rate(uid, 'share', 40, interval '1 day');
  insert into public.activity (circle_id, actor_id, kind, data)
  select m.circle_id, uid, p_kind, clean from public.circle_members m where m.user_id = uid;
  get diagnostics n = row_count;
  return n;
end $$;

-- Chat --------------------------------------------------------------------------
-- Cleans each new message, stamps the time, and limits sending to 20 a minute, 500 a day.
create or replace function public.lamp_before_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.created_at := now();
  new.deleted_at := null;
  new.body := public.lamp_clean(new.body, 1000);
  if new.verse is not null then
    if jsonb_typeof(new.verse) <> 'object' or public.lamp_clean(new.verse->>'ref', 40) is null or public.lamp_clean(new.verse->>'text', 800) is null then
      raise exception 'bad_verse' using errcode = 'P0001';
    end if;
    new.verse := jsonb_build_object('ref', public.lamp_clean(new.verse->>'ref', 40), 'text', public.lamp_clean(new.verse->>'text', 800));
  end if;
  if new.body is null and new.verse is null then raise exception 'message_required' using errcode = 'P0001'; end if;
  perform public.lamp_rate(new.sender_id, 'message_minute', 20, interval '1 minute');
  perform public.lamp_rate(new.sender_id, 'message_day', 500, interval '1 day');
  return new;
end $$;
drop trigger if exists message_before_insert on public.messages;
create trigger message_before_insert before insert on public.messages
  for each row execute function public.lamp_before_message();

/** Members delete their own messages; owners can delete any. The text is erased. */
create or replace function public.delete_message(p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.lamp_require_user();
begin
  update public.messages m set deleted_at = now(), body = null, verse = null
  where m.id = p_message and m.deleted_at is null and (m.sender_id = uid or public.is_circle_owner(m.circle_id));
  if not found then raise exception 'not_allowed' using errcode = 'P0001'; end if;
end $$;

create or replace function public.report_message(p_message uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.lamp_require_user();
  m public.messages;
begin
  select * into m from public.messages where id = p_message;
  if m.id is null or not public.is_circle_member(m.circle_id) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  perform public.lamp_rate(uid, 'report', 20, interval '1 day');
  insert into public.reports (reporter_id, circle_id, message_id, reported_user_id, reason, body_snapshot)
  values (uid, m.circle_id, m.id, m.sender_id, public.lamp_clean(p_reason, 500), coalesce(m.body, m.verse::text));
end $$;

/** Realtime channel names are "circle:<id>"; only members may join one. */
create or replace function public.lamp_topic_member(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_topic !~ '^circle:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return public.is_circle_member(substring(p_topic from 8)::uuid);
end $$;

-- Row-level security -------------------------------------------------------------
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.invites enable row level security;
alter table public.nudges enable row level security;
alter table public.nudge_mutes enable row level security;
alter table public.messages enable row level security;
alter table public.activity enable row level security;
alter table public.reactions enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.rate_events enable row level security;

-- Only what's granted here is reachable through the Data API; changes go through the functions above.
revoke all on public.circles, public.circle_members, public.invites, public.nudges, public.nudge_mutes, public.messages,
  public.activity, public.reactions, public.blocks, public.reports, public.rate_events from anon, authenticated;

drop policy if exists "members read" on public.circles;
create policy "members read" on public.circles for select to authenticated using (public.is_circle_member(id));
drop policy if exists "owner renames" on public.circles;
create policy "owner renames" on public.circles for update to authenticated using (public.is_circle_owner(id)) with check (public.is_circle_owner(id));
grant select on public.circles to authenticated;
grant update (name, description) on public.circles to authenticated;

drop policy if exists "members read" on public.circle_members;
create policy "members read" on public.circle_members for select to authenticated using (public.is_circle_member(circle_id));
drop policy if exists "mark read" on public.circle_members;
create policy "mark read" on public.circle_members for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Leave a Circle, or (owner) remove a member.
drop policy if exists "leave or remove" on public.circle_members;
create policy "leave or remove" on public.circle_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_circle_owner(circle_id));
grant select, delete on public.circle_members to authenticated;
grant update (last_read_message_at) on public.circle_members to authenticated;

-- Invites: only the person who sent one sees it (with the email they typed). Never the token hash.
drop policy if exists "inviter reads" on public.invites;
create policy "inviter reads" on public.invites for select to authenticated
  using (invited_by = (select auth.uid()) and public.is_circle_member(circle_id));
grant select (id, circle_id, email, invited_by, status, expires_at, created_at, sent_at) on public.invites to authenticated;

-- Recipients only: a sender can't read back their nudges, so a mute stays private.
drop policy if exists "recipient reads" on public.nudges;
create policy "recipient reads" on public.nudges for select to authenticated
  using (recipient_id = (select auth.uid()) and not skipped);
drop policy if exists "recipient marks read" on public.nudges;
create policy "recipient marks read" on public.nudges for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
grant select on public.nudges to authenticated;
grant update (read_at) on public.nudges to authenticated;

drop policy if exists "own mutes" on public.nudge_mutes;
create policy "own mutes" on public.nudge_mutes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (muted_circle_id is null or public.is_circle_member(muted_circle_id)));
grant select, insert, delete on public.nudge_mutes to authenticated;

-- Messages from people I blocked are hidden from me by the database, not just the screen.
drop policy if exists "members read" on public.messages;
create policy "members read" on public.messages for select to authenticated
  using (public.is_circle_member(circle_id)
         and not exists (select 1 from public.blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = sender_id));
drop policy if exists "members send" on public.messages;
create policy "members send" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.is_circle_member(circle_id));
grant select, insert (circle_id, sender_id, body, verse) on public.messages to authenticated;

drop policy if exists "members read" on public.activity;
create policy "members read" on public.activity for select to authenticated using (public.is_circle_member(circle_id));
grant select on public.activity to authenticated;

drop policy if exists "members read" on public.reactions;
create policy "members read" on public.reactions for select to authenticated
  using (exists (select 1 from public.activity a where a.id = activity_id and public.is_circle_member(a.circle_id)));
drop policy if exists "members react" on public.reactions;
create policy "members react" on public.reactions for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.activity a where a.id = activity_id and public.is_circle_member(a.circle_id)));
drop policy if exists "take back" on public.reactions;
create policy "take back" on public.reactions for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert (activity_id, user_id, emoji), delete on public.reactions to authenticated;

drop policy if exists "own blocks" on public.blocks;
create policy "own blocks" on public.blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));
grant select, insert (blocker_id, blocked_id), delete on public.blocks to authenticated;

-- reports and rate_events: no policies, no grants. Server and dashboard only.

-- Functions: closed to everyone, then opened to signed-in people one by one (the join
-- page's preview also works signed out). Internal helpers stay closed.
do $$
declare f text;
begin
  foreach f in array array[
    'public.is_circle_member(uuid)', 'public.is_circle_owner(uuid)', 'public.lamp_require_user()',
    'public.lamp_rate(uuid, text, integer, interval)', 'public.lamp_today(uuid)', 'public.lamp_read_today(uuid)',
    'public.lamp_streak(uuid)', 'public.lamp_topic_member(text)', 'public.lamp_after_member_leaves()',
    'public.lamp_before_message()', 'public.create_circle(text, text, text)', 'public.my_circles()',
    'public.circle_people(uuid)', 'public.create_invite(uuid, text)', 'public.resend_invite(uuid)',
    'public.revoke_invite(uuid)', 'public.invite_preview(text)', 'public.accept_invite(text)',
    'public.send_nudge(uuid, uuid, text, text)', 'public.my_nudges(integer)', 'public.share_progress(text, jsonb)',
    'public.delete_message(uuid)', 'public.report_message(uuid, text)', 'public.lamp_new_token()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
grant execute on function public.create_circle(text, text, text), public.my_circles(), public.circle_people(uuid),
  public.create_invite(uuid, text), public.resend_invite(uuid), public.revoke_invite(uuid), public.accept_invite(text),
  public.send_nudge(uuid, uuid, text, text), public.my_nudges(integer), public.share_progress(text, jsonb),
  public.delete_message(uuid), public.report_message(uuid, text),
  public.is_circle_member(uuid), public.is_circle_owner(uuid), public.lamp_topic_member(text)
  to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- Realtime (Supabase only) ---------------------------------------------------------
-- New and deleted messages stream to members (row-level security applies), and the
-- private "circle:<id>" channel carries typing indicators, for members only.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if exists (select 1 from pg_namespace where nspname = 'realtime')
     and exists (select 1 from pg_tables where schemaname = 'realtime' and tablename = 'messages') then
    execute 'drop policy if exists "circle members listen" on realtime.messages';
    execute 'create policy "circle members listen" on realtime.messages for select to authenticated using (public.lamp_topic_member(realtime.topic()))';
    execute 'drop policy if exists "circle members broadcast" on realtime.messages';
    execute 'create policy "circle members broadcast" on realtime.messages for insert to authenticated with check (public.lamp_topic_member(realtime.topic()))';
  end if;
end $$;
