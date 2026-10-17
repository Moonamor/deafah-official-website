#!/usr/bin/env python3
"""
compare_boards.py — side-by-side boards: the owner's theme references (reference/theme-references/<theme>-*.png) next to
our rendered sections in the same theme (shots from tools/shoot_sections.py, Arabic).
Usage: python tools/compare_boards.py [--shots reference/anjum/qa/polish/ar/raw] [--out reference/anjum/qa/polish]
Writes board-<palette>-<scheme>.jpg for Default and Blue (light + dark).
"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw

THEMES = ["default-light", "default-dark", "blue-light", "blue-dark"]
OURS = [("hero", 390), ("separator", 1440), ("makkah", 390), ("hotels-carousel", 390), ("footer", 390), ("hero", 1440), ("makkah", 1440)]
H = 640


def fit(im, h=H, max_w=1100):
    k = min(h / im.height, max_w / im.width)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refs", default="reference/theme-references")
    ap.add_argument("--shots", default="reference/anjum/qa/polish/ar/raw")
    ap.add_argument("--out", default="reference/anjum/qa/polish")
    a = ap.parse_args()
    for theme in THEMES:
        pal, sch = theme.split("-")
        cells = []
        for kind in ["announcement", "ramadan"]:
            f = Path(a.refs) / f"{theme}-{kind}.png"
            if f.exists():
                cells.append((f"REFERENCE: {kind}", fit(Image.open(f).convert("RGB"))))
        for sid, w in OURS:
            f = Path(a.shots) / f"{sid}-{pal}-{sch}-{w}.png"
            if not f.exists():
                continue
            im = Image.open(f).convert("RGB")
            if w == 390 and im.height > 1400:
                im = im.crop((0, 0, im.width, 1400))
            cells.append((f"SITE: {sid} {w}px", fit(im)))
        W = sum(c[1].width for c in cells) + 24 * (len(cells) + 1)
        board = Image.new("RGB", (W, H + 72), (255, 255, 255))
        d = ImageDraw.Draw(board)
        d.text((24, 12), f"{theme} - left: owner references; right: the site in the same theme (Arabic)", fill=(16, 24, 32))
        x = 24
        for label, im in cells:
            d.text((x, 40), label, fill=(16, 24, 32))
            board.paste(im, (x, 60))
            x += im.width + 24
        out = Path(a.out) / f"board-{theme}.jpg"
        board.save(out, quality=80, optimize=True)
        print("board", out, board.size)


if __name__ == "__main__":
    main()
