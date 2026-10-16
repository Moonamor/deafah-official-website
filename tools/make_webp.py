#!/usr/bin/env python3
"""
make_webp.py — WebP derivatives for site photos (Pillow only; the same dependency as tools/favicons.py).

Reads tools/webp-jobs.json. Each job turns one or more source photos into WebP files at the requested widths and
never upscales: widths larger than the (cropped) source are skipped, and the source width itself is emitted instead
when it falls between two requested widths. Originals are only read — never renamed, moved, re-saved or deleted.

Job fields:
  "src"      file or glob, relative to the repo root (spaces / parentheses in names are fine)
  "out"      output directory, relative to the repo root
  "name"     output stem; "{stem}" = source stem lowercased (glob jobs). Final name: <name>-<width>.webp
  "widths"   e.g. [640, 1280, 1920]
  "aspect"   optional crop, e.g. "4:3" (centre crop, shifted by "anchor_x" 0..1, default 0.5)
  "quality"  optional, default 80

Writes tools/webp-manifest.json: for every output, its width and height, so data files can carry exact dimensions
(explicit width/height on <img> → no layout shift). EXIF is dropped (camera metadata is not published); an embedded
ICC profile is kept.

Usage:  python tools/make_webp.py            (all jobs)
        python tools/make_webp.py --job rst  (one job by id)
"""
import argparse, glob, json, os, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
JOBS = ROOT / "tools" / "webp-jobs.json"
MANIFEST = ROOT / "tools" / "webp-manifest.json"


def crop_to(im, aspect, anchor_x=0.5):
    if not aspect:
        return im
    aw, ah = (float(x) for x in aspect.split(":"))
    w, h = im.size
    target = aw / ah
    if w / h > target:                       # too wide → crop width
        nw = round(h * target)
        x0 = round((w - nw) * anchor_x)
        return im.crop((x0, 0, x0 + nw, h))
    nh = round(w / target)                   # too tall → crop height (centred)
    y0 = (h - nh) // 2
    return im.crop((0, y0, w, y0 + nh))


def widths_for(src_w, requested):
    out = [w for w in requested if w <= src_w]
    if src_w < max(requested) and src_w not in out:
        out.append(src_w)                    # largest available size = the source itself, never upscaled
    return sorted(out)


def run(job, manifest):
    files = sorted(glob.glob(str(ROOT / job["src"])))
    if not files:
        print(f"[{job['id']}] no source matches {job['src']}", file=sys.stderr)
        return
    out_dir = ROOT / job["out"]
    out_dir.mkdir(parents=True, exist_ok=True)
    for f in files:
        with Image.open(f) as src:
            icc = src.info.get("icc_profile")
            im = crop_to(src.convert("RGB"), job.get("aspect"), job.get("anchor_x", 0.5))
            stem = job["name"].replace("{stem}", Path(f).stem.lower())
            for w in widths_for(im.width, job["widths"]):
                h = round(im.height * w / im.width)
                dst = out_dir / f"{stem}-{w}.webp"
                im.resize((w, h), Image.LANCZOS).save(dst, "WEBP", quality=job.get("quality", 80), method=6,
                                                      **({"icc_profile": icc} if icc else {}))
                rel = dst.relative_to(ROOT / "frontend").as_posix()
                manifest[rel] = {"width": w, "height": h, "bytes": dst.stat().st_size, "source": Path(f).name}
                print(f"[{job['id']}] {Path(f).name} → {rel} {w}×{h} {dst.stat().st_size // 1024} KB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--job")
    a = ap.parse_args()
    jobs = json.loads(JOBS.read_text(encoding="utf-8"))["jobs"]
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    for job in jobs:
        if a.job and job["id"] != a.job:
            continue
        run(job, manifest)
    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
