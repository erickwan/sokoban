-- Migration: side-quest level collections (run AFTER supabase-setup.sql).
-- Adds a collection tag to scores so side-quest packs (Microban, Novoban,
-- Sasquatch) share the leaderboard with the main quest.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.

alter table public.scores
  add column collection text not null default 'main';

alter table public.scores
  add constraint collection_name
  check (collection in ('main', 'microban', 'novoban', 'sasquatch'));

alter table public.scores drop constraint level_range;
alter table public.scores
  add constraint level_range check (level between 1 and 500);

alter table public.scores
  add constraint main_level_range
  check (collection <> 'main' or level between 1 and 20);

-- Main-quest minimums stay solver-enforced; packs just need a plausible score.
alter table public.scores drop constraint min_pushes;
alter table public.scores
  add constraint min_pushes check (
    (collection = 'main'
      and pushes >= (array[6,3,6,8,6,6,7,8,10,10,12,13,14,14,16,27,28,29,35,97])[level])
    or (collection <> 'main' and pushes >= 1)
  );

drop view public.best_scores;
create view public.best_scores
  with (security_invoker = true) as
  select distinct on (collection, lower(btrim(player)), level)
         btrim(player) as player, collection, level, moves, pushes
  from public.scores
  order by collection, lower(btrim(player)), level, moves asc, pushes asc;
