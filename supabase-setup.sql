-- Sokoban leaderboard schema.
-- Run this once in your Supabase project: SQL Editor -> New query -> paste -> Run.

create table public.scores (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  player     text not null,
  level      int  not null,
  moves      int  not null,
  pushes     int  not null,
  constraint player_len  check (char_length(btrim(player)) between 1 and 20),
  constraint level_range check (level between 1 and 20),
  constraint sane_counts check (moves >= pushes and moves <= 100000),
  -- Each level's solver-verified minimum pushes; anything below is impossible.
  constraint min_pushes check (
    pushes >= (array[6,3,6,8,6,6,7,8,10,10,12,13,14,14,16,27,28,29,35,97])[level]
  )
);

-- Best run per player per level (lowest moves, pushes as tiebreak).
create view public.best_scores
  with (security_invoker = true) as
  select distinct on (lower(btrim(player)), level)
         btrim(player) as player, level, moves, pushes
  from public.scores
  order by lower(btrim(player)), level, moves asc, pushes asc;

-- Anonymous visitors may add scores and read them - never edit or delete.
alter table public.scores enable row level security;
create policy "anyone can insert" on public.scores for insert with check (true);
create policy "anyone can read"   on public.scores for select using (true);
