#!/usr/bin/env python3
"""
shoot_hero.py — fresh hero screenshots (viewport top, after the entrance settles) in chosen themes at 390 and 1440 px,
plus one contact sheet. Usage: python tools/shoot_hero.py [BASE] [--out reference/anjum/qa/polish/hero-final] [--lang ar]
"""
import argparse, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

THEMES = [("default", "light"), ("default", "dark"), ("blue", "light"), ("blue", "dark")]
WIDTHS = [390, 1440]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?", default="http://127.0.0.1:8787")
    ap.add_argument("--out", default="reference/anjum/qa/polish/hero-final")
    ap.add_argument("--lang", default="ar")
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    shots, errors = {}, []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for pal, sch in THEMES:
            for w in WIDTHS:
                ctx = b.new_context(viewport={"width": w, "height": 844 if w < 500 else 900}, device_scale_factor=1, is_mobile=w < 500, has_touch=w < 500)
                ctx.add_init_script(f"""try {{ localStorage.setItem('deafah-theme','{sch}'); localStorage.setItem('deafah-theme-mode','manual');
                  localStorage.setItem('deafah-theme-last-check', String(Date.now())); localStorage.setItem('deafah-palette','{pal}'); localStorage.setItem('deafah-lang','{a.lang}'); }} catch (e) {{}}""")
                pg = ctx.new_page()
                pg.on("pageerror", lambda e: errors.append(str(e)[:160]))
                pg.on("console", lambda m: errors.append(m.text[:160]) if m.type == "error" else None)
                pg.goto(f"{a.base.rstrip('/')}/index.html", wait_until="networkidle")
                pg.wait_for_timeout(3500)          # headline 900 ms + CTA 600 + 600 ms, pattern strip 1 s
                f = out / f"hero-{pal}-{sch}-{w}-{a.lang}.png"
                pg.screenshot(path=str(f)); shots[(pal, sch, w)] = f
                ctx.close()
        b.close()
    H = 520
    cells = [[Image.open(shots[(pal, sch, w)]).convert("RGB") for w in WIDTHS] for pal, sch in THEMES]
    cells = [[im.resize((round(im.width * H / im.height), H), Image.LANCZOS) for im in row] for row in cells]
    W = 170 + sum(c.width for c in cells[0]) + 40
    sheet = Image.new("RGB", (W, 30 + len(THEMES) * (H + 16)), (245, 242, 238))
    d = ImageDraw.Draw(sheet)
    d.text((8, 8), f"hero ({a.lang}) - rows: theme, columns: 390px | 1440px - {a.base}", fill=(16, 24, 32))
    for r, ((pal, sch), row) in enumerate(zip(THEMES, cells)):
        y = 30 + r * (H + 16); d.text((8, y + 8), f"{pal} / {sch}", fill=(16, 24, 32)); x = 170
        for im in row: sheet.paste(im, (x, y)); x += im.width + 20
    sheet.save(out / f"hero-sheet-{a.lang}.jpg", quality=82, optimize=True)
    print("sheet", out / f"hero-sheet-{a.lang}.jpg", sheet.size, "| console errors:", len(errors), errors[:3])
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
