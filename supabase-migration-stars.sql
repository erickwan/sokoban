-- Migration: exact star ratings on the leaderboard (run after the previous
-- migrations). Adds min_pushes to best_scores: a player's star rating comes
-- from their fewest-pushes run, which may differ from their fewest-moves run.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.

drop view public.best_scores;
create view public.best_scores
  with (security_invoker = true) as
  select distinct on (collection, lower(btrim(player)), level)
         btrim(player) as player, collection, level, moves, pushes,
         min(pushes) over (partition by collection, lower(btrim(player)), level)
           as min_pushes
  from public.scores
  order by collection, lower(btrim(player)), level, moves asc, pushes asc;
