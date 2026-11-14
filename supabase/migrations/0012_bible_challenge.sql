-- Circle Bible challenge: live quiz games and play-on-your-own sets. Run after 0011_highlight_shares.sql.
--
-- Fairness lives here, not in the app:
-- - Questions are server only. Players get a question through quiz_state / quiz_async_next,
--   which leave out the answer until the question has closed.
-- - The database stamps when each question opens and scores with its own clock: 500 points
--   for a correct answer plus up to 500 for speed. One answer per question; late answers
--   earn nothing.
-- - Only members of the Circle can create, join, see or play its games.
-- - A dropped player rejoins with the same row and score. If the host leaves, anyone in the
--   game can close a question whose time is up, and move on once the game has waited 45 seconds.
-- Questions come from content/quiz (scripts/seed-quiz.mts); only ones whose answer was
-- checked against the KJV text ('checked') or reviewed by a person ('reviewed') are used.
-- Tested in lib/quiz/quiz.db.test.ts.

-- Questions ------------------------------------------------------------------------
create table if not exists public.quiz_questions (
  id uuid primary key,
  book text not null check (book ~ '^[1-3A-Z]{3}$'),
  chapter smallint not null check (chapter >= 1),
  verse_start smallint not null check (verse_start >= 1),
  verse_end smallint not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  question text not null check (char_length(question) between 5 and 300),
  choices text[] not null check (array_length(choices, 1) = 4),
  answer smallint not null check (answer between 0 and 3),
  evidence text not null, -- the KJV words that settle the answer
  status text not null default 'draft' check (status in ('draft', 'checked', 'reviewed', 'rejected')),
  model text,
  created_at timestamptz not null default now(),
  check (verse_end >= verse_start)
);
create index if not exists quiz_questions_pick on public.quiz_questions (book, chapter, difficulty) where status in ('checked', 'reviewed');
alter table public.quiz_questions enable row level security;
revoke all on public.quiz_questions from anon, authenticated;

-- Sets, games, players ----------------------------------------------------------------
create table if not exists public.quiz_sets (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles on delete cascade,
  created_by uuid references auth.users on delete set null,
  scope jsonb not null, -- {"kind":"bible"} | {"kind":"book","book":"JHN"} | {"kind":"chapters","book":"JHN","from":1,"to":3}
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'mixed')),
  question_ids uuid[] not null,
  seconds smallint not null default 20 check (seconds between 10 and 60),
  created_at timestamptz not null default now()
);
create index if not exists quiz_sets_by_circle on public.quiz_sets (circle_id, created_at desc);

create table if not exists public.quiz_games (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.quiz_sets on delete cascade,
  circle_id uuid not null references public.circles on delete cascade,
  host_id uuid references auth.users on delete set null,
  code text not null check (code ~ '^[A-Z2-9]{6}$'),
  state text not null default 'lobby' check (state in ('lobby', 'question', 'reveal', 'finished')),
  current_index smallint not null default -1,
  question_started_at timestamptz,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists quiz_games_open_code on public.quiz_games (code) where state <> 'finished';
create index if not exists quiz_games_by_circle on public.quiz_games (circle_id, created_at desc);

create table if not exists public.quiz_players (
  game_id uuid not null references public.quiz_games on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  score integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

create table if not exists public.quiz_answers (
  game_id uuid not null references public.quiz_games on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  question_index smallint not null,
  choice smallint check (choice between 0 and 3),
  correct boolean not null,
  points integer not null,
  answered_at timestamptz not null default now(),
  primary key (game_id, user_id, question_index)
);

-- Playing a set on your own time.
create table if not exists public.quiz_attempts (
  set_id uuid not null references public.quiz_sets on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  current_index smallint not null default 0,
  shown_at timestamptz,
  score integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (set_id, user_id)
);

create table if not exists public.quiz_attempt_answers (
  set_id uuid not null references public.quiz_sets on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  question_index smallint not null,
  choice smallint check (choice between 0 and 3),
  correct boolean not null,
  points integer not null,
  answered_at timestamptz not null default now(),
  primary key (set_id, user_id, question_index)
);

-- Helpers ------------------------------------------------------------------------------
/** Points for an answer: 500 for correct, plus up to 500 for speed. Wrong or late: 0. */
create or replace function public.quiz_points(p_correct boolean, p_elapsed double precision, p_seconds integer) returns integer
language sql immutable as $$
  select case when not p_correct or p_elapsed > p_seconds + 1 then 0
              else 500 + floor(500 * greatest(0, 1 - greatest(p_elapsed, 0) / p_seconds))::int end
$$;

create or replace function public.quiz_new_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O or 1/I
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(letters, 1 + floor(random() * length(letters))::int, 1);
    end loop;
    exit when not exists (select 1 from public.quiz_games where code = c and state <> 'finished');
  end loop;
  return c;
end $$;

/** The question for a set's index, with or without its answer. */
create or replace function public.quiz_question_json(p_set uuid, p_index integer, p_with_answer boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('index', p_index, 'question', q.question, 'choices', to_jsonb(q.choices),
           'book', q.book, 'chapter', q.chapter, 'verse_start', q.verse_start, 'verse_end', q.verse_end, 'difficulty', q.difficulty)
         || case when p_with_answer then jsonb_build_object('answer', q.answer, 'evidence', q.evidence) else '{}'::jsonb end
  from public.quiz_sets s
  join public.quiz_questions q on q.id = s.question_ids[p_index + 1]
  where s.id = p_set
$$;

-- Making a set -------------------------------------------------------------------------
/** Picks p_count checked questions for the scope and difficulty. Members only. */
create or replace function public.create_quiz_set(p_circle uuid, p_scope jsonb, p_difficulty text, p_count integer, p_seconds integer default 20)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.lamp_require_user();
  kind text := p_scope->>'kind';
  bk text := upper(coalesce(p_scope->>'book', ''));
  c_from integer;
  c_to integer;
  ids uuid[];
  new_id uuid;
begin
  if not public.is_circle_member(p_circle) then raise exception 'not_a_member' using errcode = 'P0001'; end if;
  if p_difficulty not in ('easy', 'medium', 'hard', 'mixed') or p_count not between 5 and 20 or p_seconds not between 10 and 60 then
    raise exception 'bad_request' using errcode = 'P0001';
  end if;
  if kind = 'chapters' then
    c_from := (p_scope->>'from')::int;
    c_to := (p_scope->>'to')::int;
    if c_from is null or c_to is null or c_from < 1 or c_to < c_from then raise exception 'bad_request' using errcode = 'P0001'; end if;
  elsif kind not in ('bible', 'book') then
    raise exception 'bad_request' using errcode = 'P0001';
  end if;
  if kind <> 'bible' and bk !~ '^[1-3A-Z]{3}$' then raise exception 'bad_request' using errcode = 'P0001'; end if;
  perform public.lamp_rate(uid, 'quiz_set', 30, interval '1 day');

  ids := array(
    select q.id from public.quiz_questions q
    where q.status in ('checked', 'reviewed')
      and (p_difficulty = 'mixed' or q.difficulty = p_difficulty)
      and (kind = 'bible' or q.book = bk)
      and (kind <> 'chapters' or q.chapter between c_from and c_to)
    order by random()
    limit p_count);
  if coalesce(array_length(ids, 1), 0) < 5 then raise exception 'not_enough_questions' using errcode = 'P0001'; end if;

  insert into public.quiz_sets (circle_id, created_by, scope, difficulty, question_ids, seconds)
  values (p_circle, uid, jsonb_strip_nulls(jsonb_build_object('kind', kind, 'book', nullif(bk, ''), 'from', c_from, 'to', c_to)), p_difficulty, ids, p_seconds)
  returning id into new_id;
  return new_id;
end $$;

-- Live games ---------------------------------------------------------------------------
/** Opens a live game for a set; the caller hosts and plays. Returns the game id and join code. */
create or replace function public.start_quiz_game(p_set uuid) returns table (game_id uuid, code text)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.lamp_require_user();
  s public.quiz_sets;
  g uuid;
  c text := public.quiz_new_code();
begin
  select * into s from public.quiz_sets where id = p_set;
  if s.id is null or not public.is_circle_member(s.circle_id) then raise exception 'not_a_member' using errcode = 'P0001'; end if;
  perform public.lamp_rate(uid, 'quiz_game', 30, interval '1 day');
  insert into public.quiz_games (set_id, circle_id, host_id, code) values (s.id, s.circle_id, uid, c) returning id into g;
  insert into public.quiz_players (game_id, user_id) values (g, uid);
  return query select g, c;
end $$;

/** Joins (or rejoins) an open game by its code. Only members of its Circle can. */
create or replace function public.join_quiz_game(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.lamp_require_user();
  g public.quiz_games;
begin
  perform public.lamp_rate(uid, 'quiz_join', 60, interval '1 hour');
  select * into g from public.quiz_games where code = upper(btrim(coalesce(p_code, ''))) and state <> 'finished';
  -- Not found and not a member read the same, so a code says nothing about other Circles.
  if g.id is null or not public.is_circle_member(g.circle_id) then raise exception 'game_not_found' using errcode = 'P0001'; end if;
  insert into public.quiz_players (game_id, user_id) values (g.id, uid) on conflict do nothing;
  return g.id;
end $$;

/** Next question (or the end). The host, or anyone playing once the game has waited 45 seconds. */
create or replace function public.quiz_advance(p_game uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.lamp_require_user();
  g public.quiz_games;
  total integer;
begin
  select * into g from public.quiz_games where id = p_game for update;
  if g.id is null or not exists (select 1 from public.quiz_players where game_id = g.id and user_id = uid) then raise exception 'not_a_player' using errcode = 'P0001'; end if;
  if g.state = 'question' or g.state = 'finished' then raise exception 'not_now' using errcode = 'P0001'; end if;
  if g.host_id is distinct from uid and (g.state = 'lobby' or now() - g.changed_at < interval '45 seconds') then
    raise exception 'host_only' using errcode = 'P0001';
  end if;
  select array_length(question_ids, 1) into total from public.quiz_sets where id = g.set_id;
  if g.current_index + 1 >= total then
    update public.quiz_games set state = 'finished', changed_at = now() where id = g.id;
  else
    update public.quiz_games set state = 'question', current_index = g.current_index + 1, question_started_at = now(), changed_at = now() where id = g.id;
  end if;
end $$;

/** Closes the current question: the host any time; anyone once time is up or everyone has answered. */
create or replace function public.quiz_reveal(p_game uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.lamp_require_user();
  g public.quiz_games;
  secs integer;
begin
  select * into g from public.quiz_games where id = p_game for update;
  if g.id is null or not exists (select 1 from public.quiz_players where game_id = g.id and user_id = uid) then raise exception 'not_a_player' using errcode = 'P0001'; end if;
  if g.state <> 'question' then return; end if; -- already closed: fine
  select seconds into secs from public.quiz_sets where id = g.set_id;
  if g.host_id is distinct from uid
     and now() < g.question_started_at + make_interval(secs => secs)
     and exists (select 1 from public.quiz_players p where p.game_id = g.id
                 and not exists (select 1 from public.quiz_answers a where a.game_id = g.id and a.user_id = p.user_id and a.question_index = g.current_index)) then
    raise exception 'not_yet' using errcode = 'P0001';
  end if;
  update public.quiz_games set state = 'reveal', changed_at = now() where id = g.id;
end $$;

/** Answers the current question, once. Scored by the database's clock. */
create or replace function public.quiz_answer(p_game uuid, p_index integer, p_choice integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.lamp_require_user();
  g public.quiz_games;
  s public.quiz_sets;
  right_answer smallint;
  elapsed double precision;
  ok boolean;
  pts integer;
begin
  select * into g from public.quiz_games where id = p_game;
  if g.id is null or not exists (select 1 from public.quiz_players where game_id = g.id and user_id = uid) then raise exception 'not_a_player' using errcode = 'P0001'; end if;
  if g.state <> 'question' or g.current_index <> p_index then raise exception 'question_closed' using errcode = 'P0001'; end if;
  if p_choice is null or p_choice not between 0 and 3 then raise exception 'bad_request' using errcode = 'P0001'; end if;
  select * into s from public.quiz_sets where id = g.set_id;
  select answer into right_answer from public.quiz_questions where id = s.question_ids[p_index + 1];
  elapsed := extract(epoch from now() - g.question_started_at);
  ok := p_choice = right_answer;
  pts := public.quiz_points(ok, elapsed, s.seconds);
  insert into public.quiz_answers (game_id, user_id, question_index, choice, correct, points) values (g.id, uid, p_index, p_choice, ok and pts > 0, pts);
  update public.quiz_players set score = score + pts where game_id = g.id and user_id = uid;
  -- Everyone has answered: close it now.
  if not exists (select 1 from public.quiz_players p where p.game_id = g.id
                 and not exists (select 1 from public.quiz_answers a where a.game_id = g.id and a.user_id = p.user_id and a.question_index = p_index)) then
    update public.quiz_games set state = 'reveal', changed_at = now() where id = g.id and state = 'question' and current_index = p_index;
  end if;
exception when unique_violation then
  raise exception 'already_answered' using errcode = 'P0001';
end $$;

/** Everything a player's screen needs, with the answer only once the question has closed. */
create or replace function public.quiz_state(p_game uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  g public.quiz_games;
  s public.quiz_sets;
  mine public.quiz_answers;
begin
  select * into g from public.quiz_games where id = p_game;
  if g.id is null or not public.is_circle_member(g.circle_id) then raise exception 'game_not_found' using errcode = 'P0001'; end if;
  select * into s from public.quiz_sets where id = g.set_id;
  select * into mine from public.quiz_answers where game_id = g.id and user_id = uid and question_index = g.current_index;
  return jsonb_build_object(
    'id', g.id, 'circle_id', g.circle_id, 'code', g.code, 'state', g.state, 'host_id', g.host_id,
    'index', g.current_index, 'count', array_length(s.question_ids, 1), 'seconds', s.seconds,
    'scope', s.scope, 'difficulty', s.difficulty,
    'started_at', g.question_started_at, 'changed_at', g.changed_at, 'now', now(),
    'joined', exists (select 1 from public.quiz_players where game_id = g.id and user_id = uid),
    'question', case when g.current_index >= 0 and g.state <> 'lobby'
                     then public.quiz_question_json(s.id, g.current_index, g.state in ('reveal', 'finished')) end,
    'mine', case when mine.user_id is not null then jsonb_build_object('choice', mine.choice, 'points', mine.points,
                   'correct', case when g.state in ('reveal', 'finished') then mine.correct end) end,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'name', coalesce(pr.display_name, 'Lamplighter'), 'avatar', pr.avatar_id,
               'score', p.score,
               'answered', exists (select 1 from public.quiz_answers a where a.game_id = g.id and a.user_id = p.user_id and a.question_index = g.current_index))
             order by p.score desc, p.joined_at)
      from public.quiz_players p left join public.profiles pr on pr.id = p.user_id
      where p.game_id = g.id), '[]'::jsonb)
  );
end $$;

-- On your own time ---------------------------------------------------------------------
/** The next question of a set for me, timed from now; or my result when I'm done. */
create or replace function public.quiz_async_next(p_set uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.lamp_require_user();
  s public.quiz_sets;
  a public.quiz_attempts;
  total integer;
begin
  select * into s from public.quiz_sets where id = p_set;
  if s.id is null or not public.is_circle_member(s.circle_id) then raise exception 'not_a_member' using errcode = 'P0001'; end if;
  total := array_length(s.question_ids, 1);
  insert into public.quiz_attempts (set_id, user_id) values (s.id, uid) on conflict do nothing;
  select * into a from public.quiz_attempts where set_id = s.id and user_id = uid for update;
  if a.current_index >= total then
    return jsonb_build_object('done', true, 'score', a.score, 'count', total, 'seconds', s.seconds, 'scope', s.scope, 'difficulty', s.difficulty, 'circle_id', s.circle_id);
  end if;
  -- The clock starts the first time a question is shown; asking again doesn't restart it.
  if a.shown_at is null then
    update public.quiz_attempts set shown_at = now() where set_id = s.id and user_id = uid returning * into a;
  end if;
  return jsonb_build_object('done', false, 'index', a.current_index, 'count', total, 'seconds', s.seconds, 'score', a.score,
    'shown_at', a.shown_at, 'now', now(), 'scope', s.scope, 'difficulty', s.difficulty, 'circle_id', s.circle_id,
    'question', public.quiz_question_json(s.id, a.current_index, false));
end $$;

/** Answers my current question (null: time ran out) and returns the answer, then moves on. */
create or replace function public.quiz_async_answer(p_set uuid, p_index integer, p_choice integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.lamp_require_user();
  s public.quiz_sets;
  a public.quiz_attempts;
  right_answer smallint;
  ok boolean;
  pts integer;
begin
  select * into s from public.quiz_sets where id = p_set;
  if s.id is null or not public.is_circle_member(s.circle_id) then raise exception 'not_a_member' using errcode = 'P0001'; end if;
  select * into a from public.quiz_attempts where set_id = s.id and user_id = uid for update;
  if a.set_id is null or a.current_index <> p_index or a.shown_at is null then raise exception 'question_closed' using errcode = 'P0001'; end if;
  if p_choice is not null and p_choice not between 0 and 3 then raise exception 'bad_request' using errcode = 'P0001'; end if;
  select answer into right_answer from public.quiz_questions where id = s.question_ids[p_index + 1];
  ok := p_choice is not null and p_choice = right_answer;
  pts := public.quiz_points(ok, extract(epoch from now() - a.shown_at), s.seconds);
  insert into public.quiz_attempt_answers (set_id, user_id, question_index, choice, correct, points) values (s.id, uid, p_index, p_choice, ok and pts > 0, pts);
  update public.quiz_attempts set score = score + pts, current_index = current_index + 1, shown_at = null,
    finished_at = case when current_index + 1 >= array_length(s.question_ids, 1) then now() end
  where set_id = s.id and user_id = uid;
  return public.quiz_question_json(s.id, p_index, true) || jsonb_build_object('correct', ok and pts > 0, 'points', pts, 'choice', p_choice);
end $$;

/** Scores for a set: everyone in the Circle who played it, live or on their own. */
create or replace function public.quiz_set_scores(p_set uuid)
returns table (user_id uuid, name text, avatar text, score integer, finished boolean, answered integer)
language plpgsql stable security definer set search_path = '' as $$
declare s public.quiz_sets;
begin
  select * into s from public.quiz_sets where id = p_set;
  if s.id is null or not public.is_circle_member(s.circle_id) then raise exception 'not_a_member' using errcode = 'P0001'; end if;
  return query
  select a.user_id, coalesce(pr.display_name, 'Lamplighter'), pr.avatar_id, a.score, a.finished_at is not null,
         (select count(*)::int from public.quiz_attempt_answers x where x.set_id = s.id and x.user_id = a.user_id)
  from public.quiz_attempts a left join public.profiles pr on pr.id = a.user_id
  where a.set_id = s.id
  order by a.score desc, a.finished_at nulls last;
end $$;

/** A Circle's recent challenges, with any open live game and my own score. */
create or replace function public.circle_quiz_sets(p_circle uuid)
returns table (set_id uuid, scope jsonb, difficulty text, question_count integer, created_at timestamptz, created_by text,
               open_game uuid, open_code text, my_score integer, my_finished boolean, players integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_circle_member(p_circle) then raise exception 'not_a_member' using errcode = 'P0001'; end if;
  return query
  select s.id, s.scope, s.difficulty, array_length(s.question_ids, 1), s.created_at, coalesce(pr.display_name, 'Lamplighter'),
         g.id, g.code, a.score, a.finished_at is not null,
         (select count(*)::int from public.quiz_attempts x where x.set_id = s.id)
  from public.quiz_sets s
  left join public.profiles pr on pr.id = s.created_by
  left join lateral (select gg.id, gg.code from public.quiz_games gg where gg.set_id = s.id and gg.state <> 'finished' order by gg.created_at desc limit 1) g on true
  left join public.quiz_attempts a on a.set_id = s.id and a.user_id = (select auth.uid())
  where s.circle_id = p_circle
  order by s.created_at desc
  limit 10;
end $$;

-- Row-level security ---------------------------------------------------------------------
-- Members can see their Circle's games and players (the live screens listen to these rows);
-- answers, attempts and questions are reached only through the functions above.
alter table public.quiz_sets enable row level security;
alter table public.quiz_games enable row level security;
alter table public.quiz_players enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_answers enable row level security;
revoke all on public.quiz_sets, public.quiz_games, public.quiz_players, public.quiz_answers, public.quiz_attempts, public.quiz_attempt_answers from anon, authenticated;

drop policy if exists "members read" on public.quiz_games;
create policy "members read" on public.quiz_games for select to authenticated using (public.is_circle_member(circle_id));
drop policy if exists "members read" on public.quiz_players;
create policy "members read" on public.quiz_players for select to authenticated
  using (exists (select 1 from public.quiz_games g where g.id = game_id and public.is_circle_member(g.circle_id)));
grant select on public.quiz_games, public.quiz_players to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.quiz_points(boolean, double precision, integer)', 'public.quiz_new_code()', 'public.quiz_question_json(uuid, integer, boolean)',
    'public.create_quiz_set(uuid, jsonb, text, integer, integer)', 'public.start_quiz_game(uuid)', 'public.join_quiz_game(text)',
    'public.quiz_advance(uuid)', 'public.quiz_reveal(uuid)', 'public.quiz_answer(uuid, integer, integer)', 'public.quiz_state(uuid)',
    'public.quiz_async_next(uuid)', 'public.quiz_async_answer(uuid, integer, integer)', 'public.quiz_set_scores(uuid)', 'public.circle_quiz_sets(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
grant execute on function public.create_quiz_set(uuid, jsonb, text, integer, integer), public.start_quiz_game(uuid), public.join_quiz_game(text),
  public.quiz_advance(uuid), public.quiz_reveal(uuid), public.quiz_answer(uuid, integer, integer), public.quiz_state(uuid),
  public.quiz_async_next(uuid), public.quiz_async_answer(uuid, integer, integer), public.quiz_set_scores(uuid), public.circle_quiz_sets(uuid)
  to authenticated;

-- Realtime (Supabase only): game and player changes stream to members (row-level security applies).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'quiz_games') then
      alter publication supabase_realtime add table public.quiz_games;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'quiz_players') then
      alter publication supabase_realtime add table public.quiz_players;
    end if;
  end if;
end $$;
