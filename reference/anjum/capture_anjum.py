#!/usr/bin/env python3
"""
capture_anjum.py — Playwright reconnaissance of anjumhotels.com (or any site).

Captures, per page and per viewport:
  - page sections in DOM order (headings, text excerpt, images, lazy-load attrs, bbox)
  - detected front-end libraries (globals + script/style URLs)
  - @keyframes and transition/animation CSS rules (same-origin sheets)
  - every element with a computed transition or animation
  - Web Animations API snapshot (document.getAnimations) incl. keyframes
  - scroll-reveal behaviour (elements whose opacity/transform/class change while scrolling)
  - IntersectionObserver usage and attribute-mutation log during scroll
  - sliders/carousels: slide count, controls, autoplay interval, transition timing
  - lightbox behaviour on gallery links
  - hover effects on cards/images
  - sticky/shrinking header
  - screenshots (full page + per section) and a video of the run

Usage:
  pip install playwright && python -m playwright install chromium
  python capture_anjum.py                       # default Anjum page set, desktop + mobile
  python capture_anjum.py --url https://anjumhotels.com/ar/ --viewports desktop
  python capture_anjum.py --headed --slow 250   # watch it run

Output: ./anjum_capture/<timestamp>/capture.json (+ screenshots/, videos/)
"""
import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

DEFAULT_PAGES = {
    "home": "https://anjumhotels.com/ar/",
    "gallery": "https://anjumhotels.com/ar/hotel-overview/gallery/",
    "rooms": "https://anjumhotels.com/ar/rooms-suites/",
    "room_detail_junior_suite": "https://anjumhotels.com/ar/--obj-0-15742.html",
    "dining": "https://anjumhotels.com/ar/dining/",
    "destination": "https://anjumhotels.com/ar/destination-makkah/",
}

VIEWPORTS = {
    "desktop": {"viewport": {"width": 1440, "height": 900}, "is_mobile": False, "has_touch": False,
                "device_scale_factor": 1},
    "mobile": {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True,
               "device_scale_factor": 2,
               "user_agent": ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
                              "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")},
}

COOKIE_BUTTON_PATTERNS = [
    r"only essential", r"nur notwendige", r"essential cookies", r"الضرورية", r"ملفات تعريف الارتباط الأساسية",
    r"accept selected", r"قبول المحدد",
]

# ---------------------------------------------------------------------------
# Injected before any page script runs: instrumentation hooks.
# ---------------------------------------------------------------------------
INIT_SCRIPT = r"""
(() => {
  const W = window;
  W.__cap = { io: [], mutations: [], elementAnimate: [], rafCount: 0, t0: performance.now() };
  const path = (el) => {
    if (!el || el.nodeType !== 1) return null;
    const parts = [];
    let n = el, depth = 0;
    while (n && n.nodeType === 1 && depth < 5) {
      if (n.id) { parts.unshift('#' + CSS.escape(n.id)); break; }
      let s = n.tagName.toLowerCase();
      const cls = [...n.classList].filter(c => !/^(is-|has-|active|visible|show|animated|aos-|in-view|inview|open|current|selected|loaded|lazyloaded|swiper-slide-)/.test(c)).slice(0, 2);
      if (cls.length) s += '.' + cls.map(c => CSS.escape(c)).join('.');
      const p = n.parentElement;
      if (p) {
        const same = [...p.children].filter(c => c.tagName === n.tagName);
        if (same.length > 1) s += `:nth-of-type(${same.indexOf(n) + 1})`;
      }
      parts.unshift(s); n = n.parentElement; depth++;
    }
    return parts.join(' > ');
  };
  W.__capPath = path;

  // IntersectionObserver usage
  const IO = W.IntersectionObserver;
  if (IO) {
    W.IntersectionObserver = function (cb, opts) {
      const rec = { options: opts ? { rootMargin: opts.rootMargin, threshold: opts.threshold } : null, targets: [],
                    stack: (new Error().stack || '').split('\n').slice(2, 5).join(' | ') };
      W.__cap.io.push(rec);
      const inst = new IO(cb, opts);
      const obs = inst.observe.bind(inst);
      inst.observe = (t) => { if (rec.targets.length < 50) rec.targets.push(path(t)); return obs(t); };
      return inst;
    };
    W.IntersectionObserver.prototype = IO.prototype;
  }

  // element.animate() calls (WAAPI used by libs like GSAP-less code, Motion One...)
  const anim = Element.prototype.animate;
  Element.prototype.animate = function (kf, opts) {
    if (W.__cap.elementAnimate.length < 200)
      W.__cap.elementAnimate.push({ target: path(this), keyframes: JSON.stringify(kf).slice(0, 600),
                                    options: typeof opts === 'object' ? JSON.stringify(opts) : opts,
                                    t: Math.round(performance.now() - W.__cap.t0) });
    return anim.call(this, kf, opts);
  };

  // rAF activity (a JS-driven animation loop shows up as a steadily increasing count)
  const raf = W.requestAnimationFrame;
  W.requestAnimationFrame = (cb) => { W.__cap.rafCount++; return raf.call(W, cb); };

  // attribute mutations (class/style changes = JS-driven reveal / slider state)
  const start = () => {
    const mo = new MutationObserver((list) => {
      for (const m of list) {
        if (W.__cap.mutations.length > 4000) return;
        const el = m.target;
        W.__cap.mutations.push({
          t: Math.round(performance.now() - W.__cap.t0), scrollY: Math.round(W.scrollY),
          target: path(el), attr: m.attributeName,
          old: (m.oldValue || '').slice(0, 160),
          now: ((el.getAttribute && el.getAttribute(m.attributeName)) || '').slice(0, 160),
        });
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeOldValue: true, subtree: true,
                                           attributeFilter: ['class', 'style', 'data-aos', 'aria-hidden', 'src'] });
  };
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
})();
"""

# ---------------------------------------------------------------------------
# In-page extractors
# ---------------------------------------------------------------------------
JS_LIBRARIES = r"""
() => {
  const g = window, has = (k) => { try { return typeof g[k] !== 'undefined'; } catch { return false; } };
  const jq = g.jQuery || g.$;
  const fn = (jq && jq.fn) || {};
  const globals = {
    jQuery: jq && jq.fn ? (jq.fn.jquery || true) : false,
    Swiper: has('Swiper'), slick: !!fn.slick, owlCarousel: !!fn.owlCarousel, Splide: has('Splide'),
    Glide: has('Glide'), Flickity: has('Flickity'), tns: has('tns'), Splitting: has('Splitting'),
    AOS: has('AOS'), WOW: has('WOW'), ScrollReveal: has('ScrollReveal'), gsap: has('gsap') ? (g.gsap.version || true) : false,
    ScrollTrigger: has('ScrollTrigger'), Lenis: has('Lenis'), LocomotiveScroll: has('LocomotiveScroll'),
    anime: has('anime'), Rellax: has('Rellax'), simpleParallax: has('simpleParallax'), jarallax: has('jarallax'),
    fancybox: has('Fancybox') || !!fn.fancybox, lightGallery: has('lightGallery') || !!fn.lightGallery,
    PhotoSwipe: has('PhotoSwipe') || has('PhotoSwipeLightbox'), GLightbox: has('GLightbox'), magnificPopup: !!fn.magnificPopup,
    colorbox: !!fn.colorbox, lazySizes: has('lazySizes'), LazyLoad: has('LazyLoad'), lozad: has('lozad'),
    Curator: has('Curator'), Bootstrap: has('bootstrap') || !!fn.modal, Vue: has('Vue'), React: has('React'),
    THREE: has('THREE'), lottie: has('lottie') || has('bodymovin'),
  };
  const scripts = [...document.scripts].map(s => s.src).filter(Boolean);
  const styles = [...document.querySelectorAll('link[rel~="stylesheet"]')].map(l => l.href);
  const inlineScriptHints = [...document.scripts].filter(s => !s.src).map(s => s.textContent)
    .join('\n').match(/\b(swiper|slick|owl|aos|gsap|parallax|lightbox|fancybox|lazy\w*|carousel|slider|animate\w*)\b/gi) || [];
  const hintCounts = {}; inlineScriptHints.forEach(h => { const k = h.toLowerCase(); hintCounts[k] = (hintCounts[k] || 0) + 1; });
  const fonts = [...new Set([...document.querySelectorAll('body, h1, h2, h3, p, a, button')].slice(0, 400)
    .map(e => getComputedStyle(e).fontFamily))];
  return { globals: Object.fromEntries(Object.entries(globals).filter(([, v]) => v)), scripts, styles,
           inlineScriptHints: hintCounts, fontsInUse: fonts,
           meta: { title: document.title, lang: document.documentElement.lang, dir: document.documentElement.dir || getComputedStyle(document.documentElement).direction,
                   generator: (document.querySelector('meta[name=generator]') || {}).content || null } };
}
"""

JS_CSS_RULES = r"""
() => {
  const keyframes = [], animRules = [], blocked = [], cssVars = {};
  const walk = (rules, sheetHref, media) => {
    for (const r of rules) {
      if (r.type === CSSRule.KEYFRAMES_RULE) {
        keyframes.push({ name: r.name, sheet: sheetHref, css: r.cssText.slice(0, 1500) });
      } else if (r.type === CSSRule.MEDIA_RULE || r.type === CSSRule.SUPPORTS_RULE) {
        walk(r.cssRules, sheetHref, r.conditionText || r.media && r.media.mediaText);
      } else if (r.type === CSSRule.STYLE_RULE) {
        const st = r.style;
        const tr = st.transition || st.transitionProperty, an = st.animation || st.animationName;
        const interesting = tr || an || /:hover|:focus|\.(aos|animate|reveal|fade|slide|in-view|visible|active)/i.test(r.selectorText)
          && (st.transform || st.opacity || st.filter || st.boxShadow);
        if (interesting && animRules.length < 600) {
          animRules.push({ selector: r.selectorText.slice(0, 300), media: media || null, sheet: sheetHref,
            transition: st.transition || null, animation: st.animation || null,
            transform: st.transform || null, opacity: st.opacity || null, filter: st.filter || null,
            boxShadow: st.boxShadow || null, transitionDelay: st.transitionDelay || null });
        }
        if (r.selectorText === ':root') for (const p of st) if (p.startsWith('--')) cssVars[p] = st.getPropertyValue(p).trim();
      }
    }
  };
  for (const s of document.styleSheets) {
    try { walk(s.cssRules, s.href || 'inline', null); }
    catch (e) { blocked.push(s.href); }
  }
  return { keyframes, animRules, crossOriginSheetsNotReadable: blocked, rootCssVariables: cssVars };
}
"""

JS_COMPUTED_MOTION = r"""
() => {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (out.length >= 500) break;
    const cs = getComputedStyle(el);
    const hasTr = cs.transitionDuration.split(',').some(d => parseFloat(d) > 0);
    const hasAn = cs.animationName && cs.animationName !== 'none';
    if (!hasTr && !hasAn) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    out.push({ el: window.__capPath(el), tag: el.tagName.toLowerCase(),
      transition: hasTr ? { property: cs.transitionProperty, duration: cs.transitionDuration,
                            timing: cs.transitionTimingFunction, delay: cs.transitionDelay } : null,
      animation: hasAn ? { name: cs.animationName, duration: cs.animationDuration, timing: cs.animationTimingFunction,
                           delay: cs.animationDelay, iteration: cs.animationIterationCount, direction: cs.animationDirection,
                           fill: cs.animationFillMode } : null });
  }
  return out;
}
"""

JS_WAAPI = r"""
() => (document.getAnimations ? document.getAnimations() : []).slice(0, 200).map(a => {
  const e = a.effect || {}; let t = null, kf = null, timing = null;
  try { t = e.target ? window.__capPath(e.target) : null; } catch {}
  try { kf = e.getKeyframes ? e.getKeyframes().map(k => { const o = { ...k }; delete o.computedOffset; return o; }) : null; } catch {}
  try { timing = e.getComputedTiming ? (({ duration, delay, iterations, easing, direction, fill }) =>
          ({ duration, delay, iterations, easing, direction, fill }))(e.getComputedTiming()) : null; } catch {}
  return { type: a.constructor.name, name: a.animationName || a.transitionProperty || a.id || null,
           playState: a.playState, target: t, timing, keyframes: kf && JSON.stringify(kf).slice(0, 800) };
})
"""

JS_SECTIONS = r"""
() => {
  const MIN_H = 120;
  const cands = [...document.querySelectorAll('header, nav, main > *, section, footer, [class*="module"], [class*="section"], [class*="block"], [class*="teaser"], [class*="slider"], [class*="gallery"], [id^="module"], body > div > *')]
    .filter(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
                    return r.height >= MIN_H && r.width >= innerWidth * 0.5 && cs.display !== 'none' && cs.visibility !== 'hidden'; });
  // keep outermost meaningful blocks: drop a candidate if an ancestor candidate exists with nearly the same box
  const set = new Set(cands);
  const tops = cands.filter(el => {
    let p = el.parentElement;
    while (p) { if (set.has(p)) { const a = p.getBoundingClientRect(), b = el.getBoundingClientRect();
                                  if (Math.abs(a.height - b.height) < 40) return false; if (a.height > b.height * 3) break; }
                p = p.parentElement; }
    return true;
  });
  // leaf-most level that tiles the page: keep elements that have no candidate descendants covering > 60% of them
  const leaves = tops.filter(el => !tops.some(o => o !== el && el.contains(o) && o.getBoundingClientRect().height > el.getBoundingClientRect().height * 0.25));
  leaves.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
  return leaves.slice(0, 40).map((el, i) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const imgs = [...el.querySelectorAll('img')];
    const bgEls = [el, ...el.querySelectorAll('*')].filter(e => { const b = getComputedStyle(e).backgroundImage; return b && b !== 'none' && b.includes('url('); });
    const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
    return {
      index: i, selector: window.__capPath(el), tag: el.tagName.toLowerCase(), id: el.id || null,
      classes: [...el.classList], top: Math.round(r.top + scrollY), height: Math.round(r.height),
      headings: [...el.querySelectorAll('h1,h2,h3,h4')].map(h => ({ level: h.tagName, text: h.innerText.trim().slice(0, 140) })).slice(0, 20),
      textExcerpt: text.slice(0, 600), textLength: text.length,
      links: [...el.querySelectorAll('a[href]')].slice(0, 30).map(a => ({ text: a.innerText.trim().slice(0, 80), href: a.href })),
      images: imgs.slice(0, 40).map(im => ({ src: im.currentSrc || im.src || null, dataSrc: im.dataset.src || im.dataset.lazy || im.dataset.original || null,
        srcset: im.getAttribute('srcset') || im.dataset.srcset || null, loading: im.loading || null, alt: im.alt || '',
        w: im.naturalWidth, h: im.naturalHeight, objectFit: getComputedStyle(im).objectFit })),
      backgroundImages: bgEls.slice(0, 15).map(e => ({ el: window.__capPath(e), bg: getComputedStyle(e).backgroundImage.slice(0, 300),
        attachment: getComputedStyle(e).backgroundAttachment, size: getComputedStyle(e).backgroundSize })),
      videos: [...el.querySelectorAll('video, iframe')].map(v => ({ tag: v.tagName.toLowerCase(), src: v.currentSrc || v.src || v.dataset.src || null,
        autoplay: v.autoplay || null, muted: v.muted || null, loop: v.loop || null })),
      layout: { display: cs.display, position: cs.position, gridTemplateColumns: cs.gridTemplateColumns !== 'none' ? cs.gridTemplateColumns : null,
                flexDirection: cs.display.includes('flex') ? cs.flexDirection : null, background: cs.backgroundColor, color: cs.color,
                padding: cs.padding, overflow: cs.overflow },
      parallaxHints: bgEls.some(e => getComputedStyle(e).backgroundAttachment === 'fixed') || /parallax/i.test(el.className) ||
                     !!el.querySelector('[data-parallax], [class*="parallax"], [data-speed], [data-rellax-speed]'),
      dataAttributes: [...new Set([el, ...el.querySelectorAll('*')].slice(0, 400).flatMap(e => [...e.attributes].map(a => a.name))
                        .filter(n => n.startsWith('data-')))].slice(0, 40),
    };
  });
}
"""

JS_MOTION_STATE = r"""
() => {
  const out = {};
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(); if (r.width < 20 || r.height < 20) continue;
    const cs = getComputedStyle(el);
    const op = parseFloat(cs.opacity), tf = cs.transform, vis = cs.visibility, clip = cs.clipPath, flt = cs.filter;
    if (op < 1 || tf !== 'none' || vis === 'hidden' || (clip && clip !== 'none') || (flt && flt !== 'none')) {
      const p = window.__capPath(el); if (p) out[p] = { opacity: op, transform: tf, visibility: vis, clipPath: clip, filter: flt, cls: el.className && el.className.baseVal === undefined ? el.className : '' };
      if (Object.keys(out).length > 1500) break;
    }
  }
  return out;
}
"""

JS_SLIDERS = r"""
() => {
  const sel = '[class*="swiper"], [class*="slick"], [class*="owl-"], [class*="splide"], [class*="glide"], [class*="flickity"], [class*="slider"], [class*="carousel"], [class*="slideshow"], [class*="gallery"], [class*="teaser"]';
  const els = [...document.querySelectorAll(sel)].filter(el => { const r = el.getBoundingClientRect(); return r.width > 200 && r.height > 120; });
  const outer = els.filter(el => !els.some(o => o !== el && o.contains(el)));
  return outer.slice(0, 15).map((el, i) => {
    el.setAttribute('data-cap-slider', String(i));
    const kids = (root) => [...root.children].filter(c => c.getBoundingClientRect().width > 50);
    // find the track: deepest descendant with >=2 similar-width children
    let track = null, best = 0;
    for (const d of [el, ...el.querySelectorAll('*')]) {
      const k = kids(d); if (k.length >= 2 && k.length > best) {
        const w = k.map(c => Math.round(c.getBoundingClientRect().width)); const same = w.filter(x => Math.abs(x - w[0]) < 5).length;
        if (same >= 2) { best = k.length; track = d; } }
    }
    if (track) track.setAttribute('data-cap-track', String(i));
    const controls = {
      prev: !!el.querySelector('[class*="prev"], [aria-label*="rev" i], [aria-label*="السابق"]'),
      next: !!el.querySelector('[class*="next"], [aria-label*="ext" i], [aria-label*="التالي"]'),
      dots: el.querySelectorAll('[class*="dot"], [class*="bullet"], [class*="pagination"] > *, [role="tab"]').length,
      thumbnails: el.querySelectorAll('[class*="thumb"]').length,
      tabsOrFilters: [...el.querySelectorAll('[role="tab"], [class*="filter"] button, [class*="filter"] a, [data-filter]')].map(t => t.innerText.trim()).filter(Boolean).slice(0, 10),
    };
    const ts = track ? getComputedStyle(track) : null;
    return { index: i, selector: window.__capPath(el), classes: [...el.classList], dataAttributes: [...el.attributes].filter(a => a.name.startsWith('data-')).map(a => `${a.name}=${a.value.slice(0, 120)}`),
             trackSelector: track ? window.__capPath(track) : null, slideCount: best, controls,
             trackTransition: ts ? { transition: ts.transition, transform: ts.transform } : null,
             slideTransition: track && track.children[0] ? getComputedStyle(track.children[0]).transition : null,
             galleryLinks: [...el.querySelectorAll('a[href]')].filter(a => /\.(jpe?g|png|webp|avif)(\?|$)|media|resize|lightbox|gallery/i.test(a.href + a.className + (a.dataset.fancybox || '') + (a.dataset.lightbox || ''))).length };
  });
}
"""

JS_TRACK_STATE = r"""
(i) => {
  const t = document.querySelector(`[data-cap-track="${i}"]`); if (!t) return null;
  const cs = getComputedStyle(t);
  const active = [...t.children].findIndex(c => /active|current|selected/.test(c.className) || c.getAttribute('aria-hidden') === 'false');
  const vis = [...t.children].map(c => parseFloat(getComputedStyle(c).opacity)).join(',');
  return { transform: cs.transform, scrollLeft: Math.round(t.scrollLeft), active, opacities: vis,
           firstLeft: t.children[0] ? Math.round(t.children[0].getBoundingClientRect().left) : null };
}
"""

JS_OVERLAYS = r"""
() => [...document.querySelectorAll('body *')].filter(e => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
  return (cs.position === 'fixed' || cs.position === 'absolute') && r.width > innerWidth * 0.6 && r.height > innerHeight * 0.6 && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.1; })
  .map(e => ({ el: window.__capPath(e), classes: [...e.classList].slice(0, 6), zIndex: getComputedStyle(e).zIndex,
               background: getComputedStyle(e).backgroundColor, animation: getComputedStyle(e).animationName, transition: getComputedStyle(e).transition }))
"""

JS_HOVER_TARGETS = r"""
() => {
  const sel = 'a[class*="card"], [class*="card"], [class*="teaser"] a, [class*="room"] a, [class*="item"] a, figure, .btn, a.button, button';
  const seen = new Set(), out = [];
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect(); if (r.width < 60 || r.height < 30) continue;
    const key = [...el.classList].slice(0, 2).join('.') + el.tagName; if (seen.has(key)) continue; seen.add(key);
    el.setAttribute('data-cap-hover', String(out.length));
    out.push({ i: out.length, el: window.__capPath(el) });
    if (out.length >= 12) break;
  }
  return out;
}
"""

JS_HOVER_STYLE = r"""
(i) => {
  const el = document.querySelector(`[data-cap-hover="${i}"]`); if (!el) return null;
  const pick = (e) => { if (!e) return null; const c = getComputedStyle(e);
    return { transform: c.transform, opacity: c.opacity, boxShadow: c.boxShadow, filter: c.filter, background: c.backgroundColor,
             color: c.color, borderColor: c.borderColor, textDecoration: c.textDecorationLine, transition: c.transition }; };
  return { self: pick(el), img: pick(el.querySelector('img')), overlay: pick(el.querySelector('[class*="overlay"], [class*="caption"], figcaption')) };
}
"""

JS_HEADER = r"""
() => { const h = document.querySelector('header, [class*="header"]'); if (!h) return null; const c = getComputedStyle(h); const r = h.getBoundingClientRect();
  return { selector: window.__capPath(h), position: c.position, top: c.top, height: Math.round(r.height), background: c.backgroundColor,
           boxShadow: c.boxShadow, backdropFilter: c.backdropFilter, classes: [...h.classList], transform: c.transform, transition: c.transition }; }
"""


def diff_states(before: dict, after: dict, limit=150):
    changed = []
    for k, v in after.items():
        b = before.get(k)
        if b is None:
            continue
        delta = {f: {"from": b[f], "to": v[f]} for f in ("opacity", "transform", "visibility", "clipPath", "filter")
                 if b.get(f) != v.get(f)}
        if delta:
            changed.append({"el": k, "changes": delta})
        if len(changed) >= limit:
            break
    # elements that were hidden/offset before and are no longer in the "non-default" set
    revealed = [k for k, b in before.items() if k not in after and (b["opacity"] < 1 or b["transform"] != "none")][:limit]
    return changed, revealed


def dismiss_cookies(page):
    for pat in COOKIE_BUTTON_PATTERNS:
        try:
            btn = page.get_by_role("button", name=re.compile(pat, re.I))
            if btn.count() and btn.first.is_visible():
                btn.first.click(timeout=2000)
                page.wait_for_timeout(600)
                return pat
        except Exception:
            continue
    return None


def safe(fn, *a, default=None):
    try:
        return fn(*a)
    except Exception as e:  # keep capturing even when one probe fails
        return {"error": str(e)[:300]} if default is None else default


def capture_page(browser, name, url, vp_name, out_dir: Path, args):
    vp = VIEWPORTS[vp_name]
    ctx_opts = dict(vp, locale="ar-SA", reduced_motion="no-preference", ignore_https_errors=False,
                    record_video_dir=str(out_dir / "videos"), record_video_size=vp["viewport"])
    ctx = browser.new_context(**ctx_opts)
    ctx.add_init_script(INIT_SCRIPT)
    page = ctx.new_page()
    shots = out_dir / "screenshots" / f"{name}_{vp_name}"
    shots.mkdir(parents=True, exist_ok=True)
    result = {"page": name, "url": url, "viewport": vp_name, "capturedAt": datetime.now(timezone.utc).isoformat()}
    print(f"[{vp_name}] {name}: {url}", flush=True)

    resp = None
    try:
        resp = page.goto(url, wait_until="domcontentloaded", timeout=args.timeout)
        try:
            page.wait_for_load_state("networkidle", timeout=15000)
        except PWTimeout:
            pass
    except Exception as e:
        result["error"] = f"navigation failed: {e}"
        ctx.close()
        return result
    result["finalUrl"] = page.url
    result["httpStatus"] = resp.status if resp else None
    result["redirected"] = page.url.rstrip("/") != url.rstrip("/")

    # Above-the-fold intro animations: sample WAAPI right after load, before cookie click
    page.wait_for_timeout(300)
    result["introAnimations"] = safe(page.evaluate, JS_WAAPI)
    page.screenshot(path=str(shots / "00_first_paint.png"))
    page.wait_for_timeout(2500)
    page.screenshot(path=str(shots / "01_after_intro.png"))

    result["cookieDismissedWith"] = dismiss_cookies(page)
    result["libraries"] = safe(page.evaluate, JS_LIBRARIES)
    result["cssMotion"] = safe(page.evaluate, JS_CSS_RULES)
    result["header"] = {"atTop": safe(page.evaluate, JS_HEADER)}

    # --- scroll pass: reveal-on-scroll + lazy loading ----------------------------------------
    before = safe(page.evaluate, JS_MOTION_STATE, default={})
    total_h = page.evaluate("document.documentElement.scrollHeight")
    vh = vp["viewport"]["height"]
    steps, y = [], 0
    step_waapi = []
    while y < total_h and len(steps) < 80:
        y += int(vh * 0.5)
        page.mouse.wheel(0, int(vh * 0.5)) if not vp["is_mobile"] else page.evaluate(f"window.scrollBy(0, {int(vh * 0.5)})")
        page.wait_for_timeout(args.scroll_wait)
        running = safe(page.evaluate, JS_WAAPI, default=[])
        running = [a for a in running if isinstance(a, dict) and a.get("playState") == "running"]
        if running:
            step_waapi.append({"scrollY": page.evaluate("Math.round(scrollY)"), "running": running[:15]})
        steps.append(page.evaluate("Math.round(scrollY)"))
        total_h = page.evaluate("document.documentElement.scrollHeight")
        if y > 1200 and "header_scrolled" not in result["header"]:
            result["header"]["scrolled"] = safe(page.evaluate, JS_HEADER)
            result["header_scrolled"] = True
    result.pop("header_scrolled", None)
    after = safe(page.evaluate, JS_MOTION_STATE, default={})
    changed, revealed = diff_states(before, after)
    result["scrollReveal"] = {"scrollPositions": steps, "elementsChangedByScroll": changed,
                              "elementsNoLongerHiddenOrOffset": revealed, "animationsRunningDuringScroll": step_waapi}

    # Scroll back to top, settle, extract sections (now that lazy content has loaded)
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(800)
    result["sections"] = safe(page.evaluate, JS_SECTIONS, default=[])
    result["computedMotion"] = safe(page.evaluate, JS_COMPUTED_MOTION)

    # Per-section screenshots
    for s in (result["sections"] if isinstance(result["sections"], list) else [])[: args.max_section_shots]:
        try:
            page.evaluate(f"window.scrollTo(0, {max(0, s['top'] - 10)})")
            page.wait_for_timeout(500)
            fn = shots / f"section_{s['index']:02d}.png"
            page.screenshot(path=str(fn))
            s["screenshot"] = str(fn.relative_to(out_dir))
        except Exception:
            pass

    # --- sliders: autoplay + transition timing ----------------------------------------------
    sliders = safe(page.evaluate, JS_SLIDERS, default=[])
    if isinstance(sliders, list):
        for sl in sliders:
            try:
                page.locator(f'[data-cap-slider="{sl["index"]}"]').scroll_into_view_if_needed(timeout=3000)
            except Exception:
                pass
            samples, last, changes = [], None, []
            t0 = time.time()
            while time.time() - t0 < args.slider_watch:
                st = safe(page.evaluate, JS_TRACK_STATE, sl["index"], default=None)
                if st and last and st != last:
                    changes.append(round(time.time() - t0, 2))
                last = st or last
                samples.append(st)
                page.wait_for_timeout(250)
            # collapse consecutive change timestamps (one slide move spans several samples)
            moves = []
            for c in changes:
                if not moves or c - moves[-1][-1] > 0.6:
                    moves.append([c])
                else:
                    moves[-1].append(c)
            starts = [m[0] for m in moves]
            durations = [round(m[-1] - m[0] + 0.25, 2) for m in moves]
            intervals = [round(b - a, 2) for a, b in zip(starts, starts[1:])]
            sl["autoplay"] = {"watchedSeconds": args.slider_watch, "slideChanges": len(starts), "changeStartsAt": starts,
                              "estimatedIntervalSec": round(sum(intervals) / len(intervals), 2) if intervals else None,
                              "estimatedTransitionSec": round(sum(durations) / len(durations), 2) if durations else None,
                              "autoplayDetected": len(starts) >= 2}
            # try the next control, measure what moves
            try:
                nxt = page.locator(f'[data-cap-slider="{sl["index"]}"] [class*="next"]').first
                if nxt.count() and nxt.is_visible():
                    b = page.evaluate(JS_TRACK_STATE, sl["index"])
                    nxt.click(timeout=2000)
                    page.wait_for_timeout(1200)
                    a = page.evaluate(JS_TRACK_STATE, sl["index"])
                    sl["nextClick"] = {"before": b, "after": a, "moved": a != b}
            except Exception as e:
                sl["nextClick"] = {"error": str(e)[:200]}
            try:
                page.locator(f'[data-cap-slider="{sl["index"]}"]').screenshot(path=str(shots / f"slider_{sl['index']:02d}.png"))
                sl["screenshot"] = str((shots / f"slider_{sl['index']:02d}.png").relative_to(out_dir))
            except Exception:
                pass
    result["sliders"] = sliders

    # --- lightbox: click first image link inside a gallery-ish container -----------------------
    lb = {"tested": False}
    try:
        base_overlays = page.evaluate(JS_OVERLAYS)
        link = page.locator('[class*="gallery"] a[href], [data-fancybox], [data-lightbox], a[href*="/media/"][href$=".jpg"], a[href*="resize"]').first
        if link.count():
            link.scroll_into_view_if_needed(timeout=3000)
            href_before = page.url
            link.click(timeout=3000)
            page.wait_for_timeout(1200)
            overlays = page.evaluate(JS_OVERLAYS)
            new = [o for o in overlays if o not in base_overlays]
            lb = {"tested": True, "openedOverlay": new[:3], "navigatedAway": page.url != href_before,
                  "waapiOnOpen": safe(page.evaluate, JS_WAAPI, default=[])[:10]}
            page.screenshot(path=str(shots / "lightbox_open.png"))
            lb["screenshot"] = str((shots / "lightbox_open.png").relative_to(out_dir))
            if lb["navigatedAway"]:
                page.go_back()
                page.wait_for_timeout(1000)
            else:
                page.keyboard.press("Escape")
                page.wait_for_timeout(600)
    except Exception as e:
        lb["error"] = str(e)[:200]
    result["lightbox"] = lb

    # --- hover effects (desktop only) ---------------------------------------------------------
    hovers = []
    if not vp["is_mobile"]:
        targets = safe(page.evaluate, JS_HOVER_TARGETS, default=[])
        for t in targets if isinstance(targets, list) else []:
            try:
                loc = page.locator(f'[data-cap-hover="{t["i"]}"]')
                loc.scroll_into_view_if_needed(timeout=2000)
                page.mouse.move(0, 0)
                page.wait_for_timeout(300)
                b = page.evaluate(JS_HOVER_STYLE, t["i"])
                loc.hover(timeout=2000)
                page.wait_for_timeout(700)
                a = page.evaluate(JS_HOVER_STYLE, t["i"])
                delta = {}
                for part in ("self", "img", "overlay"):
                    if b and a and b.get(part) and a.get(part):
                        d = {k: {"from": b[part][k], "to": a[part][k]} for k in b[part] if k != "transition" and b[part][k] != a[part][k]}
                        if d:
                            delta[part] = {"changes": d, "transition": a[part]["transition"]}
                if delta:
                    hovers.append({"el": t["el"], "hoverDelta": delta})
            except Exception:
                continue
    result["hoverEffects"] = hovers

    # --- instrumentation dump --------------------------------------------------------------
    cap = safe(page.evaluate, "() => window.__cap", default={})
    if isinstance(cap, dict):
        muts = cap.get("mutations", [])
        # summarise: which elements had class changes, and the class tokens added
        summary = {}
        for m in muts:
            if m.get("attr") != "class":
                continue
            added = sorted(set((m.get("now") or "").split()) - set((m.get("old") or "").split()))
            if not added:
                continue
            key = m["target"]
            s = summary.setdefault(key, {"addedClasses": set(), "firstAtScrollY": m["scrollY"], "count": 0})
            s["addedClasses"].update(added)
            s["count"] += 1
        result["instrumentation"] = {
            "intersectionObservers": cap.get("io", []),
            "elementAnimateCalls": cap.get("elementAnimate", []),
            "requestAnimationFrameCalls": cap.get("rafCount"),
            "classChangeSummary": [{"el": k, "addedClasses": sorted(v["addedClasses"])[:12], "firstAtScrollY": v["firstAtScrollY"], "count": v["count"]}
                                   for k, v in list(summary.items())[:200]],
            "rawMutationCount": len(muts),
        }

    page.screenshot(path=str(shots / "full_page.png"), full_page=True)
    result["fullPageScreenshot"] = str((shots / "full_page.png").relative_to(out_dir))
    video = page.video
    ctx.close()
    if video:
        try:
            result["video"] = str(Path(video.path()).relative_to(out_dir))
        except Exception:
            pass
    return result


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", action="append", help="Capture only these URL(s); repeatable. Default: Anjum page set.")
    ap.add_argument("--viewports", default="desktop,mobile")
    ap.add_argument("--out", default="anjum_capture")
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--slow", type=int, default=0, help="slow_mo ms")
    ap.add_argument("--timeout", type=int, default=60000)
    ap.add_argument("--scroll-wait", type=int, default=450, help="ms to wait after each scroll step")
    ap.add_argument("--slider-watch", type=float, default=12.0, help="seconds to observe each slider for autoplay")
    ap.add_argument("--max-section-shots", type=int, default=25)
    args = ap.parse_args()

    pages = {f"page_{i}": u for i, u in enumerate(args.url)} if args.url else DEFAULT_PAGES
    out_dir = Path(args.out) / datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed, slow_mo=args.slow)
        for vp in [v.strip() for v in args.viewports.split(",") if v.strip()]:
            for name, url in pages.items():
                try:
                    results.append(capture_page(browser, name, url, vp, out_dir, args))
                except Exception as e:
                    results.append({"page": name, "url": url, "viewport": vp, "error": str(e)[:500]})
        browser.close()

    doc = {"tool": "capture_anjum.py", "generatedAt": datetime.now(timezone.utc).isoformat(), "pages": results}
    out_file = out_dir / "capture.json"
    out_file.write_text(json.dumps(doc, ensure_ascii=False, indent=2, default=list), encoding="utf-8")
    print(f"\nDone → {out_file}")


if __name__ == "__main__":
    sys.exit(main())
