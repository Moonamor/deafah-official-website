#!/usr/bin/env python3
"""
capture_menu.py — live measurement of the anjumhotels.com mobile menu at 390 px (MOTION_SPEC rows M1–M4).

The menu is CSS-driven: label.menu-button toggles input#main_menu_checkbox, the panel is nav.nav-level-0 (fixed),
each submenu ul.sub-menu starts at height 0 and opens when its li gets .open. Because the motion may live in
position/size properties, this sampler records opacity, transform, visibility, display, bounding box, height and
max-height every 10 ms after each explicit tap: open menu → open first submenu → close submenu → close menu.

Usage: python reference/anjum/capture_menu.py --out reference/anjum/capture     (writes <out>/menu-<ts>/menu.json + PNGs)
"""
import argparse, json, re
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
from capture_targeted import EASINGS, VIEWPORTS, dismiss, settle

SAMPLER = r"""() => {
window.__msample = (sels, ms) => new Promise((res) => {
  const t0 = performance.now(), rows = [];
  const f = () => {
    const t = performance.now() - t0;
    rows.push([Math.round(t), ...sels.map((s) => { const e = document.querySelector(s); if (!e) return null;
      const c = getComputedStyle(e), r = e.getBoundingClientRect(), m = c.transform.match(/matrix\(([^)]+)\)/), p = m ? m[1].split(',').map(Number) : [1, 0, 0, 1, 0, 0];
      return { opacity: +c.opacity, tx: p[4], ty: p[5], scale: p[0], x: r.left, y: r.top, w: r.width, h: r.height,
               visible: c.visibility !== 'hidden' && c.display !== 'none' ? 1 : 0, cls: String(e.className) }; })]);
    if (t < ms) setTimeout(f, 10); else res(rows);
  };
  f();
}); }"""

FIELDS = ("opacity", "tx", "ty", "scale", "x", "y", "w", "h", "visible")


def analyse(rows, col):
    """per field: from, to, start, duration and closest easing; only fields that changed"""
    out = {}
    for f in FIELDS:
        vals = [(r[0], r[col][f]) for r in rows if r[col] is not None]
        if len(vals) < 3:
            continue
        ch = [i for i in range(1, len(vals)) if abs(vals[i][1] - vals[i - 1][1]) > 0.5 or (f in ("opacity", "scale", "visible") and abs(vals[i][1] - vals[i - 1][1]) > 1e-3)]
        if not ch:
            continue
        i0, i1 = ch[0] - 1, ch[-1]
        (t0, v0), (t1, v1) = vals[i0], vals[i1]
        d = {"from": round(v0, 3), "to": round(v1, 3), "startMs": t0, "durationMs": t1 - t0}
        if t1 > t0 and abs(v1 - v0) > 1e-6 and len(range(i0, i1 + 1)) > 3:
            pts = [((t - t0) / (t1 - t0), (v - v0) / (v1 - v0)) for t, v in vals[i0:i1 + 1]]
            err = {n: round(sum((fn(p) - y) ** 2 for p, y in pts) / len(pts), 5) for n, fn in EASINGS.items()}
            d["easingFit"] = sorted(err.items(), key=lambda kv: kv[1])[:3]
        out[f] = d
    classes = sorted({r[col]["cls"] for r in rows if r[col] is not None})
    if len(classes) > 1:
        out["classStates"] = classes
    return out


def run(page, sels, ms, trigger, retry=True):
    try:
        page.evaluate(SAMPLER)
        page.evaluate(f"() => {{ window.__mrows = null; window.__msample({json.dumps(sels)}, {ms}).then((r) => {{ window.__mrows = r; }}); }}")
        trigger()
        page.wait_for_function("() => Array.isArray(window.__mrows)", timeout=ms + 15000, polling=100)
        rows = page.evaluate("() => window.__mrows")
    except Exception:
        if not retry:
            raise
        settle(page); page.evaluate("window.scrollTo(0, 0)"); page.wait_for_timeout(500)
        return run(page, sels, ms, trigger, retry=False)
    return {s: analyse(rows, i + 1) for i, s in enumerate(sels)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="reference/anjum/capture")
    ap.add_argument("--url", default="https://anjumhotels.com/ar/")
    a = ap.parse_args()
    out = Path(a.out) / ("menu-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
    out.mkdir(parents=True, exist_ok=True)
    R = {"tool": "capture_menu.py", "generatedAt": datetime.now(timezone.utc).isoformat(), "url": a.url, "viewport": "mobile 390x844"}
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(**VIEWPORTS["mobile"], locale="ar-SA", reduced_motion="no-preference")
        page = ctx.new_page()
        page.goto(a.url, wait_until="domcontentloaded", timeout=60000)
        try: page.wait_for_load_state("networkidle", timeout=15000)
        except Exception: pass
        R["cookieDismissedWith"] = dismiss(page); settle(page); page.wait_for_timeout(3000); settle(page)
        page.evaluate("window.scrollTo(0, 0)"); page.wait_for_timeout(500)
        page.screenshot(path=str(out / "m0_closed.png"))
        panel = ["nav.nav-level-0", "label.menu-button .menu-icon", "label.menu-button .menu-span", ".nav-level-0 .main-menu-item:nth-child(1)"]
        R["M1_open"] = run(page, panel, 1500, lambda: page.locator("label.menu-button").first.tap())
        R["M1_state"] = page.evaluate("""() => ({ checked: document.getElementById('main_menu_checkbox').checked,
            bodyOverflow: getComputedStyle(document.body).overflow, htmlOverflow: getComputedStyle(document.documentElement).overflow,
            panel: (() => { const n = document.querySelector('nav.nav-level-0'), r = n.getBoundingClientRect(), c = getComputedStyle(n); return { x: r.left, y: r.top, w: r.width, h: r.height, bg: c.backgroundColor, z: c.zIndex }; })(),
            items: [...document.querySelectorAll('.nav-level-0 .main-menu-item')].map(li => li.querySelector('.main-menu-item-name').innerText.trim()),
            focus: document.activeElement && (document.activeElement.tagName + '.' + document.activeElement.className),
            ariaOnToggle: [...document.querySelector('label.menu-button').attributes].map(x => x.name).filter(n => n.startsWith('aria')) })""")
        page.screenshot(path=str(out / "m1_open.png"))
        first = page.locator(".nav-level-0 .main-menu-item:not(.menu-single) .main-menu-item-name").first
        R["M2_submenu_open"] = run(page, [".nav-level-0 .main-menu-item:not(.menu-single) .sub-menu", ".nav-level-0 .main-menu-item:not(.menu-single)",
                                          ".nav-level-0 .main-menu-item:not(.menu-single) ~ .main-menu-item"], 1500, lambda: first.tap())
        R["M2_state"] = page.evaluate("""() => { const li = document.querySelector('.nav-level-0 .main-menu-item:not(.menu-single)'), ul = li.querySelector('.sub-menu');
            return { liClass: li.className, subHeight: ul.getBoundingClientRect().height, subItems: [...ul.querySelectorAll('a')].map(x => x.innerText.trim()).slice(0, 8) }; }""")
        page.screenshot(path=str(out / "m2_submenu_open.png"))
        R["M2_visibleControls"] = page.evaluate("""() => [...document.querySelectorAll('.nav-level-0 *')].filter(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e);
            return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && (e.tagName === 'LABEL' || e.tagName === 'BUTTON' || /back|close|zur|prev|return/i.test(e.className)); })
            .map(e => ({ tag: e.tagName, cls: String(e.className).slice(0, 60), txt: (e.innerText || '').trim().slice(0, 30), box: [Math.round(e.getBoundingClientRect().left), Math.round(e.getBoundingClientRect().top)] })).slice(0, 12)""")
        back = page.locator(".nav-level-0 .main-menu-item.open [class*=back], .nav-level-0 [class*=back]:visible, .nav-level-0 .main-menu-item.open > .main-menu-item-name").first
        try:
            R["M3_submenu_close"] = run(page, [".nav-level-0 .main-menu-item:not(.menu-single) .sub-menu", ".nav-level-0 .main-menu-item:not(.menu-single)"], 1500,
                                        lambda: first.tap(force=True, timeout=4000), retry=False)
            R["M3_closedWith"] = "forced tap on the open item's heading (no back control exists)"
        except Exception as e:
            R["M3_submenu_close"] = None
            R["M3_closedWith"] = "UNMEASURED: no tappable back/close control in the open submenu (" + str(e).splitlines()[0][:120] + ")"
        page.screenshot(path=str(out / "m3_after_submenu_close.png"))
        state = lambda: page.evaluate("() => ({ menuOpen: document.getElementById('main_menu_checkbox').checked, submenuOpen: !!document.querySelector('.nav-level-0 .main-menu-item.open') })")
        R["M3_stateAfter"] = state()
        if not R["M3_stateAfter"]["menuOpen"]:   # a late reload closed it: reopen so M4 really measures a close
            page.locator("label.menu-button").first.tap(); page.wait_for_timeout(800)
        R["M4_stateBefore"] = state()
        R["M4_close"] = run(page, panel, 1500, lambda: page.locator("label.menu-button").first.tap(force=True))
        R["M4_state"] = page.evaluate("() => ({ checked: document.getElementById('main_menu_checkbox').checked, focus: document.activeElement && document.activeElement.tagName, bodyOverflow: getComputedStyle(document.body).overflow })")
        page.screenshot(path=str(out / "m4_closed.png"))
        page.locator("label.menu-button").first.tap(force=True); page.wait_for_timeout(900)
        before = state()
        nav_count = [0]; page.on("framenavigated", lambda f: nav_count.__setitem__(0, nav_count[0] + 1) if f == page.main_frame else None)
        page.keyboard.press("Escape"); page.wait_for_timeout(900)
        R["escapeTest"] = {"before": before, "after": state(), "reloadsDuringTest": nav_count[0]}
        b.close()
    (out / "menu.json").write_text(json.dumps(R, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Done →", out / "menu.json")


if __name__ == "__main__":
    main()
