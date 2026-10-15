// Screenshot + console audit via the Chrome DevTools Protocol (no extra packages; Node ≥ 22 has WebSocket).
// Usage: node tools/shoot.mjs --url http://127.0.0.1:8787/index.html --out shots/x.png [--width 1440] [--scheme dark] [--palette green] [--lang en] [--reduced] [--eval "expr"]
//        node tools/shoot.mjs --matrix shots/   (every page × 8 theme/scheme combos × 390/1440)
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
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
const chrome = spawn(CHROME, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
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
async function shootInner({ url, out, width = 1440, scheme = "light", palette = "default", lang = "ar", reduced = false, evalExpr, block, nojs }) {
  const { cdp, id } = await openTab(); log("tab open");
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Log.enable"); await cdp.send("Network.enable");
  if (block) { await cdp.send("Network.setBlockedURLs", { urls: String(block).split(",").map((b) => "*" + b.trim() + "*") }); log("blocking", block); }
  if (nojs) await cdp.send("Emulation.setScriptExecutionDisabled", { value: true });
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: +width, height: 900, deviceScaleFactor: 1, mobile: +width < 700 });
  if (reduced) await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("deafah-theme",${JSON.stringify(scheme)});localStorage.setItem("deafah-theme-mode","manual");localStorage.setItem("deafah-theme-last-check",String(Date.now()));localStorage.setItem("deafah-palette",${JSON.stringify(palette)});localStorage.setItem("deafah-lang",${JSON.stringify(lang)});}catch(e){}` });
  log("navigate"); await cdp.send("Page.navigate", { url });
  const t0 = Date.now(); while (!cdp.events.some((e) => e.method === "Page.loadEventFired") && Date.now() - t0 < 15000) await sleep(100);
  log("loaded in", Date.now() - t0, "ms"); await sleep(600);
  try { const q = await cdp.send("Runtime.evaluate", { expression: "document.readyState + ' h=' + document.documentElement.scrollHeight + ' text=' + document.body.innerText.length", returnByValue: true, timeout: 5000 }); log("state", q.result.value); } catch (e) { log("state eval failed:", e.message); }
  try { const pre = await cdp.send("Page.captureScreenshot", { format: "png" }); if (out) { mkdirSync(join(out, ".."), { recursive: true }); writeFileSync(out.replace(/\.png$/, "-viewport.png"), Buffer.from(pre.data, "base64")); } log("viewport shot saved"); } catch (e) { log("viewport shot failed:", e.message); }
  // scroll through the page so reveal/scroll-triggered content is in its final state, then back to top
  log("scroll"); await cdp.send("Runtime.evaluate", { expression: `(async()=>{const h=document.documentElement.scrollHeight;for(let y=0;y<h;y+=500){window.scrollTo({top:y,behavior:"instant"});await new Promise(r=>setTimeout(r,80));}window.scrollTo({top:0,behavior:"instant"});})()`, awaitPromise: true, timeout: 10000 }); log("scrolled");
  await sleep(900);
  log("inspect"); const info = (await cdp.send("Runtime.evaluate", { expression: `JSON.stringify({html: document.documentElement.outerHTML.slice(0,0), attrs: {lang: document.documentElement.lang, dir: document.documentElement.dir, scheme: document.documentElement.dataset.scheme, theme: document.documentElement.dataset.theme}, height: document.documentElement.scrollHeight, logos: [...document.querySelectorAll('[data-logo]')].map(e=>({lockup:e.dataset.logoLockup,file:e.dataset.logoFile,w:e.querySelector('img')?.getBoundingClientRect().width|0, h:e.querySelector('img')?.getBoundingClientRect().height|0, loaded: !!(e.querySelector('img')?.complete && e.querySelector('img')?.naturalWidth)})), hotels: document.querySelectorAll('.hotel-card').length, kufic: [...document.querySelectorAll('[data-kufic]')].map(e=>e.dataset.kuficCount||'-'), fonts: [...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family+' '+f.weight), bodyBg: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.body).color ${evalExpr ? `, extra: (${evalExpr})` : ""}})`, returnByValue: true })).result.value;
  const data = JSON.parse(info);
  const height = Math.min(data.height, 8000);
  log("capture"); const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: +width, height, scale: 1 } });
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
    const r = await shoot({ url: args.url, out: args.out, width: args.width, scheme: args.scheme, palette: args.palette, lang: args.lang, reduced: !!args.reduced, evalExpr: args.eval, block: args.block, nojs: !!args.nojs });
    console.log(JSON.stringify(r, null, 2));
  }
} catch (e) { console.error("shoot failed:", e.message); process.exitCode = 1; }
finally { try { if (process.platform === "win32") spawn("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" }); else chrome.kill(); } catch {} }
