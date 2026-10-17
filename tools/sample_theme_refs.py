#!/usr/bin/env python3
"""
sample_theme_refs.py — sample the owner's theme references (reference/theme-references/*.png) for THEME_SPEC.md.

Anti-aliased edges distort averages, so each named region reports its most frequent EXACT colours (solid interiors
dominate the counts) instead of a mean. Regions are fractions of the image (x0, y0, x1, y1), read off the references.
For text, the dominant colour is the background: the second colour (when it is not an edge blend) is the ink.

Usage: python tools/sample_theme_refs.py  →  prints a table and writes reference/theme-references/samples.json
"""
import json
from collections import Counter
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "reference" / "theme-references"

# region name → box (fractions). Announcement layout (top panel, light/dark content band, chips, footer band);
# Ramadan layout (top panel, content surface, bottom band).
ANNOUNCEMENT = {
    "panel": (0.30, 0.02, 0.70, 0.08),
    "pattern-strip": (0.02, 0.02, 0.085, 0.55),
    "label (ANNOUNCEMENT)": (0.64, 0.225, 0.86, 0.245),
    "title (white)": (0.45, 0.27, 0.95, 0.33),
    "rule": (0.82, 0.405, 0.94, 0.412),
    "content surface": (0.10, 0.60, 0.50, 0.63),
    "content text": (0.06, 0.645, 0.57, 0.675),
    "button": (0.66, 0.638, 0.93, 0.682),
    "separator": (0.06, 0.705, 0.94, 0.712),
    "chip": (0.07, 0.735, 0.27, 0.78),
    "footer microcopy": (0.06, 0.89, 0.57, 0.91),
    "bottom pattern": (0.04, 0.94, 0.96, 0.99),
}
RAMADAN = {
    "panel": (0.05, 0.02, 0.30, 0.20),
    "pattern band": (0.33, 0.235, 0.67, 0.29),
    "content surface": (0.10, 0.60, 0.90, 0.85),
    "title": (0.24, 0.39, 0.76, 0.46),
    "subtitle (Latin)": (0.35, 0.478, 0.65, 0.505),
    "body": (0.26, 0.525, 0.74, 0.55),
    "bottom pattern": (0.04, 0.93, 0.96, 0.99),
}


def hexc(c):
    return "#%02X%02X%02X" % c[:3]


def sample(im, box):
    W, H = im.size
    x0, y0, x1, y1 = box
    crop = im.crop((round(x0 * W), round(y0 * H), round(x1 * W), round(y1 * H)))
    cnt = Counter(crop.getdata())
    tot = sum(cnt.values())
    return [(hexc(c), round(100 * n / tot, 1)) for c, n in cnt.most_common(4)]


def ink(im, box):
    """thin strokes (pattern, small text) are mostly edge blends: take the median of the 8 % of pixels furthest from
    the region's background colour — that is the ink the artwork was drawn with"""
    W, H = im.size
    x0, y0, x1, y1 = box
    px = list(im.crop((round(x0 * W), round(y0 * H), round(x1 * W), round(y1 * H))).getdata())
    bg = Counter(px).most_common(1)[0][0]
    d = sorted(px, key=lambda c: -sum((a - b) ** 2 for a, b in zip(c, bg)))
    top = d[: max(1, len(d) * 8 // 100)]
    med = tuple(sorted(ch)[len(ch) // 2] for ch in zip(*top))
    return {"background": hexc(bg), "ink": hexc(med)}


def main():
    out = {}
    inks = {}
    for f in sorted(ROOT.glob("*-*.png")):
        if f.name.startswith("issue"):
            continue
        im = Image.open(f).convert("RGB")
        regions = ANNOUNCEMENT if "announcement" in f.name else RAMADAN
        inks[f.name] = {n: ink(im, b) for n, b in regions.items() if any(k in n for k in ("pattern", "text", "microcopy", "label", "subtitle", "body", "chip", "separator"))}
    print("\nINK (median of the strongest 8 % of pixels against the region background)")
    for name, d in inks.items():
        print(f"  {name}")
        for r, v in d.items():
            print(f"    {r:22s} bg {v['background']}  ink {v['ink']}")
    for f in sorted(ROOT.glob("*-*.png")):
        if f.name.startswith("issue"):
            continue
        im = Image.open(f).convert("RGB")
        regions = ANNOUNCEMENT if "announcement" in f.name else RAMADAN
        out[f.name] = {name: sample(im, box) for name, box in regions.items()}
        print(f"\n{f.name} {im.size}")
        for name, top in out[f.name].items():
            print(f"  {name:22s} " + "  ".join(f"{h} {p}%" for h, p in top))
    (ROOT / "samples.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
