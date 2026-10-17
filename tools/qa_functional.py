#!/usr/bin/env python3
"""
qa_functional.py — functional tests (48 base checks, Phase 3 contract) + UI/UX-polish checks, against any origin.
Usage:  python tools/qa_functional.py [BASE]    (default http://127.0.0.1:8787; e.g. the branch deploy URL)
Exit 1 on any failure.
"""
import json, sys
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding="utf-8")
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787").rstrip("/")
POLISH = []
def pk(name, cond, detail=""):
    POLISH.append((name, bool(cond), detail)); print(("PASS " if cond else "FAIL ") + "[polish] " + name + (f"  — {detail}" if detail else ""), flush=True)
res = []
def ok(name, cond, detail=""):
    res.append((name, bool(cond), detail)); print(("PASS " if cond else "FAIL ") + name + (f"  — {detail}" if detail else ""), flush=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    for lang in ("ar", "en"):
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, locale="ar-SA")
        ctx.add_init_script(f"try{{localStorage.setItem('deafah-lang','{lang}')}}catch(e){{}}")
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(BASE + "/index.html", wait_until="load"); pg.wait_for_timeout(1500)
        t = lambda sel: pg.evaluate("(s) => (document.querySelector(s) || {}).innerText || ''", sel).strip()
        # hero slideshow advances
        first = pg.evaluate("() => [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-current'))")
        pg.wait_for_timeout(8600)
        now = pg.evaluate("() => [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-current'))")
        ok(f"[{lang}] hero slideshow advances after the 7 s interval", first == 0 and now == 1, f"{first} -> {now}")
        pg.click("[data-slideshow-toggle]"); ok(f"[{lang}] hero pause button toggles aria-pressed", pg.get_attribute("[data-slideshow-toggle]", "aria-pressed") == "true")
        # highlights
        pg.locator("#why").scroll_into_view_if_needed(); pg.wait_for_timeout(500)
        pg.click("#why [data-slide-next]"); pg.wait_for_timeout(500)
        ok(f"[{lang}] highlights next → 2 / 4", "2" in t("#why [data-slide-count]") or "٢" in t("#why [data-slide-count]"), t("#why [data-slide-count]"))
        hidden = pg.evaluate("() => [...document.querySelectorAll('.hl__item')].map(i => i.getAttribute('aria-hidden'))")
        ok(f"[{lang}] only the current highlight is exposed to assistive tech", hidden == ["true", "false", "true", "true"], str(hidden))
        # carousel
        pg.locator("#hotels").scroll_into_view_if_needed(); pg.wait_for_timeout(600)
        pg.click("[data-carousel-next]"); pg.wait_for_timeout(800)
        ok(f"[{lang}] carousel next → 2 / 6", t("[data-carousel-status]") in ("٢ / ٦", "2 / 6"), t("[data-carousel-status]"))
        cur = pg.evaluate("() => { const c = document.querySelector('.hotel-card.is-current'); const v = document.getElementById('hotelGrid').getBoundingClientRect(); const r = c.getBoundingClientRect(); return Math.round((r.left + r.width / 2) - (v.left + v.width / 2)); }")
        ok(f"[{lang}] current card is centred after the 500 ms slide", abs(cur) <= 2, f"offset {cur}px")
        pg.click("[data-filter-group=rating] [data-filter='3']"); pg.wait_for_timeout(600)
        vis = pg.evaluate("() => [...document.querySelectorAll('.hotel-card')].filter(c => !c.hidden).map(c => c.dataset.slug)")
        ok(f"[{lang}] rating filter 'Premium' shows only 3-star hotels", vis == ["saraya-al-deafah"], str(vis))
        pg.click("[data-filter-group=walk] [data-filter='near']"); pg.wait_for_timeout(600)
        ok(f"[{lang}] combined filters with no match show the empty state", pg.is_visible("[data-carousel-empty]"))
        pg.click("[data-filter-group=rating] [data-filter='all']"); pg.wait_for_timeout(600)
        vis = pg.evaluate("() => [...document.querySelectorAll('.hotel-card')].filter(c => !c.hidden).map(c => c.dataset.slug)")
        ok(f"[{lang}] walk filter 'up to 5 min' shows the 5-minute hotel", vis == ["zahrat-al-lavender"], str(vis))
        pg.click("[data-filter-group=walk] [data-filter='all']"); pg.wait_for_timeout(600)
        # polish: live count, dots, empty state reset (filters are back to all/all here)
        pk(f"[{lang}] live result count names all hotels", t("[data-carousel-count-text]") in ("٦ فنادق", "6 hotels"), t("[data-carousel-count-text]"))
        pk(f"[{lang}] one progress dot per visible card", pg.evaluate("() => document.querySelectorAll('.hcar__dot').length") == 6)
        pg.click("[data-filter-group=rating] [data-filter='3']"); pg.wait_for_timeout(500); pg.click("[data-filter-group=walk] [data-filter='near']"); pg.wait_for_timeout(600)
        pk(f"[{lang}] empty state has an icon and a reset button", pg.is_visible("[data-carousel-empty] .icon") and pg.is_visible("[data-carousel-reset]"))
        pk(f"[{lang}] count reads zero in the empty state", t("[data-carousel-count-text]") in ("لا فنادق", "0 hotels"), t("[data-carousel-count-text]"))
        pg.click("[data-carousel-reset]"); pg.wait_for_timeout(700)
        pk(f"[{lang}] reset restores every hotel and selects all in both groups", pg.evaluate("() => [...document.querySelectorAll('.hotel-card')].filter(c => !c.hidden).length === 6 && [...document.querySelectorAll('[data-filter-group] [aria-selected=true]')].every(t => t.dataset.filter === 'all')"))
        pk(f"[{lang}] the selected chip shows its check icon", pg.evaluate("() => { const c = document.querySelector('[data-filter-group=rating] [aria-selected=true] .tab-check'); return !!c && getComputedStyle(c).display !== 'none'; }"))
        # gallery + lightbox
        pg.locator("#gallery").scroll_into_view_if_needed(); pg.wait_for_timeout(600)
        pg.click("#gallery [role=tab][data-filter=buffet]"); pg.wait_for_timeout(600)
        n = pg.evaluate("() => document.querySelectorAll('#gallery .gallery-item:not([hidden])').length")
        ok(f"[{lang}] gallery filter 'buffet' shows 2 teaser photos", n == 2, str(n))
        pg.click("#gallery [role=tab][data-filter=all]"); pg.wait_for_timeout(600)
        thumb = pg.locator("#gallery [data-lightbox]").nth(1); thumb.click(); pg.wait_for_timeout(900)
        ok(f"[{lang}] lightbox opens as a modal dialog", pg.evaluate("() => document.getElementById('lightbox').open && document.getElementById('lightbox').getAttribute('aria-modal') === 'true'"))
        ok(f"[{lang}] focus moves into the lightbox", pg.evaluate("() => document.getElementById('lightbox').contains(document.activeElement)"))
        ok(f"[{lang}] Lenis is stopped while the dialog is open", pg.evaluate("() => { const l = window.DeafahMotion && window.DeafahMotion.lenis(); return !l || l.isStopped; }"))
        c1 = t("[data-lightbox-count]")
        pg.keyboard.press("ArrowLeft" if lang == "ar" else "ArrowRight"); pg.wait_for_timeout(600)
        c2 = t("[data-lightbox-count]")
        ok(f"[{lang}] reading-direction arrow key goes to the next photo", c1 != c2 and ("3" in c2 or "٣" in c2), f"{c1} -> {c2}")
        cap = t("[data-lightbox-caption]")
        ok(f"[{lang}] caption comes from the alt data", len(cap) > 10, cap[:60])
        for _ in range(12): pg.keyboard.press("Tab")
        ok(f"[{lang}] Tab stays inside the lightbox", pg.evaluate("() => document.getElementById('lightbox').contains(document.activeElement)"))
        pg.keyboard.press("Escape"); pg.wait_for_timeout(900)
        ok(f"[{lang}] Esc closes the lightbox", not pg.evaluate("() => document.getElementById('lightbox').open"))
        ok(f"[{lang}] focus returns to the photo that opened it", pg.evaluate("() => document.activeElement && document.activeElement.matches('[data-lightbox]')"))
        ok(f"[{lang}] Lenis restarts after close", pg.evaluate("() => { const l = window.DeafahMotion && window.DeafahMotion.lenis(); return !l || !l.isStopped; }"))
        # social
        soc = pg.evaluate("() => ({ links: document.querySelectorAll('.social a').length, pending: [...document.querySelectorAll('.social .is-pending')].filter(e => e.getAttribute('aria-disabled') === 'true' && !e.hasAttribute('href')).length })")
        ok(f"[{lang}] social icons are non-navigating while url is null", soc["links"] == 0 and soc["pending"] == 6, str(soc))
        ok(f"[{lang}] no console errors on home", not errs, " | ".join(errs[:2]))
        # polish: header, logo, toasts, scroll UI, legal links
        pk(f"[{lang}] header is a panel", pg.evaluate("() => document.getElementById('siteHeader').classList.contains('panel')"))
        pk(f"[{lang}] Default palette mounts the NEG logo in the {'RTL' if lang == 'ar' else 'LTR'} lockup", pg.evaluate("(l) => { const e = document.querySelector('#siteHeader [data-logo]'); const f = e.dataset.logoFile || ''; return e.dataset.logoVariant === 'neg' && (f.includes(l === 'ar' ? 'rtl' : 'ltr') || f.includes('symbol')); }", lang))
        pg.evaluate("() => { document.documentElement.setAttribute('data-theme', 'blue'); document.dispatchEvent(new CustomEvent('deafah:themechange', { detail: {} })); }"); pg.wait_for_timeout(300)
        pk(f"[{lang}] Blue palette mounts the WHITE logo", pg.evaluate("() => document.querySelector('#siteHeader [data-logo]').dataset.logoVariant === 'white'"))
        pg.evaluate("() => window.scrollTo(0, 0)"); pg.wait_for_timeout(400)
        pg.click("#themeToggle"); pg.wait_for_timeout(500)
        pk(f"[{lang}] theme toggle sets a pressed state and shows a polite toast", pg.get_attribute("#themeToggle", "aria-pressed") in ("true", "false") and pg.evaluate("() => { const t = document.getElementById('toast'); return t.classList.contains('is-visible') && t.getAttribute('aria-live') === 'polite' && t.textContent.length > 4; }"))
        pg.wait_for_timeout(2700)
        pk(f"[{lang}] theme toast hides after 2.5 s", not pg.evaluate("() => document.getElementById('toast').classList.contains('is-visible')"))
        pg.click("#themeToggle"); pg.wait_for_timeout(300)
        pg.evaluate("() => { const l = window.DeafahMotion && window.DeafahMotion.lenis(); const y = window.innerHeight * 2; if (l) l.scrollTo(y, { immediate: true }); else window.scrollTo(0, y); }"); pg.wait_for_timeout(700)
        pk(f"[{lang}] back-to-top appears after one viewport", pg.evaluate("() => document.querySelector('.to-top').classList.contains('is-visible')"))
        pk(f"[{lang}] scroll progress bar tracks the scroll", pg.evaluate("() => { const m = getComputedStyle(document.querySelector('[data-scroll-progress]')).transform; return m !== 'none' && parseFloat(m.split('(')[1]) > 0.01; }"))
        pg.click(".to-top"); pg.wait_for_timeout(2200)
        pk(f"[{lang}] back-to-top returns to the top", pg.evaluate("() => window.scrollY") < 40, str(pg.evaluate("() => window.scrollY")))
        legal = pg.evaluate("() => ({ a: document.querySelectorAll('.legal a').length, pending: document.querySelectorAll('.legal [aria-disabled=true]').length })")
        pk(f"[{lang}] footer legal links are non-navigating while url is null (Part A3)", legal["a"] == 0 and legal["pending"] == 3, str(legal))
        pk(f"[{lang}] the lowest-price Makkah fact is hidden (Part A7)", pg.evaluate("() => document.querySelectorAll('.makkah__fact').length") == 2)
        # catering
        errs.clear(); pg.goto(BASE + "/catering.html", wait_until="load"); pg.wait_for_timeout(1500)
        n = pg.evaluate("() => document.querySelectorAll('#gallery .gallery-item').length")
        ok(f"[{lang}] catering gallery has all 22 Al Taj photos", n == 22, str(n))
        robots = pg.evaluate("() => (document.querySelector('meta[name=robots]') || {}).content || null")
        ok(f"[{lang}] catering page carries the prototype noindex, nofollow (Part A5)", robots == "noindex, nofollow", str(robots))
        ok(f"[{lang}] no console errors on catering", not errs, " | ".join(errs[:2]))
        pk(f"[{lang}] catering heading is the Part A2 title", t("#catTitle") in ("إعاشة الحجاج والمعتمرين", "Pilgrim Catering"), t("#catTitle"))
        pg.wait_for_timeout(800)
        wa = pg.evaluate("() => { const a = document.querySelector('[data-whatsapp]'); const p = document.querySelector('[data-phone]'); return { wa: !!a && !a.hasAttribute('href') && a.getAttribute('aria-disabled') === 'true', tel: !!p && (p.getAttribute('href') || '').startsWith('tel:') }; }")
        pk(f"[{lang}] WhatsApp is non-navigating and the call link stays tel: (Part A6)", wa["wa"] and wa["tel"], str(wa))
        ctx.close()
    b.close()
fails = [r for r in res if not r[1]]
pf = [r for r in POLISH if not r[1]]
print(f"\nbase: {len(res) - len(fails)}/{len(res)} passed · polish: {len(POLISH) - len(pf)}/{len(POLISH)} passed · {BASE}")
sys.exit(1 if fails or pf else 0)
