import { chromium, firefox, webkit } from "playwright";
const BASE = process.argv[2] || "https://overhaul-phase-1--deafah.netlify.app";
const OUT = process.argv[3] || ".";
const engines = [["chromium (Chrome)", chromium, { channel: "chrome" }], ["firefox", firefox, {}], ["webkit (Safari engine)", webkit, {}]];
const res = [];
const rec = (b, v, name, ok, d = "") => { res.push({ b, v, name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  [${b} ${v}] ${name}${d ? " — " + d : ""}`); };
for (const [bn, type, launch] of engines) {
  const browser = await type.launch(launch);
  for (const [vn, vp] of [["1440", { viewport: { width: 1440, height: 900 } }], ["390", { viewport: { width: 390, height: 844 }, hasTouch: bn !== "firefox", isMobile: bn !== "firefox" }]]) {
    const ctx = await browser.newContext({ ...vp, locale: "ar-SA" });
    const page = await ctx.newPage(); const errs = [];
    page.on("pageerror", (e) => errs.push("pageerror " + e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await page.goto(BASE + "/index.html", { waitUntil: "load" }); await page.waitForTimeout(1500);
    // theme badge
    await page.click("#themeBadgeChip"); await page.waitForTimeout(300);
    const open = await page.getAttribute("#themeBadgeChip", "aria-expanded");
    await page.click('.theme-badge__swatch[data-palette="green"]'); await page.click('.theme-badge__scheme[data-scheme="dark"]'); await page.waitForTimeout(400);
    const th = await page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.scheme].join("/"));
    rec(bn, vn, "theme badge opens, palette + scheme apply", open === "true" && th === "green/dark", th);
    await page.keyboard.press("Escape");
    await page.screenshot({ path: `${OUT}/${bn.split(" ")[0]}-${vn}-home.png` });
    // dialog
    const opener = vn === "1440" ? '#primaryNav a[data-modal-open="contactModal"]' : 'a.btn[data-modal-open="contactModal"]';
    await page.click(opener); await page.waitForTimeout(500);
    const dOpen = await page.evaluate(() => document.getElementById("contactModal").open);
    await page.keyboard.press("Escape"); await page.waitForTimeout(400);
    const dClosed = await page.evaluate(() => !document.getElementById("contactModal").open);
    rec(bn, vn, "contact dialog opens and closes with Esc", dOpen && dClosed);
    // horizontal scene (desktop only by design; phones get the grid)
    const hz = await page.evaluate(async () => {
      const s = document.querySelector('#hotels[data-scene="horizontal"]'); const t = s.querySelector("[data-track]");
      const y = s.getBoundingClientRect().top + scrollY; window.scrollTo(0, y + 50); await new Promise((r) => setTimeout(r, 400));
      const a = getComputedStyle(t).transform; window.scrollTo(0, y + 700); await new Promise((r) => setTimeout(r, 1200));
      return { on: s.classList.contains("is-horizontal"), moved: a !== getComputedStyle(t).transform, b: getComputedStyle(t).transform.slice(0, 40) };
    });
    rec(bn, vn, vn === "1440" ? "horizontal hotel scene pins and moves" : "horizontal scene falls back to the grid on phones", vn === "1440" ? hz.on && hz.moved : !hz.on, JSON.stringify(hz));
    rec(bn, vn, "no console errors on home", errs.length === 0, errs.slice(0, 2).join(" | "));
    // 3D + fallback
    const p2 = await ctx.newPage(); const e2 = []; p2.on("pageerror", (e) => e2.push(e.message));
    await p2.goto(BASE + "/hotels/taj-park.html", { waitUntil: "load" }); await p2.waitForTimeout(1500);
    if (vn === "390" && bn !== "firefox") await p2.touchscreen.tap(200, 600); else await p2.mouse.wheel(0, 300);
    await p2.evaluate(() => window.scrollBy(0, 300)); await p2.waitForTimeout(6000);
    const st = await p2.evaluate(() => { const s = document.querySelector(".tp3d"); return { state: s.getAttribute("data-3d"), reason: s.getAttribute("data-3d-reason"), poster: getComputedStyle(s.querySelector(".tp3d__poster")).opacity }; });
    rec(bn, vn, "3D scene goes live, or shows the poster with a reason", st.state === "live" || (st.state === "poster" && st.reason), JSON.stringify(st));
    await p2.screenshot({ path: `${OUT}/${bn.split(" ")[0]}-${vn}-hotel.png` });
    const ctxR = await browser.newContext({ ...vp, reducedMotion: "reduce" }); const p3 = await ctxR.newPage();
    await p3.goto(BASE + "/hotels/taj-park.html", { waitUntil: "load" }); await p3.waitForTimeout(1500);
    const st3 = await p3.evaluate(() => { const s = document.querySelector(".tp3d"); return s.getAttribute("data-3d") + "/" + s.getAttribute("data-3d-reason"); });
    rec(bn, vn, "reduced motion: 3D stays on the poster", st3 === "poster/reduced-motion", st3);
    rec(bn, vn, "no page errors on the hotel page", e2.length === 0, e2.slice(0, 2).join(" | "));
    await ctxR.close(); await ctx.close();
  }
  await browser.close();
}
const f = res.filter((r) => !r.ok).length; console.log(`\n${res.length - f}/${res.length} cross-browser checks passed`); console.log("JSON " + JSON.stringify(res));
