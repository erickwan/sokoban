# Touchline Tagger

A free, browser-based match tagger for youth soccer video (Veo downloads or any MP4). Watch the game, press a key when something happens, type the player's shirt number, and it builds player stats and clips for you. The video never leaves your computer.

## Use it

Open `index.html` in Chrome, Edge or Safari (double-click it, or serve the folder with `python3 -m http.server`). On GitHub Pages it is at `/sokoban/touchline/`.

1. **Setup** tab: enter team names and your roster, one player per line (`7 Maya`).
2. Load the match video. In Veo, download the full match as MP4.
3. Pause on the kickoff and press **K**. Do the same at the second-half kickoff so the clock shows match time.
4. Play the video and tag:

| Key | Tag | Asks for |
|---|---|---|
| G | Goal | scorer, then assist (suggested from the last pass to the scorer) |
| C | Goal conceded | who made the error (optional) |
| S | Shot | shooter |
| P | Pass completed | passer, receiver |
| L | Line-breaking pass | passer, receiver (counts as a completed pass) |
| M | Missed pass | passer, intended receiver |
| T | Lost the ball | player |
| F | Poor first touch | player |
| W | Ball-watching | player |
| B | Bunching | nothing (whole team) |
| N | Note | player (optional), text |

After a tag, type the shirt number and press **Enter**, or **Esc** to skip. You can also click a player's name. **Z** undoes the last tag. **Space** plays and pauses, **← / →** jump 5 s (1 s with Shift), and **[ / ]** change the speed.

5. **Stats** tab: score, pass completion (overall, by half and per player), line-breaking passes, shots, lost balls and coaching moments.
6. **Tags** tab: filter by tag type or player, click a time to jump there, or **Play these as clips** to watch every missed pass by #7 back to back, for example.

Tags save automatically in your browser. Use **Setup → Save & share** to export JSON (a backup you can re-import or share with another coach) or CSV (for spreadsheets).

## Cut clips to share

`make_clips.py` turns an exported JSON file into MP4 clips, and can join them into a highlight reel. It needs Python 3 and [ffmpeg](https://ffmpeg.org/download.html).

```bash
python3 make_clips.py match.json match.mp4                          # one clip per tag
python3 make_clips.py match.json match.mp4 --types goal lb --reel   # goals + line-breaking passes as one reel
python3 make_clips.py match.json match.mp4 --player 7 --out maya    # everything involving #7
```

Clip length comes from the "seconds before/after tag" values in Setup. Override them with `--pre` and `--post`.

## Adding tag types

Edit the `TYPES` list at the top of the script in `index.html`. Each entry has a key, a label, a color and up to two player prompts.
