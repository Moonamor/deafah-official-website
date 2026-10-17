#!/usr/bin/env python3
"""
motion_diff.py — measures the shipped motion on a deployed origin and diffs it against reference/anjum/MOTION_SPEC.md
targets (header rows 3 and 4 are excluded by decision C1; owner-requested rows are checked separately).

Measured live in Chromium (desktop 1440 x 900), by sampling computed styles / scroll positions every animation frame:
  row 1  hero crossfade: interval between slide changes + fade duration (opacity 0 -> 1 of the incoming slide)
  row 7  highlights slider: .hl__track transition-duration
  row 9  card / image hover: transition-duration of .gallery-thumb__img, .card
  row 10 overview tiles hover: .qtile__img, .qtile__veil
  row 11 hotels carousel: duration of the scroll tween after "next"
  row 12 hotel filters: crossfade duration (inline transition set by carousel.js)
  row 17 gallery filters: crossfade duration
  row 18 lightbox open, 19 next / previous, 20 close
  A10    button hover 200 ms;  A15 theme toast 2.5 s
Usage: python tools/motion_diff.py [BASE]   → prints a table, writes reference/anjum/qa/polish/motion-diff.json
"""
import json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787").rstrip("/")
TOL = 0.10  # 10 % (frame sampling at 60 Hz)

SAMPLER = """(args) => new Promise((resolve) => {
  const [sel, prop, ms] = args; const out = []; const t0 = performance.now();
  const el = () => document.querySelector(sel);
  function tick() { const e = el(); const v = e ? (prop === 'scrollLeft' ? e.scrollLeft : getComputedStyle(e)[prop]) : null;
    out.push([performance.now() - t0, v]); if (performance.now() - t0 < ms) requestAnimationFrame(tick); else resolve(out); }
  requestAnimationFrame(tick); window.__samplerStarted = true;
})"""


def duration(samples, numeric=True):
    """time from the first change to the last change of the sampled value"""
    vals = [(t, float(v) if numeric and v is not None else v) for t, v in samples]
    first = vals[0][1]; start = end = None; prev = first
    for t, v in vals:
        if v != prev:
            if start is None: start = t
            end = t
        prev = v
    return None if start is None else round(end - start)


def css_ms(v):
    m = re.findall(r"([\d.]+)(ms|s)", v or "")
    return [round(float(n) * (1000 if u == "s" else 1)) for n, u in m]


def main():
    rows = []
    def row(r, what, target, got, note=""):
        ok = got is not None and (abs(got - target) <= max(34, target * TOL) if isinstance(got, (int, float)) else False)
        rows.append({"row": r, "what": what, "target_ms": target, "measured_ms": got, "pass": ok, "note": note})
        print(f"{'PASS' if ok else 'FAIL'}  row {r:<4} {what:<46} target {target:>5} ms   measured {got} ms {note}", flush=True)

    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        pg.goto(BASE + "/index.html", wait_until="networkidle"); pg.wait_for_timeout(1200)

        # row 1: hero — wait for the next slide change, sample the incoming slide's opacity
        idx = pg.evaluate("() => [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-current'))")
        h = pg.evaluate_handle("() => new Promise(r => { const t0 = performance.now(); const s = [...document.querySelectorAll('.hero-slide')]; const start = s.findIndex(x => x.classList.contains('is-current'));"
                               " const out = []; (function tick() { const now = performance.now() - t0; const cur = s.findIndex(x => x.classList.contains('is-current'));"
                               " out.push([now, cur, parseFloat(getComputedStyle(s[(start + 1) % s.length]).opacity)]); if (now < 9500) requestAnimationFrame(tick); else r(out); })(); })")
        samples = h.json_value()
        change = next((t for t, c, o in samples if c != idx), None)
        op = [(t, o) for t, c, o in samples]
        fade_start = next((t for t, o in op if o > 0), None); fade_end = next((t for t, o in op if fade_start is not None and t > fade_start and o >= 1), None)
        mounted = pg.evaluate("() => performance.now()")
        row("1", "hero fade (incoming slide opacity 0 → 1)", 1000, None if fade_start is None or fade_end is None else round(fade_end - fade_start))
        attrs = pg.evaluate("() => { const d = document.querySelector('[data-slideshow]'); return [+d.dataset.interval, +d.dataset.fade]; }")
        row("1", "hero interval (data-interval, timer)", 7000, attrs[0], f"first change observed at {round(change) if change else None} ms after the sampler started")

        # row 7, 9, 10, A10: declared transition durations
        decl = pg.evaluate("""() => { const g = (s, prop) => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e);
            const names = cs.transitionProperty.split(',').map(x => x.trim()), durs = cs.transitionDuration.split(',').map(x => x.trim());
            const i = names.indexOf(prop); return i < 0 ? (names[0] === 'all' ? durs[0] : null) : durs[i % durs.length]; };
          return { hl: g('.hl__track', 'transform'), thumb: g('.gallery-thumb__img', 'transform'), card: g('.card', 'transform'), qimg: g('.qtile__img', 'transform'), qveil: g('.qtile__veil', 'opacity'),
                   btn: g('.btn', 'transform'), lbImg: g('.lightbox__img', 'opacity'), lb: g('.lightbox', 'opacity') }; }""")
        row("7", "highlights slider track", 300, (css_ms(decl["hl"]) or [None])[0])
        row("9", "gallery photo hover (scale)", 200, (css_ms(decl["thumb"]) or [None])[0])
        row("9", "card hover (lift)", 200, (css_ms(decl["card"]) or [None])[0])
        row("10", "overview tile hover (image)", 200, (css_ms(decl["qimg"]) or [None])[0])
        row("10", "overview tile hover (veil)", 200, (css_ms(decl["qveil"]) or [None])[0])
        row("A10", "button hover lift", 200, (css_ms(decl["btn"]) or [None])[0])

        # row 11: carousel next → scroll tween duration
        pg.evaluate("() => document.getElementById('hotels').scrollIntoView({ block: 'start' })"); pg.wait_for_timeout(900)
        pg.evaluate("() => { window.__s = null; }")
        pg.evaluate("(a) => { window.__p = (" + SAMPLER + ")(a); }", ["#hotelGrid", "scrollLeft", 1200])
        pg.click("[data-carousel-next]")
        s = pg.evaluate("() => window.__p")
        row("11", "hotels carousel slide (scroll tween)", 500, duration(s))

        # row 12: filter crossfade (inline transition written by carousel.js)
        pg.evaluate("(a) => { window.__p = (" + SAMPLER + ")(a); }", ["#hotelGrid", "opacity", 900])
        pg.click("[data-filter-group=rating] [data-filter='2']")
        s = pg.evaluate("() => window.__p")
        out_d = duration([(t, v) for t, v in s if t < 260])
        row("12", "hotel filter fade-out (opacity)", 200, out_d)
        pg.click("[data-filter-group=rating] [data-filter='all']"); pg.wait_for_timeout(700)

        # row 17: gallery filter
        pg.evaluate("() => document.getElementById('gallery').scrollIntoView({ block: 'start' })"); pg.wait_for_timeout(900)
        pg.evaluate("(a) => { window.__p = (" + SAMPLER + ")(a); }", ["#galleryGrid", "opacity", 900])
        pg.click("#gallery [role=tab][data-filter=buffet]")
        s = pg.evaluate("() => window.__p")
        row("17", "gallery filter fade-out (opacity)", 200, duration([(t, v) for t, v in s if t < 260]))
        pg.click("#gallery [role=tab][data-filter=all]"); pg.wait_for_timeout(700)

        # rows 18–20: lightbox
        pg.evaluate("(a) => { window.__p = (" + SAMPLER + ")(a); }", ["#lightbox", "opacity", 1000])
        pg.locator("#gallery [data-lightbox]").nth(1).click()
        s = pg.evaluate("() => window.__p")
        row("18", "lightbox open (backdrop opacity)", 500, duration(s))
        pg.wait_for_timeout(400)
        pg.evaluate("(a) => { window.__p = (" + SAMPLER + ")(a); }", [".lightbox__img:not(.is-current)", "opacity", 800])
        pg.keyboard.press("ArrowLeft");
        s = pg.evaluate("() => window.__p")
        row("19", "lightbox next (image crossfade)", 366, (css_ms(decl["lbImg"]) or [None])[0], f"sampled {duration(s)} ms")
        pg.wait_for_timeout(500)
        pg.evaluate("(a) => { window.__p = (" + SAMPLER + ")(a); }", ["#lightbox", "opacity", 1000])
        pg.keyboard.press("Escape")
        s = pg.evaluate("() => window.__p")
        row("20", "lightbox close (backdrop opacity)", 500, duration(s))

        # A15: theme toast 2.5 s
        pg.evaluate("() => window.scrollTo(0, 0)"); pg.wait_for_timeout(500)
        pg.click("#themeToggle")
        h = pg.evaluate("() => new Promise(r => { const t0 = performance.now(); const t = document.getElementById('toast'); let seen = null; (function tick() { const v = t.classList.contains('is-visible'); if (v && seen === null) seen = performance.now() - t0; if (!v && seen !== null) return r(performance.now() - t0 - seen); if (performance.now() - t0 < 4000) requestAnimationFrame(tick); else r(null); })(); })")
        row("A15", "theme toast visible time", 2500, None if h is None else round(h))
        b.close()
    out = Path("reference/anjum/qa/polish"); out.mkdir(parents=True, exist_ok=True)
    (out / "motion-diff.json").write_text(json.dumps({"base": BASE, "excluded": ["3", "4 (header, decision C1)", "5 (no dropdown in our nav)", "13 (no looping arrow; button hover = A10)", "14-16a (not built)"], "rows": rows}, ensure_ascii=False, indent=1), encoding="utf8")
    bad = [r for r in rows if not r["pass"]]
    print(f"\n{len(rows) - len(bad)}/{len(rows)} within tolerance · {BASE}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
