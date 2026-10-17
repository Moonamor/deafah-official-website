#!/usr/bin/env python3
"""
capture_targeted.py — second-pass live measurement of anjumhotels.com for MOTION_SPEC.md.

capture_anjum.py's generic probes cannot time the hero (flexslider), the room carousel (slick), the header state
or the lightbox (fancybox). This pass:
  1. reads the live library configuration (flexslider vars, every slick instance's options, $.fancybox.defaults);
  2. samples the affected elements on every animation frame after each trigger (autoplay tick, next click,
     filter click, scroll threshold, lightbox open / next / close) and derives start, duration and the closest
     standard easing from the sampled curve;
  3. checks whether the gallery page is server- or client-rendered and whether the social wall loads anything
     before consent.

Usage:  python reference/anjum/capture_targeted.py --out reference/anjum/capture     (writes <out>/<ts>/targeted.json)
        python reference/anjum/capture_targeted.py --home <url> --gallery <url>  (e.g. to diff a local build)
"""
import argparse, json, math, re
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

HOME = "https://anjumhotels.com/ar/"
GALLERY = "https://anjumhotels.com/ar/hotel-overview/gallery/"
VIEWPORTS = {
    "desktop": {"viewport": {"width": 1440, "height": 900}, "is_mobile": False, "has_touch": False, "device_scale_factor": 1},
    "mobile": {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True, "device_scale_factor": 2,
               "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"},
}

# per-frame sampler: returns [[t, v0, v1, ...], ...] where v = "opacity|transform|classList" for each selector
SAMPLER = r"""
window.__sample = (sels, ms) => new Promise((res) => {
  // 10 ms timer, not requestAnimationFrame: getComputedStyle returns the animated value at the current time, and a
  // timer keeps running even when the compositor pauses rAF (a paused rAF loop hung the first version)
  const t0 = performance.now(), rows = [];
  const f = () => {
    const t = performance.now() - t0;
    rows.push([Math.round(t), ...sels.map((s) => { const e = document.querySelector(s); if (!e) return null;
      const c = getComputedStyle(e); return [parseFloat(c.opacity), c.transform, c.visibility, e.className && e.className.baseVal === undefined ? e.className : ''].join('|'); })]);
    if (t < ms) setTimeout(f, 10); else res(rows);
  };
  f();
});
"""

LIB_CONFIG = r"""
() => {
  const $ = window.jQuery; if (!$) return { jQuery: false };
  const path = (el) => { const p = []; let n = el; for (let i = 0; n && n.nodeType === 1 && i < 4; i++, n = n.parentElement) {
      if (n.id) { p.unshift('#' + n.id); break; } p.unshift(n.tagName.toLowerCase() + (n.classList[0] ? '.' + n.classList[0] : '')); } return p.join(' > '); };
  const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, typeof o[k] === 'function' ? 'fn' : o[k]]));
  const flex = [];
  $('*').each(function () { const d = $(this).data('flexslider'); if (d && d.vars) flex.push({ el: path(this), slides: d.count,
      vars: pick(d.vars, ['animation', 'easing', 'direction', 'reverse', 'animationLoop', 'smoothHeight', 'startAt', 'slideshow', 'slideshowSpeed', 'animationSpeed', 'initDelay', 'randomize', 'pauseOnAction', 'pauseOnHover', 'useCSS', 'touch', 'controlNav', 'directionNav', 'rtl', 'itemWidth', 'minItems', 'maxItems']) }); });
  const slick = [];
  $('.slick-initialized').each(function () { let s = null; try { s = $(this).slick('getSlick'); } catch (e) {}
    if (s) slick.push({ el: path(this), classes: this.className, slideCount: s.slideCount,
      options: pick(s.options, ['accessibility', 'adaptiveHeight', 'arrows', 'asNavFor', 'autoplay', 'autoplaySpeed', 'centerMode', 'centerPadding', 'cssEase', 'dots', 'draggable', 'easing', 'fade', 'focusOnSelect', 'infinite', 'pauseOnHover', 'rtl', 'slidesToShow', 'slidesToScroll', 'speed', 'swipe', 'swipeToSlide', 'touchMove', 'useCSS', 'useTransform', 'variableWidth', 'vertical', 'waitForAnimate', 'responsive']) }); });
  const fb = $.fancybox && $.fancybox.defaults ? pick($.fancybox.defaults, ['animationEffect', 'animationDuration', 'transitionEffect', 'transitionDuration', 'zoomOpacity', 'loop', 'keyboard', 'arrows', 'infobar', 'toolbar', 'buttons', 'touch', 'hash', 'thumbs', 'idleTime', 'backFocus', 'trapFocus', 'autoFocus', 'protect', 'baseClass', 'slideClass']) : null;
  return { jQuery: $.fn.jquery, flexslider: flex, slick, fancyboxDefaults: fb, fancyboxVersion: $.fancybox && $.fancybox.version };
}
"""

EASINGS = {
    "linear": lambda p: p,
    "ease": lambda p: cubic(0.25, 0.1, 0.25, 1.0, p),
    "ease-in": lambda p: cubic(0.42, 0, 1, 1, p),
    "ease-out": lambda p: cubic(0, 0, 0.58, 1, p),
    "ease-in-out": lambda p: cubic(0.42, 0, 0.58, 1, p),
    "swing (jQuery)": lambda p: 0.5 - math.cos(p * math.pi) / 2,
}


def cubic(x1, y1, x2, y2, x):
    lo, hi = 0.0, 1.0
    for _ in range(40):
        t = (lo + hi) / 2
        bx = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3
        lo, hi = (t, hi) if bx < x else (lo, t)
    t = (lo + hi) / 2
    return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3


def num(v, field):
    """opacity or translate-x/y from a sampled 'opacity|transform|visibility|class' string"""
    if v is None:
        return None
    op, tf = v.split("|")[0:2]
    if field == "opacity":
        return float(op)
    m = re.match(r"matrix\(([^)]+)\)", tf)
    if not m:
        return 0.0
    parts = [float(x) for x in m.group(1).split(",")]
    return {"tx": parts[4], "ty": parts[5], "scale": parts[0]}[field]


def analyse(rows, col, field):
    """start, end, duration (ms) and closest easing for one sampled column"""
    vals = [(r[0], num(r[col], field)) for r in rows if r[col] is not None]
    if len(vals) < 3:
        return None
    changes = [i for i in range(1, len(vals)) if abs(vals[i][1] - vals[i - 1][1]) > 1e-3]
    if not changes:
        return {"changed": False, "value": vals[0][1]}
    i0, i1 = changes[0] - 1, changes[-1]
    t0, v0 = vals[i0]
    t1, v1 = vals[i1]
    out = {"changed": True, "from": round(v0, 3), "to": round(v1, 3), "startMs": t0, "endMs": t1, "durationMs": t1 - t0}
    if abs(v1 - v0) > 1e-6 and t1 > t0:
        pts = [((t - t0) / (t1 - t0), (v - v0) / (v1 - v0)) for t, v in vals[i0:i1 + 1]]
        err = {name: round(sum((fn(p) - y) ** 2 for p, y in pts) / len(pts), 5) for name, fn in EASINGS.items()}
        out["easingFit"] = sorted(err.items(), key=lambda kv: kv[1])[:3]
    return out


def sample(page, sels, ms, trigger=None, _retry=True):
    """sample sels every 10 ms for ms; the sampler starts BEFORE the trigger fires and is collected afterwards"""
    try:
        page.evaluate("() => { " + SAMPLER + " }")   # wrapped: a bare "x = (a, b) => ..." string is treated as a function and called
        page.evaluate(f"() => {{ window.__rows = null; window.__sample({json.dumps(sels)}, {ms}).then((r) => {{ window.__rows = r; }}); }}")
        if trigger:
            trigger()
        page.wait_for_function("() => window.__rows !== null", timeout=ms + 15000, polling=100)
        return page.evaluate("() => window.__rows")
    except Exception as e:
        if not _retry or "context was destroyed" not in str(e):
            raise
        settle(page)
        return sample(page, sels, ms, trigger, _retry=False)


def settle(page):
    """the consent click can reload the page: wait for it, then for the network to calm down"""
    page.wait_for_timeout(1500)
    try:
        page.wait_for_load_state("load", timeout=20000); page.wait_for_load_state("networkidle", timeout=15000)
    except Exception:
        pass
    page.wait_for_timeout(1000)


def dismiss(page):
    for pat in (r"only essential", r"الضرورية"):
        try:
            b = page.get_by_role("button", name=re.compile(pat, re.I))
            if b.count() and b.first.is_visible():
                try:   # the consent manager reloads the page, sometimes ~2 s after the click: wait for that navigation
                    with page.expect_navigation(timeout=10000):
                        b.first.click(timeout=2000)
                except Exception:
                    pass
                return pat
        except Exception:
            pass
    return None


def home(browser, vp_name, url, out_dir):
    ctx = browser.new_context(**VIEWPORTS[vp_name], locale="ar-SA", reduced_motion="no-preference")
    page = ctx.new_page()
    third_party = []
    page.on("request", lambda r: third_party.append(r.url) if re.search(r"curator|instagram|facebook\.com/plugins|tiktok", r.url) else None)
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    try: page.wait_for_load_state("networkidle", timeout=15000)
    except Exception: pass
    R = {"viewport": vp_name, "url": url, "cookieDismissedWith": dismiss(page)}
    settle(page)
    R["libraryConfig"] = page.evaluate(LIB_CONFIG)

    def probe(name, fn):
        try:
            fn()
        except Exception as e:
            import traceback
            tb = [f"{f.lineno}: {f.line}" for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("capture_targeted.py")][-2:]
            R.setdefault("errors", {})[name] = {"error": str(e)[:200], "at": tb, "url": page.url}

    def _hero():
        nonlocal_dummy = None
        # --- hero: which slide is visible, sampled 100 ms for 24 s → interval; rAF-sampled crossfade around a change
        hero = page.evaluate("""() => { const ul = document.querySelector('#header ul.slides'); if (!ul) return null;
            const host = ul.closest('[id]'); return { host: host ? '#' + host.id : null, slides: ul.children.length }; }""")
        R["hero"] = {"found": hero}
        if hero and hero["host"]:
            lis = [f'{hero["host"]} ul.slides > li:nth-child({i + 1})' for i in range(hero["slides"])]
            timeline = []
            for _ in range(240):
                ops = page.evaluate(f"() => {json.dumps(lis)}.map(s => {{ const e = document.querySelector(s); return e ? +getComputedStyle(e).opacity : 0 }})")
                timeline.append(max(range(len(ops)), key=lambda i: ops[i]))
                page.wait_for_timeout(100)
            flips = [i * 0.1 for i in range(1, len(timeline)) if timeline[i] != timeline[i - 1]]
            R["hero"]["visibleSlideChangesAtSec"] = [round(x, 1) for x in flips]
            R["hero"]["intervalSec"] = round((flips[-1] - flips[0]) / (len(flips) - 1), 2) if len(flips) > 1 else None
            rows = sample(page, lis, 9000)
            R["hero"]["crossfade"] = [analyse(rows, i + 1, "opacity") for i in range(len(lis))]
            R["hero"]["scaleOrMove"] = [analyse(rows, i + 1, "scale") for i in range(len(lis))]
            page.screenshot(path=str(out_dir / f"hero_{vp_name}.png"))


    probe("hero", _hero)

    def _header():
        nonlocal_dummy = None
        # --- header: scrollY at which #site gets 'scrolled', nav bar + logo before/after
        def hdr():
            return page.evaluate("""() => { const pick = (s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e), r = e.getBoundingClientRect();
                return { position: c.position, top: Math.round(r.top), height: Math.round(r.height), background: c.backgroundColor, transform: c.transform, transition: c.transition.slice(0, 120) }; };
                return { site: document.querySelector('#site').className, bar: pick('.header .banner-container-2'), logo: pick('#header > .logo') }; }""")
        page.evaluate("window.scrollTo(0, 0)"); page.wait_for_timeout(600)
        R["header"] = {"atTop": hdr(), "thresholds": []}
        last = page.evaluate("document.querySelector('#site').className")
        for y in range(0, 7000, 100):
            page.evaluate(f"window.scrollTo(0, {y})"); page.wait_for_timeout(60)
            cls = page.evaluate("document.querySelector('#site').className")
            if cls != last:
                R["header"]["thresholds"].append({"scrollY": y, "siteClass": cls}); last = cls
        R["header"]["scrolled"] = hdr()
        # animate the transition: jump from just below to just above the first threshold and sample the bar + logo
        if R["header"]["thresholds"]:
            y = R["header"]["thresholds"][0]["scrollY"]
            page.evaluate(f"window.scrollTo(0, {y - 300})"); page.wait_for_timeout(1200)
            rows = sample(page, [".header .banner-container-2", "#header > .logo"], 2000, lambda: page.evaluate(f"window.scrollTo(0, {y + 100})"))
            R["header"]["onCross"] = {"bar_ty": analyse(rows, 1, "ty"), "bar_opacity": analyse(rows, 1, "opacity"), "logo_tx": analyse(rows, 2, "tx"), "logo_opacity": analyse(rows, 2, "opacity")}
            page.screenshot(path=str(out_dir / f"header_scrolled_{vp_name}.png"))


    probe("header", _header)

    def _rooms():
        nonlocal_dummy = None
        # --- rooms carousel: next click + each category filter
        rs = page.locator(".room-slider-items-slick").first
        R["rooms"] = {}
        if rs.count():
            rs.scroll_into_view_if_needed(); page.wait_for_timeout(800)
            sels = [".room-slider-items-slick .slick-track"] + [f".room-slider-items-slick .slick-track > .slick-slide:nth-child({i})" for i in (1, 2, 3)]
            nxt = page.locator(".room-slider-items-slick .slick-next").first
            if nxt.count() and nxt.is_visible():
                rows = sample(page, sels, 1800, lambda: nxt.click())
                R["rooms"]["nextClick"] = {"track_tx": analyse(rows, 1, "tx"), "slide1_opacity": analyse(rows, 2, "opacity"), "slide2_opacity": analyse(rows, 3, "opacity")}
            R["rooms"]["filters"] = []
            cats = page.locator(".room-slider-categories .categories-filter")
            for i in range(cats.count()):
                label = cats.nth(i).inner_text().strip()
                before = page.evaluate("() => [...document.querySelectorAll('.room-slider-items-slick .slick-slide:not(.slick-cloned)')].length")
                rows = sample(page, sels, 1800, lambda: cats.nth(i).click())
                after = page.evaluate("() => [...document.querySelectorAll('.room-slider-items-slick .slick-slide:not(.slick-cloned)')].length")
                R["rooms"]["filters"].append({"label": label, "slidesBefore": before, "slidesAfter": after,
                                              "track_tx": analyse(rows, 1, "tx"), "track_opacity": analyse(rows, 1, "opacity"),
                                              "slide1_opacity": analyse(rows, 2, "opacity"), "slide2_opacity": analyse(rows, 3, "opacity")})
            page.screenshot(path=str(out_dir / f"rooms_after_filters_{vp_name}.png"))


    probe("rooms", _rooms)

    def _feature():
        nonlocal_dummy = None
        # --- feature blocks slider (galslide) next click
        g = page.locator("[id^=galslide_i] .slick-next").first
        if g.count() and g.is_visible():
            g.scroll_into_view_if_needed(); page.wait_for_timeout(600)
            rows = sample(page, ["[id^=galslide_i] .slick-track", "[id^=galslide_t] .slick-track", "[id^=galslide_i] .slick-current"], 1800, lambda: g.click())
            R["featureSlider"] = {"images_track_tx": analyse(rows, 1, "tx"), "texts_track_tx": analyse(rows, 2, "tx"), "current_opacity": analyse(rows, 3, "opacity")}


    probe("feature", _feature)

    def _social():
        nonlocal_dummy = None
        # --- social wall: third-party requests before consent, then after the visitor clicks
        R["socialWall"] = {"requestsBeforeConsent": list(third_party)}
        btn = page.locator(".sm-wall .sm-confirm").first
        if btn.count():
            R["socialWall"]["consentText"] = page.evaluate("() => (document.querySelector('.sm-wall') || {}).innerText || null")
            cookies_before = len(ctx.cookies())
            btn.scroll_into_view_if_needed(); btn.click(); page.wait_for_timeout(5000)
            R["socialWall"]["requestsAfterClick"] = sorted(set(u.split("?")[0] for u in third_party))[:15]
            R["socialWall"]["cookiesBefore"], R["socialWall"]["cookiesAfter"] = cookies_before, len(ctx.cookies())
            R["socialWall"]["layout"] = page.evaluate("""() => { const w = document.querySelector('[class*=crt-], .crt-feed, #curator-feed, .sm-wall'); if (!w) return null;
                const items = w.querySelectorAll('.crt-post, [class*=post]'); const c = getComputedStyle(items[0] || w);
                return { container: w.className.slice(0, 80), items: items.length, firstItemWidth: items[0] ? Math.round(items[0].getBoundingClientRect().width) : null }; }""")
            page.locator(".sm-wall, [class*=crt-]").first.screenshot(path=str(out_dir / f"social_after_consent_{vp_name}.png"))

    probe("social", _social)

    ctx.close()
    return R


def gallery(browser, vp_name, url, out_dir):
    ctx = browser.new_context(**VIEWPORTS[vp_name], locale="ar-SA", reduced_motion="no-preference")
    page = ctx.new_page()
    raw = ctx.request.get(url).text()
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    try: page.wait_for_load_state("networkidle", timeout=15000)
    except Exception: pass
    R = {"viewport": vp_name, "url": url, "finalUrl": page.url, "cookieDismissedWith": dismiss(page)}
    settle(page)
    import traceback
    def probe(name, fn):
        try:
            fn()
        except Exception as e:
            tb = [f"{f.lineno}: {f.line}" for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("capture_targeted.py")][-2:]
            R.setdefault("errors", {})[name] = {"error": str(e)[:200], "at": tb, "url": page.url}

    def _config():
        nonlocal_dummy = None
        R["libraryConfig"] = page.evaluate(LIB_CONFIG)
        R["rendering"] = page.evaluate("""(raw) => { const items = document.querySelectorAll('.main-gallery-item, [data-fancybox], .gallery-item');
            const html = new DOMParser().parseFromString(raw, 'text/html');
            return { itemsInDom: items.length, itemsInServerHtml: html.querySelectorAll('.main-gallery-item, [data-fancybox], .gallery-item').length,
                     filters: [...document.querySelectorAll('.main-gallery-filters .gallery-filter')].map(f => f.innerText.trim()),
                     firstItem: (() => { const e = document.querySelector('.main-gallery-image.fancybox, .main-gallery-item a'); return e ? { tag: e.tagName, cls: e.className, href: e.getAttribute('href'), dataSrc: e.getAttribute('data-src') || e.getAttribute('data-href'), dataFancybox: e.getAttribute('data-fancybox') } : null; })() }; }""", raw)
    probe("config", _config)

    def _filter():
        nonlocal_dummy = None
        filt = page.locator(".main-gallery-filters .gallery-filter")
        if filt.count() > 1:
            rows = sample(page, [".main-gallery-item:nth-child(1)", ".main-gallery-item:nth-child(2)", ".main-gallery-item:nth-child(6)"], 1800, lambda: filt.nth(1).click())
            R["filterClick"] = {"label": filt.nth(1).inner_text().strip(), "item1_opacity": analyse(rows, 1, "opacity"), "item1_scale": analyse(rows, 1, "scale"),
                                "item2_opacity": analyse(rows, 2, "opacity"), "item6_opacity": analyse(rows, 3, "opacity"),
                                "visibleAfter": page.evaluate("() => [...document.querySelectorAll('.main-gallery-item')].filter(e => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0).length")}
            filt.nth(0).click(); page.wait_for_timeout(1200)
    probe("filter", _filter)

    def _lightbox():
        nonlocal_dummy = None
        link = page.locator(".main-gallery-image.fancybox, .main-gallery-item a, a[data-fancybox]").first
        if link.count():
            link.scroll_into_view_if_needed(); page.wait_for_timeout(500)
            before_url = page.url
            sels = [".fancybox-container", ".fancybox-bg", ".fancybox-slide--current .fancybox-content, .fancybox-slide--current .fancybox-image-wrap", ".fancybox-toolbar"]
            rows = sample(page, sels, 1500, lambda: link.click())
            R["lightbox"] = {"navigatedAway": page.url != before_url, "container_opacity": analyse(rows, 1, "opacity"), "bg_opacity": analyse(rows, 2, "opacity"),
                             "image_scale": analyse(rows, 3, "scale"), "image_tx": analyse(rows, 3, "tx"), "toolbar_opacity": analyse(rows, 4, "opacity")}
            R["lightbox"]["dom"] = page.evaluate("""() => { const c = document.querySelector('.fancybox-container'); if (!c) return null;
                return { role: c.getAttribute('role'), ariaModal: c.getAttribute('aria-modal'), counter: (document.querySelector('.fancybox-infobar') || {}).innerText || null,
                         caption: (document.querySelector('.fancybox-caption') || {}).innerText || null, buttons: [...c.querySelectorAll('button')].map(b => b.title || b.getAttribute('aria-label') || b.className).slice(0, 8),
                         focusInside: c.contains(document.activeElement), bg: getComputedStyle(document.querySelector('.fancybox-bg')).backgroundColor, bgOpacity: getComputedStyle(document.querySelector('.fancybox-bg')).opacity }; }""")
            page.screenshot(path=str(out_dir / f"lightbox_open_{vp_name}.png"))
            rows = sample(page, [".fancybox-slide--current", ".fancybox-slide--previous", ".fancybox-slide--next"], 1500, lambda: page.keyboard.press("ArrowRight"))
            R["lightbox"]["arrowRight"] = {"current_tx": analyse(rows, 1, "tx"), "current_opacity": analyse(rows, 1, "opacity"), "previous_tx": analyse(rows, 2, "tx"), "previous_opacity": analyse(rows, 2, "opacity"),
                                           "counterAfter": page.evaluate("() => (document.querySelector('.fancybox-infobar') || {}).innerText || null")}
            rows = sample(page, [".fancybox-container", ".fancybox-bg"], 1500, lambda: page.keyboard.press("Escape"))
            R["lightbox"]["escape"] = {"container_opacity": analyse(rows, 1, "opacity"), "bg_opacity": analyse(rows, 2, "opacity"),
                                       "closed": page.evaluate("() => !document.querySelector('.fancybox-container')"),
                                       "focusReturnedTo": page.evaluate("() => document.activeElement && (document.activeElement.className || document.activeElement.tagName)")}
    probe("lightbox", _lightbox)

    page.screenshot(path=str(out_dir / f"gallery_{vp_name}.png"), full_page=False)
    ctx.close()
    return R


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="reference/anjum/capture")
    ap.add_argument("--home", default=HOME)
    ap.add_argument("--gallery", default=GALLERY)
    ap.add_argument("--viewports", default="desktop,mobile")
    ap.add_argument("--only", default="home,gallery")
    a = ap.parse_args()
    out_dir = Path(a.out) / ("targeted-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
    out_dir.mkdir(parents=True, exist_ok=True)
    res = {"tool": "capture_targeted.py", "generatedAt": datetime.now(timezone.utc).isoformat(), "home": [], "gallery": []}
    with sync_playwright() as p:
        b = p.chromium.launch()
        for vp in a.viewports.split(","):
            for kind, fn, url in [t for t in (("home", home, a.home), ("gallery", gallery, a.gallery)) if t[0] in a.only.split(",")]:
                print(f"[{vp}] {kind}", flush=True)
                try:
                    res[kind].append(fn(b, vp, url, out_dir))
                except Exception as e:
                    res[kind].append({"viewport": vp, "error": str(e)[:400]})
        b.close()
    (out_dir / "targeted.json").write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Done →", out_dir / "targeted.json")


if __name__ == "__main__":
    main()
