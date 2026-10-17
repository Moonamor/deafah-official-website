#!/usr/bin/env python3
"""
contrast_audit.py — in-browser WCAG contrast audit of the rendered pages (owner brief H) + hero legibility (brief C3).

1. Text audit: every visible element that owns a text node, in all 8 themes x 390/1440 px x ar/en, on the public pages.
   Text colour (alpha and ancestor opacity composited) vs the first opaque ancestor background (alpha layers composited).
   Thresholds: 4.5:1, or 3:1 for large text (>= 24 px, or >= 18.66 px bold). Disabled / aria-disabled controls are exempt
   (WCAG 1.4.3). Text whose backdrop is a photograph (hero copy) is skipped here and measured from pixels in step 2.
2. Hero legibility: for every slide at 390 and 1440 px, the slide is shown alone with the copy hidden, the screenshot
   (photo + scrim) is sampled inside the headline / body / eyebrow boxes, and the WORST pixel (brightest, the copy is
   light) gives the contrast against the rendered text colour. Targets: headline >= 3, body and eyebrow >= 4.5.

Needs a local server:  python -m http.server 8787 -d frontend
Usage: python tools/contrast_audit.py [--base http://127.0.0.1:8787] [--out reference/anjum/qa/polish]
Writes <out>/contrast-audit.json and <out>/hero-legibility.json, prints a summary. Exit 1 on any failure.
"""
import argparse, io, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

PALETTES = ["default", "green", "red", "blue"]
SCHEMES = ["light", "dark"]
WIDTHS = [390, 1440]
LANGS = ["ar", "en"]
PAGES = ["index.html", "about.html", "catering.html"]

AUDIT_JS = r"""() => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const out = [], seen = new Set();
  const all = document.querySelectorAll("body *");
  for (const el of all) {
    if (!el.childNodes.length) continue;
    let own = ""; for (const n of el.childNodes) if (n.nodeType === 3) own += n.textContent;
    own = own.trim(); if (!own) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || el.closest("[hidden], template, .sr-only, dialog:not([open]), [aria-hidden='true'] .sr-only")) continue;
    if (el.closest("[disabled], [aria-disabled='true'], button:disabled")) continue;
    let opacity = 1, node = el, photo = false, bgLayers = [];
    for (let a = el; a; a = a.parentElement) {
      const s = getComputedStyle(a);
      opacity *= parseFloat(s.opacity);
      if (a.matches("[data-scene='hero-pin'] [data-layer='copy'], [data-scene='hero-pin'] [data-layer='cta'] .btn--secondary")) photo = true;
      if (s.backgroundImage && s.backgroundImage !== "none" && !/gradient\(.*currentcolor/i.test(s.backgroundImage) && a !== el && !a.matches(".link")) {
        if (!a.matches("select, .field select")) photo = true;
      }
      const bg = parse(s.backgroundColor);
      if (bg && bg[3] > 0) { bgLayers.push(bg); if (bg[3] >= 1) break; }
    }
    if (opacity < 0.05) continue;
    if (photo) continue;
    let bg = [255, 255, 255, 1];
    for (let i = bgLayers.length - 1; i >= 0; i--) bg = over(bgLayers[i], bg);
    let fg = parse(cs.color); if (!fg) continue;
    fg = over([fg[0], fg[1], fg[2], fg[3] * opacity], bg);
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const cr = ratio(fg, bg);
    const key = el.tagName + "|" + own.slice(0, 40) + "|" + cr.toFixed(2);
    if (seen.has(key)) continue; seen.add(key);
    out.push({ text: own.slice(0, 60), tag: el.tagName.toLowerCase(), cls: (el.className && el.className.baseVal === undefined ? el.className : "").toString().slice(0, 60),
      size, bold, need, ratio: Math.round(cr * 100) / 100, fg: fg.slice(0, 3).map(Math.round), bg: bg.slice(0, 3).map(Math.round), opacity: Math.round(opacity * 100) / 100 });
  }
  return out;
}"""


def boot(palette, scheme, lang):
    return f"""try {{ localStorage.setItem('deafah-theme','{scheme}'); localStorage.setItem('deafah-theme-mode','manual');
      localStorage.setItem('deafah-theme-last-check', String(Date.now())); localStorage.setItem('deafah-palette','{palette}');
      localStorage.setItem('deafah-lang','{lang}'); }} catch (e) {{}}"""


def scroll_through(page):
    page.evaluate("""async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); }""")
    page.wait_for_timeout(600)


def lin(v):
    v /= 255
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def lum(c):
    return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])


def ratio(a, b):
    x, y = lum(a), lum(b)
    return (max(x, y) + 0.05) / (min(x, y) + 0.05)


def hero_legibility(browser, base):
    rows = []
    for width in WIDTHS:
        for palette in PALETTES:
            for scheme, lang in [(sc, lg) for sc in SCHEMES for lg in LANGS]:
                ctx = browser.new_context(viewport={"width": width, "height": 844 if width < 500 else 900}, reduced_motion="reduce")
                ctx.add_init_script(boot(palette, scheme, lang))
                page = ctx.new_page()
                page.goto(f"{base}/index.html", wait_until="networkidle")
                page.wait_for_timeout(800)
                n = page.evaluate("document.querySelectorAll('.hero-slide').length")
                boxes = page.evaluate("""() => { const q = (s) => { const el = [...document.querySelectorAll(s)].find(e => e.getClientRects().length && getComputedStyle(e).display !== 'none'); if (!el) return null;
                    const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, color: getComputedStyle(el).color }; };
                  const lang = document.documentElement.getAttribute('data-lang');
                  return { headline: q('#heroTitle .lang-' + lang), body: q('[data-layer=copy] p .lang-' + lang), eyebrow: q('[data-layer=copy] .eyebrow .lang-' + lang) }; }""")
                for i in range(n):
                    page.evaluate("""(i) => { document.querySelectorAll('.hero-slide').forEach((s, k) => { if (s.dataset.srcset) { s.srcset = s.dataset.srcset; s.removeAttribute('data-srcset'); } if (s.dataset.src) { s.src = s.dataset.src; s.removeAttribute('data-src'); } s.classList.toggle('is-current', k === i); s.style.opacity = k === i ? '1' : '0'; s.style.transition = 'none'; });
                        document.querySelectorAll('[data-layer=copy], [data-layer=cta], .hero-pause, .theme-badge, .to-top').forEach(e => e.style.visibility = 'hidden'); }""", i)
                    page.wait_for_function("(i) => { const s = document.querySelectorAll('.hero-slide')[i]; return s.complete && s.naturalWidth > 0; }", arg=i, timeout=15000)
                    page.wait_for_timeout(300)
                    img = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
                    rec = {"width": width, "palette": palette, "scheme": scheme, "lang": lang, "slide": i}
                    for name, b in boxes.items():
                        if not b:
                            continue
                        fg = [int(v) for v in b["color"].replace("rgba(", "").replace("rgb(", "").replace(")", "").split(",")[:3]]
                        crop = img.crop((int(b["x"]), int(b["y"]), int(b["x"] + b["w"]), int(b["y"] + b["h"])))
                        px = list(crop.getdata())
                        worst = min(ratio(fg, p) for p in px[:: max(1, len(px) // 40000)])
                        px_sorted = sorted(ratio(fg, p) for p in px[:: max(1, len(px) // 40000)])
                        p1 = px_sorted[int(len(px_sorted) * 0.01)]
                        need = 3 if name == "headline" else 4.5
                        rec[name] = {"worst": round(worst, 2), "p1": round(p1, 2), "need": need, "pass": worst >= need, "fg": fg}
                    rows.append(rec)
                ctx.close()
    return rows


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8787")
    ap.add_argument("--out", default="reference/anjum/qa/polish")
    ap.add_argument("--skip-text", action="store_true")
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    fails, total = [], 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        if not a.skip_text:
            for page_name in PAGES:
                for width in WIDTHS:
                    for palette in PALETTES:
                        for scheme in SCHEMES:
                            for lang in LANGS:
                                ctx = browser.new_context(viewport={"width": width, "height": 900}, reduced_motion="reduce")
                                ctx.add_init_script(boot(palette, scheme, lang))
                                page = ctx.new_page()
                                page.goto(f"{a.base}/{page_name}", wait_until="networkidle")
                                page.wait_for_timeout(700)
                                scroll_through(page)
                                res = page.evaluate(AUDIT_JS)
                                total += len(res)
                                for r in res:
                                    if r["ratio"] < r["need"]:
                                        fails.append({"page": page_name, "width": width, "theme": f"{palette}-{scheme}", "lang": lang, **r})
                                ctx.close()
            print(f"text audit: {total} text elements checked, {len(fails)} failure(s)")
            for f in fails[:40]:
                print(f"  FAIL {f['page']} {f['theme']} {f['width']} {f['lang']}: {f['ratio']} < {f['need']}  <{f['tag']} class='{f['cls']}'> «{f['text']}» fg{f['fg']} bg{f['bg']} op{f['opacity']}")
            (out / "contrast-audit.json").write_text(json.dumps({"checked": total, "failures": fails}, ensure_ascii=False, indent=1), encoding="utf8")
        hero = hero_legibility(browser, a.base)
        browser.close()
    (out / "hero-legibility.json").write_text(json.dumps(hero, ensure_ascii=False, indent=1), encoding="utf8")
    hero_fail = [r for r in hero if any(isinstance(v, dict) and not v["pass"] for v in r.values())]
    print(f"hero legibility: {len(hero)} slide renders, {len(hero_fail)} with a failure")
    for w in WIDTHS:
        for part in ["headline", "body", "eyebrow"]:
            vals = [r[part]["worst"] for r in hero if r["width"] == w and part in r]
            if vals:
                print(f"  {w}px {part}: worst-case min {min(vals)} (target {3 if part == 'headline' else 4.5})")
    sys.exit(1 if fails or hero_fail else 0)


if __name__ == "__main__":
    main()
