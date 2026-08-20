# Sokoban

A classic Sokoban puzzle game in the browser — push every box onto a goal square.

**▶ Play it here: https://erickwan.github.io/sokoban/**

## Features

- Main quest: 20 levels of increasing difficulty, every one machine-verified solvable — a mix of Microban puzzles (David W. Skinner), custom designs, and the original 1982 Sokoban level 1
- Side quest packs: **Microban** (155 levels, David W. Skinner), **Novoban** (50 beginner levels, François Marques, ordered by solver-measured difficulty), and **Sasquatch** (50 advanced levels, David W. Skinner) — canonical level files, solver-checked for corruption
- Global leaderboard: overall ranking plus per-level bests (see `supabase-setup.sql` / `supabase-migration-collections.sql`)
- Arrow keys / WASD to move, **Z** undo, **R** restart, **L** level select
- Swipe controls on touch screens
- Move/push counters and per-level best scores, saved in your browser
- Finish a level to unlock the next; progress persists between visits

## Run locally

No build step — it's plain HTML/JS. Serve the folder (or just open `index.html`):

```bash
python3 -m http.server 8123
```

Then open http://localhost:8123.

## Adding levels

Levels live in [`levels.js`](levels.js) using standard Sokoban notation:
`#` wall, `$` box, `.` goal, `*` box on goal, `@` player, `+` player on goal.
