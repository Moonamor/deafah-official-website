// Screenshot + console audit via the Chrome DevTools Protocol (no extra packages; Node ≥ 22 has WebSocket).
// Usage: node tools/shoot.mjs --url http://127.0.0.1:8787/index.html --out shots/x.png [--width 1440] [--scheme dark] [--palette green] [--lang en] [--reduced] [--eval "expr"]
//        node tools/shoot.mjs --matrix shots/   (every page × 8 theme/scheme combos × 390/1440)
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import http from "node:http";

// never route 127.0.0.1 through an environment proxy
for (const k of Object.keys(process.env)) if (/^(https?_proxy|all_proxy|no_proxy)$/i.test(k)) delete process.env[k];
process.env.NO_PROXY = "127.0.0.1,localhost";
const httpJson = (url, method = "GET") => new Promise((res, rej) => { const r = http.request(url, { method, timeout: 3000 }, (m) => { let b = ""; m.on("data", (c) => (b += c)); m.on("end", () => { try { res(JSON.parse(b || "null")); } catch (e) { res(null); } }); }); r.on("error", rej); r.on("timeout", () => { r.destroy(new Error("timeout")); }); r.end(); });

const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = Number(process.env.CDP_PORT) || 9333 + Math.floor(Math.random() * 200);
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith("--") ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true] : []).filter(Boolean));
const BASE = args.base || "http://127.0.0.1:8787";

const profile = join(process.env.TEMP || ".", "deafah-cdp-" + PORT);
const chrome = spawn(CHROME, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-extensions"].concat(process.env.SHOOT_GPU ? [] : ["--disable-gpu"]).concat(["--hide-scrollbars", "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile, "about:blank"]), { stdio: "ignore" });
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ready() { for (let i = 0; i < 60; i++) { try { const v = await httpJson(`http://127.0.0.1:${PORT}/json/version`); if (v && v.Browser) return v; } catch {} await sleep(250); } throw new Error("chrome did not start"); }

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && this.pending.has(d.id)) { const { res, rej } = this.pending.get(d.id); this.pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } else if (d.method) this.events.push(d); }; }
  send(method, params = {}) { return new Promise((res, rej) => { const id = ++this.id; const t = setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error("CDP timeout: " + method)); } }, 20000); this.pending.set(id, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
async function openTab() {
  const t = await httpJson(`http://127.0.0.1:${PORT}/json/new?about:blank`, "PUT");
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((res) => (ws.onopen = res));
  return { cdp: new CDP(ws), id: t.id };
}

async function shoot(opts) { log("shoot", opts.url, opts.width, opts.scheme, opts.palette); return shootInner(opts); }
async function clickSelector(cdp, selector) {
  const r = await cdp.send("Runtime.evaluate", { returnByValue: true, expression: `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; e.scrollIntoView({ block: "center", behavior: "instant" }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()` });
  const pt = r.result.value; if (!pt) throw new Error("no element " + selector);
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await cdp.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", clickCount: 1 });
}
const PREPAINT_RECORDER = `(() => { const t = { injected: performance.now(), attr: null, firstFrame: null, firstFrameBg: null, firstFrameAttrs: null };
  const mo = new MutationObserver(() => { const h = document.documentElement; if (t.attr === null && h && h.hasAttribute("data-scheme")) { t.attr = performance.now(); mo.disconnect(); } });
  mo.observe(document, { attributes: true, subtree: true, childList: true }); /* the injected script runs before <html> exists */
  requestAnimationFrame(() => { t.firstFrame = performance.now(); t.firstFrameAttrs = { scheme: document.documentElement.dataset.scheme, theme: document.documentElement.dataset.theme, lang: document.documentElement.lang, dir: document.documentElement.dir }; t.firstFrameBg = document.body ? getComputedStyle(document.body).backgroundColor : null; });
  window.__prepaint = t; })()`;

async function shootInner(opts) {
  var { url, out, width = 1440, scheme = "light", palette = "default", lang = "ar", reduced = false, evalExpr, block, nojs } = opts;
  const { cdp, id } = await openTab(); log("tab open");
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Log.enable"); await cdp.send("Network.enable");
  if (block) { await cdp.send("Network.setBlockedURLs", { urls: String(block).split(",").map((b) => "*" + b.trim() + "*") }); log("blocking", block); }
  if (nojs) await cdp.send("Emulation.setScriptExecutionDisabled", { value: true });
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: +width, height: 900, deviceScaleFactor: 1, mobile: +width < 700 });
  if (reduced) await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  if (opts.cpu) { await cdp.send("Emulation.setCPUThrottlingRate", { rate: +opts.cpu }); log("cpu throttle", opts.cpu + "x"); }
  if (opts.prepaint) await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: PREPAINT_RECORDER });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("deafah-theme",${JSON.stringify(scheme)});localStorage.setItem("deafah-theme-mode","manual");localStorage.setItem("deafah-theme-last-check",String(Date.now()));localStorage.setItem("deafah-palette",${JSON.stringify(palette)});localStorage.setItem("deafah-lang",${JSON.stringify(lang)});}catch(e){}` });
  log("navigate"); await cdp.send("Page.navigate", { url });
  const t0 = Date.now(); while (!cdp.events.some((e) => e.method === "Page.loadEventFired") && Date.now() - t0 < 15000) await sleep(100);
  log("loaded in", Date.now() - t0, "ms"); await sleep(600);
  try { const q = await cdp.send("Runtime.evaluate", { expression: "document.readyState + ' h=' + document.documentElement.scrollHeight + ' text=' + document.body.innerText.length", returnByValue: true, timeout: 5000 }); log("state", q.result.value); } catch (e) { log("state eval failed:", e.message); }
  if (opts && opts.prepaint) {
    const r = await cdp.send("Runtime.evaluate", { returnByValue: true, expression: `(() => { const t = window.__prepaint || {}; const paints = performance.getEntriesByType("paint").map((p) => ({ name: p.name, t: +p.startTime.toFixed(1) })); return JSON.stringify({ attrSetAt: t.attr === null ? null : +t.attr.toFixed(1), injectedAt: +t.injected.toFixed(1), firstFrameAt: t.firstFrame === null ? null : +t.firstFrame.toFixed(1), firstFrameAttrs: t.firstFrameAttrs, firstFrameBodyBg: t.firstFrameBg, paints, finalBodyBg: getComputedStyle(document.body).backgroundColor, finalAttrs: { scheme: document.documentElement.dataset.scheme, theme: document.documentElement.dataset.theme } }); })()` });
    const data = JSON.parse(r.result.value);
    await httpJson(`http://127.0.0.1:${PORT}/json/close/${id}`).catch(() => {});
    return data;
  }
  if (opts && opts.cls) {
    log("cls run (real input events)");
    await cdp.send("Runtime.evaluate", { expression: `window.__cls = { std: 0, raw: 0 }; new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__cls.raw += e.value; if (!e.hadRecentInput) window.__cls.std += e.value; } }).observe({ type: "layout-shift", buffered: false });` });
    const box = () => cdp.send("Runtime.evaluate", { returnByValue: true, expression: `JSON.stringify([...document.querySelectorAll("[data-logo]")].map((e) => { const r = e.getBoundingClientRect(); return { file: e.dataset.logoFile, box: e.dataset.logoBox, x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) }; }))` }).then((r) => JSON.parse(r.result.value));
    const read = () => cdp.send("Runtime.evaluate", { returnByValue: true, expression: `JSON.stringify(window.__cls)` }).then((r) => JSON.parse(r.result.value));
    const reset = () => cdp.send("Runtime.evaluate", { expression: `window.__cls.std = 0; window.__cls.raw = 0;` });
    const steps = [];
    async function step(name, act) { await reset(); const before = await box(); await act(); await sleep(800); const c = await read(); steps.push({ name, cls: +c.std.toFixed(4), rawShift: +c.raw.toFixed(4), before, after: await box() }); log(name, "cls", c.std.toFixed(4), "raw", c.raw.toFixed(4)); }
    await sleep(300);
    await step("header toggle: scheme → dark", () => clickSelector(cdp, "#themeToggle"));
    await step("header toggle: scheme → light", () => clickSelector(cdp, "#themeToggle"));
    await step("badge: open", () => clickSelector(cdp, "#themeBadgeChip"));
    for (const p of ["green", "red", "blue", "default"]) await step("badge: palette → " + p, () => clickSelector(cdp, `[data-palette="${p}"]`));
    await step("badge: scheme → dark", () => clickSelector(cdp, '[data-scheme="dark"]'));
    await step("badge: scheme → auto", () => clickSelector(cdp, '[data-scheme="auto"]'));
    await step("badge: close (Esc)", async () => { await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); });
    await step("header toggle: lang → en", () => clickSelector(cdp, "#langToggle"));
    await step("header toggle: lang → ar", () => clickSelector(cdp, "#langToggle"));
    await step("scroll 400 px (condensed header)", () => cdp.send("Runtime.evaluate", { expression: `window.scrollTo({ top: 400, behavior: "instant" })` }));
    const data = { steps, totalCls: +steps.reduce((a, b) => a + b.cls, 0).toFixed(4), totalRaw: +steps.reduce((a, b) => a + b.rawShift, 0).toFixed(4) };
    await httpJson(`http://127.0.0.1:${PORT}/json/close/${id}`).catch(() => {});
    return data;
  }
  if (!opts.viewport) {
    log("scroll"); await cdp.send("Runtime.evaluate", { expression: `(async()=>{const h=document.documentElement.scrollHeight;for(let y=0;y<h;y+=500){window.scrollTo({top:y,behavior:"instant"});await new Promise(r=>setTimeout(r,80));}window.scrollTo({top:0,behavior:"instant"});})()`, awaitPromise: true, timeout: 10000 }); log("scrolled");
    await sleep(900);
  }
  if (opts && opts.openBadge) { await clickSelector(cdp, "#themeBadgeChip"); await sleep(400); log("badge opened"); }
  if (opts && opts.scroll) {
    const target = /^\d+$/.test(String(opts.scroll)) ? +opts.scroll : null;
    await cdp.send("Runtime.evaluate", { expression: target !== null ? `window.scrollTo({ top: ${target}, behavior: "instant" })` : `(() => { const e = document.querySelector(${JSON.stringify(String(opts.scroll))}); const y = e ? e.getBoundingClientRect().top + window.scrollY + ${+(opts.scrollOffset || 0)} : 0; window.scrollTo({ top: y, behavior: "instant" }); })()` });
    await sleep(1600); log("scrolled to", opts.scroll, opts.scrollOffset || 0);
  }
  if (opts && opts.wiggle) {
    log("wiggle: pointer + scroll activity for 2.5 s");
    for (let i = 0; i < 50; i++) { await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 200 + (i % 10) * 90, y: 150 + (i % 7) * 80 }); if (i % 10 === 9) await cdp.send("Runtime.evaluate", { expression: `window.scrollBy({ top: ${i % 20 === 19 ? -120 : 60}, behavior: "instant" })` }); await sleep(50); }
    await sleep(300);
  }
  let asyncExtra = null;
  if (evalExpr && /^\s*\(async/.test(evalExpr)) { const r = await cdp.send("Runtime.evaluate", { expression: evalExpr, awaitPromise: true, returnByValue: true, timeout: 20000 }); asyncExtra = r.result.value; evalExpr = null; log("async eval done"); }
  log("inspect"); const info = (await cdp.send("Runtime.evaluate", { expression: `JSON.stringify({html: document.documentElement.outerHTML.slice(0,0), attrs: {lang: document.documentElement.lang, dir: document.documentElement.dir, scheme: document.documentElement.dataset.scheme, theme: document.documentElement.dataset.theme}, height: document.documentElement.scrollHeight, logos: [...document.querySelectorAll('[data-logo]')].map(e=>({lockup:e.dataset.logoLockup,file:e.dataset.logoFile,w:e.querySelector('img')?.getBoundingClientRect().width|0, h:e.querySelector('img')?.getBoundingClientRect().height|0, loaded: !!(e.querySelector('img')?.complete && e.querySelector('img')?.naturalWidth)})), hotels: document.querySelectorAll('.hotel-card').length, kufic: [...document.querySelectorAll('[data-kufic]')].map(e=>e.dataset.kuficCount||'-'), fonts: [...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family+' '+f.weight), bodyBg: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.body).color ${evalExpr ? `, extra: (${evalExpr})` : ""}})`, returnByValue: true })).result.value;
  const data = JSON.parse(info); if (asyncExtra !== null) data.extra = asyncExtra;
  const height = opts.viewport ? 900 : Math.min(data.height, 8000);
  log("capture"); const shot = await cdp.send("Page.captureScreenshot", opts.viewport ? { format: "png" } : { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: +width, height, scale: 1 } });
  if (out) { mkdirSync(join(out, ".."), { recursive: true }); writeFileSync(out, Buffer.from(shot.data, "base64")); }
  const console_ = cdp.events.filter((e) => ["Runtime.consoleAPICalled", "Runtime.exceptionThrown", "Log.entryAdded"].includes(e.method)).map((e) => e.method === "Runtime.exceptionThrown" ? "EXCEPTION " + (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text) : e.method === "Log.entryAdded" ? `${e.params.entry.level.toUpperCase()} ${e.params.entry.text} ${e.params.entry.url || ""}` : `${e.params.type} ${e.params.args.map((a) => a.value ?? a.description).join(" ")}`);
  await httpJson(`http://127.0.0.1:${PORT}/json/close/${id}`).catch(() => {});
  return { ...data, console: console_ };
}

try {
  log("chrome pid", chrome.pid, "port", PORT); await ready(); log("devtools ready");
  if (args.matrix) {
    const pages = (args.pages || "index.html,about.html").split(",");
    const results = [];
    for (const page of pages) for (const palette of ["default", "green", "red", "blue"]) for (const scheme of ["light", "dark"]) for (const width of [390, 1440]) {
      const name = `${page.replace(/\.html$/, "").replace(/\//g, "_")}-${palette}-${scheme}-${width}.png`;
      const r = await shoot({ url: `${BASE}/${page}`, out: join(args.matrix, name), width, scheme, palette, lang: args.lang || "ar" });
      results.push({ page, palette, scheme, width, name, console: r.console, logos: r.logos, hotels: r.hotels });
      console.log(name, "console:", r.console.length, "logos:", r.logos.map((l) => l.file).join(","));
    }
    writeFileSync(join(args.matrix, "matrix.json"), JSON.stringify(results, null, 2));
  } else {
    const r = await shoot({ url: args.url, out: args.out, width: args.width, scheme: args.scheme, palette: args.palette, lang: args.lang, reduced: !!args.reduced, evalExpr: args["eval-file"] ? readFileSync(args["eval-file"], "utf8").trim() : args.eval, block: args.block, nojs: !!args.nojs, cls: !!args.cls, prepaint: !!args.prepaint, openBadge: !!args["open-badge"], viewport: !!args.viewport, cpu: args.cpu, scroll: args.scroll, scrollOffset: args["scroll-offset"], wiggle: !!args.wiggle });
    console.log(JSON.stringify(r, null, 2));
  }
} catch (e) { console.error("shoot failed:", e.message); process.exitCode = 1; }
finally { try { if (process.platform === "win32") spawn("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" }); else chrome.kill(); } catch {} }
