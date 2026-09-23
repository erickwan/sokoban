#!/usr/bin/env python3
"""Cut video clips (and an optional highlight reel) from a Touchline Tagger export.

Needs ffmpeg on your PATH (https://ffmpeg.org/download.html).

Examples:
    # One clip per tag
    python3 make_clips.py match.json match.mp4

    # Only missed passes and poor first touches by #7, joined into one reel
    python3 make_clips.py match.json match.mp4 --types miss touch --player 7 --reel

Tag ids: goal conceded shot pass lb miss turnover touch watch bunch note
"""
import argparse
import json
import pathlib
import re
import shutil
import subprocess
import sys


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("tags", help="JSON file exported from Touchline Tagger")
    ap.add_argument("video", help="the match video the tags were made on")
    ap.add_argument("--out", default="clips", help="output folder (default: clips)")
    ap.add_argument("--types", nargs="+", help="only these tag ids, e.g. goal lb miss")
    ap.add_argument("--player", help="only tags involving this shirt number")
    ap.add_argument("--pre", type=float, help="seconds before each tag (default: value saved in the export, else 8)")
    ap.add_argument("--post", type=float, help="seconds after each tag (default: value saved in the export, else 4)")
    ap.add_argument("--reel", action="store_true", help="also join the clips into highlights.mp4")
    ap.add_argument("--dry-run", action="store_true", help="print the ffmpeg commands without running them")
    args = ap.parse_args()

    if not args.dry_run and not shutil.which("ffmpeg"):
        sys.exit("ffmpeg was not found. Install it from https://ffmpeg.org/download.html and try again.")

    data = json.loads(pathlib.Path(args.tags).read_text(encoding="utf-8"))
    settings = data.get("settings", {})
    pre = args.pre if args.pre is not None else float(settings.get("pre", 8))
    post = args.post if args.post is not None else float(settings.get("post", 4))
    names = {str(r["num"]): r.get("name", "") for r in data.get("roster", [])}
    labels = {t["id"]: t["label"] for t in data.get("types", [])}

    events = sorted(data.get("events", []), key=lambda e: float(e["t"]))
    if args.types:
        events = [e for e in events if e.get("type") in args.types]
    if args.player:
        events = [e for e in events if args.player in (str(e.get("player") or ""), str(e.get("player2") or ""))]
    if not events:
        sys.exit("No tags match those filters.")

    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    made = []
    for i, e in enumerate(events, 1):
        t = float(e["t"])
        start = max(0.0, t - pre)
        who = "_".join(slug(f"{p}-{names.get(str(p), '')}") for p in (e.get("player"), e.get("player2")) if p)
        name = f"{i:03d}_{int(t // 60):02d}m{int(t % 60):02d}s_{slug(labels.get(e['type'], e['type']))}"
        clip = out / (name + (f"_{who}" if who else "") + ".mp4")
        cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
               "-ss", f"{start:.2f}", "-i", args.video, "-t", f"{t - start + post:.2f}",
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
               "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(clip)]
        print(f"[{i}/{len(events)}] {clip.name}")
        if args.dry_run:
            print("   ", " ".join(cmd))
        else:
            subprocess.run(cmd, check=True)
        made.append(clip)

    if args.reel and made:
        listing = out / "reel.txt"
        listing.write_text("".join(f"file '{c.resolve().as_posix()}'\n" for c in made), encoding="utf-8")
        reel = out / "highlights.mp4"
        cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
               "-i", str(listing), "-c", "copy", str(reel)]
        if args.dry_run:
            print("   ", " ".join(cmd))
        else:
            subprocess.run(cmd, check=True)
            listing.unlink()
        print(f"Highlight reel: {reel}")

    print(f"Done: {len(made)} clip(s) in {out}/")


if __name__ == "__main__":
    main()
