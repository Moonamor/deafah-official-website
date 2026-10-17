#!/usr/bin/env python3
"""
qa_whatsapp.py — verifies every rendered WhatsApp link on every public page in both languages (owner decision 2026-10-17).
Expected: href = https://wa.me/966567855974?text=<URL-encoded message in the page language>, target=_blank, rel contains
noopener, accessible name «تواصل عبر واتساب» / "Chat on WhatsApp", the WhatsApp brand icon inside; the tel: link unchanged.
Reads the single source frontend/data/site.json. Never clicks a link and never sends anything.
Usage: python tools/qa_whatsapp.py [BASE]
"""
import json, sys
from urllib.parse import quote
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787").rstrip("/")
site = json.loads(Path("frontend/data/site.json").read_text(encoding="utf8"))
WA = next(s for s in site["social"] if s["id"] == "whatsapp")
SAFE = "-_.!~*'()"   # characters encodeURIComponent leaves as they are
EXPECT = {lang: WA["url"] + "?text=" + quote(WA["message"][lang], safe=SAFE) for lang in ("ar", "en")}
PAGES = ["index.html", "about.html", "catering.html", "hotels/taj-park.html"]
TEL = "tel:+966125911110"

fails, rows = [], []
with sync_playwright() as p:
    b = p.chromium.launch()
    for lang in ("ar", "en"):
        ctx = b.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_init_script(f"try {{ localStorage.setItem('deafah-lang', '{lang}'); }} catch (e) {{}}")
        pg = ctx.new_page()
        for page in PAGES:
            pg.goto(f"{BASE}/{page}", wait_until="networkidle"); pg.wait_for_timeout(1500)
            links = pg.evaluate("""() => [...document.querySelectorAll('a[data-whatsapp]')].map(a => ({ href: a.getAttribute('href'), target: a.getAttribute('target'),
                rel: a.getAttribute('rel') || '', name: a.getAttribute('aria-label'), icon: !!a.querySelector("use[href*='#whatsapp']"), where: a.closest('.social') ? 'footer' : a.closest('.float-cta') ? 'floating' : 'content' }))""")
            tels = pg.evaluate("() => [...document.querySelectorAll('a[href^=\"tel:\"]')].map(a => a.getAttribute('href'))")
            for l in links:
                ok = l["href"] == EXPECT[lang] and l["target"] == "_blank" and "noopener" in l["rel"] and l["name"] == WA["label"][lang] and l["icon"]
                rows.append((lang, page, l["where"], ok))
                if not ok: fails.append((lang, page, l))
            if not links: fails.append((lang, page, "no WhatsApp link"))
            if any(t != TEL for t in tels) or not tels: fails.append((lang, page, f"tel links {tels}"))
            print(f"{'PASS' if all(r[3] for r in rows if r[0] == lang and r[1] == page) and links else 'FAIL'}  [{lang}] {page}: {len(links)} WhatsApp link(s) ({', '.join(sorted(set(l['where'] for l in links)))}); tel {sorted(set(tels))}")
        ctx.close()
    b.close()
print("expected ar:", EXPECT["ar"]); print("expected en:", EXPECT["en"])
for f in fails: print("FAIL", f)
print(f"\n{len(rows) - len([r for r in rows if not r[3]])}/{len(rows)} WhatsApp links correct · {BASE}")
sys.exit(1 if fails else 0)
