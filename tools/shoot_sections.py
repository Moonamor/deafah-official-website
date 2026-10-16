#!/usr/bin/env python3
"""
shoot_sections.py — screenshots of the Anjum-pattern sections in all 8 themes (4 palettes x light/dark) at 390 and
1440 px, plus one contact sheet per section (rows = themes, columns = widths).

Dev tool (Playwright for Python + Pillow). Needs a local server:  python -m http.server 8787 -d frontend
Usage:  python tools/shoot_sections.py [--base http://127.0.0.1:8787] [--out reference/anjum/qa/phase3] [--lang ar|en]
Raw PNGs go to <out>/raw/ (git-ignored); contact sheets (JPEG) to <out>/.
"""
import argparse, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

PALETTES = ["default", "green", "red", "blue"]
SCHEMES = ["light", "dark"]
WIDTHS = [390, 1440]
SECTIONS = [  # (page, id, selector, mode)  mode: element | viewport-top | lightbox
    ("index.html", "hero", "[data-scene='hero-pin']", "viewport-top"),
    ("index.html", "highlights", "#why", "element"),
    ("index.html", "explore", "#explore", "element"),
    ("index.html", "hotels-carousel", "#hotels", "element"),
    ("index.html", "makkah", "#makkah", "element"),
    ("index.html", "gallery-teaser", "#gallery", "element"),
    ("index.html", "lightbox", "#gallery [data-lightbox]", "lightbox"),
    ("index.html", "social", "#footer .social", "element"),
    ("catering.html", "catering-gallery", "#gallery", "element"),
    ("catering.html", "catering-lightbox", "#gallery [data-lightbox]", "lightbox"),
]


def boot_script(palette, scheme, lang):
    return f"""try {{ localStorage.setItem('deafah-theme', '{scheme}'); localStorage.setItem('deafah-theme-mode', 'manual');
      localStorage.setItem('deafah-theme-last-check', String(Date.now())); localStorage.setItem('deafah-palette', '{palette}');
      localStorage.setItem('deafah-lang', '{lang}'); }} catch (e) {{}}"""


def settle_reveals(page, selector):
    page.evaluate("""(sel) => { const el = document.querySelector(sel); if (!el) return;
        el.scrollIntoView({ block: 'start', behavior: 'instant' });
        window.scrollBy(0, -80); }""", selector)
    page.wait_for_timeout(1400)  # reveal 700 ms + stagger + image decode
    page.evaluate("""(sel) => { const el = document.querySelector(sel); if (!el) return;
        el.querySelectorAll('.reveal').forEach((r) => { r.classList.add('is-in'); r.style.opacity = '1'; r.style.transform = 'none'; }); }""", selector)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8787")
    ap.add_argument("--out", default="reference/anjum/qa/phase3")
    ap.add_argument("--lang", default="ar")
    a = ap.parse_args()
    out = Path(a.out); raw = out / "raw"; raw.mkdir(parents=True, exist_ok=True)
    report = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width in WIDTHS:
            for palette in PALETTES:
                for scheme in SCHEMES:
                    ctx = browser.new_context(viewport={"width": width, "height": 900 if width > 500 else 844},
                                              device_scale_factor=1, is_mobile=width < 500, has_touch=width < 500, locale="ar-SA")
                    ctx.add_init_script(boot_script(palette, scheme, a.lang))
                    page = ctx.new_page()
                    errors = []
                    page.on("pageerror", lambda e: errors.append(str(e)[:200]))
                    page.on("console", lambda m: errors.append(m.text[:200]) if m.type == "error" else None)
                    current = None
                    for pg, sid, sel, mode in SECTIONS:
                        if pg != current:
                            page.goto(f"{a.base}/{pg}", wait_until="load"); page.wait_for_timeout(1200); current = pg
                        name = f"{sid}-{palette}-{scheme}-{width}.png"
                        try:
                            if mode == "viewport-top":
                                page.evaluate("window.scrollTo(0, 0)"); page.wait_for_timeout(900)
                                page.screenshot(path=str(raw / name))
                            elif mode == "lightbox":
                                settle_reveals(page, sel.split(" ")[0])
                                page.locator(sel).nth(1).click(); page.wait_for_timeout(900)
                                page.screenshot(path=str(raw / name))
                                page.keyboard.press("Escape"); page.wait_for_timeout(800)
                            else:
                                settle_reveals(page, sel)
                                page.locator(sel).first.screenshot(path=str(raw / name))
                            report.append({"section": sid, "palette": palette, "scheme": scheme, "width": width, "file": name})
                        except Exception as e:
                            report.append({"section": sid, "palette": palette, "scheme": scheme, "width": width, "error": str(e)[:200]})
                    report.append({"console": errors, "palette": palette, "scheme": scheme, "width": width})
                    print(f"{palette}-{scheme}-{width}: errors {len(errors)}", flush=True)
                    ctx.close()
        browser.close()
    (out / "shots.json").write_text(json.dumps(report, indent=1), encoding="utf-8")

    # contact sheets: one per section, rows = 8 themes, columns = 390 | 1440 (scaled to a common row height)
    for _, sid, _, _ in SECTIONS:
        rows = []
        for palette in PALETTES:
            for scheme in SCHEMES:
                cells = []
                for width in WIDTHS:
                    f = raw / f"{sid}-{palette}-{scheme}-{width}.png"
                    cells.append(Image.open(f).convert("RGB") if f.exists() else None)
                rows.append((f"{palette} · {scheme}", cells))
        H = 360
        def fit(im):
            if im is None: return Image.new("RGB", (200, H), "white")
            return im.resize((max(1, round(im.width * H / im.height)), H), Image.LANCZOS) if im.height > H else im
        rendered = [(label, [fit(c) for c in cells]) for label, cells in rows]
        colw = [max(r[1][i].width for r in rendered) for i in range(len(WIDTHS))]
        W = 160 + sum(colw) + 16 * len(WIDTHS)
        sheet = Image.new("RGB", (W, 32 + len(rendered) * (H + 16)), (245, 242, 238))
        d = ImageDraw.Draw(sheet)
        d.text((8, 8), f"{sid} — rows: palette · scheme, columns: " + " | ".join(f"{w}px" for w in WIDTHS), fill=(16, 24, 32))
        for r, (label, cells) in enumerate(rendered):
            y = 32 + r * (H + 16); d.text((8, y + 8), label, fill=(16, 24, 32)); x = 160
            for i, c in enumerate(cells):
                sheet.paste(c, (x, y)); x += colw[i] + 16
        sheet.save(out / f"{sid}.jpg", quality=78, optimize=True)
        print("sheet", out / f"{sid}.jpg", sheet.size)


if __name__ == "__main__":
    main()
