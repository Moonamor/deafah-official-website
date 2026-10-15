// Keyboard-only walkthrough via the Chrome DevTools Protocol: real key events, no mouse.
// Covers: tab order head, theme badge (open / arrows / select / Esc), mobile nav (open / Esc), FAQ (Enter / Space),
// contact dialog (open / focus trapped / Esc returns focus), phone input (open list / type / ArrowDown / Enter).
// Usage: node tools/qa-keyboard.mjs [--base http://127.0.0.1:8787] [--lang ar|en]   (launch from PowerShell on Windows)
import { spawn } from "node:child_process";
import { join } from "node:path";
import http from "node:http";

for (const k of Object.keys(process.env)) if (/^(https?_proxy|all_proxy|no_proxy)$/i.test(k)) delete process.env[k];
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith("--") ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true] : []).filter(Boolean));
const BASE = args.base || "http://127.0.0.1:8787", LANG = args.lang || "ar";
const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = Number(process.env.CDP_PORT) || 9600 + Math.floor(Math.random() * 200);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const httpJson = (url, method = "GET") => new Promise((res, rej) => { const r = http.request(url, { method, timeout: 3000 }, (m) => { let b = ""; m.on("data", (c) => (b += c)); m.on("end", () => { try { res(JSON.parse(b || "null")); } catch { res(null); } }); }); r.on("error", rej); r.on("timeout", () => r.destroy(new Error("timeout"))); r.end(); });
const chrome = spawn(CHROME, ["--headless=new", "--no-first-run", "--disable-extensions", "--disable-gpu", "--remote-debugging-port=" + PORT, "--user-data-dir=" + join(process.env.TEMP || ".", "deafah-kbd-" + PORT), "about:blank"], { stdio: "ignore" });

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map(); this.errors = []; ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && this.p.has(d.id)) { const { res, rej } = this.p.get(d.id); this.p.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } else if (d.method === "Runtime.exceptionThrown") this.errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text); else if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") this.errors.push(d.params.args.map((a) => a.value || a.description).join(" ")); }; }
  send(method, params = {}) { return new Promise((res, rej) => { const id = ++this.id; this.p.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
const KEYS = { Tab: 9, Enter: 13, " ": 32, Escape: 27, ArrowRight: 39, ArrowLeft: 37, ArrowDown: 40, ArrowUp: 38, Home: 36, End: 35 };
async function key(cdp, k, shift = false) {
  const base = { key: k, code: k === " " ? "Space" : k, windowsVirtualKeyCode: KEYS[k], nativeVirtualKeyCode: KEYS[k], modifiers: shift ? 8 : 0 };
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base });
  if (k === "Enter" || k === " ") await cdp.send("Input.dispatchKeyEvent", { type: "char", ...base, text: k === "Enter" ? "\r" : " " });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...base }); await sleep(120);
}
const ev = async (cdp, expr) => (await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
const ACTIVE = `(() => { const a = document.activeElement; if (!a || a === document.body) return "body"; return a.tagName.toLowerCase() + (a.id ? "#" + a.id : "") + (a.className && typeof a.className === "string" ? "." + a.className.trim().split(/\\s+/).slice(0, 2).join(".") : "") + " «" + (a.getAttribute("aria-label") || a.innerText || a.value || "").trim().replace(/\\s+/g, " ").slice(0, 28) + "»"; })()`;
async function tabTo(cdp, test, max = 120) { for (let i = 1; i <= max; i++) { await key(cdp, "Tab"); if (await ev(cdp, `(() => { const a = document.activeElement; return !!a && (${test})(a); })()`)) return i; } return -1; }

async function page(path, width) {
  const t = await httpJson(`http://127.0.0.1:${PORT}/json/new?about:blank`, "PUT");
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  const cdp = new CDP(ws); await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 700 });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("deafah-lang",${JSON.stringify(LANG)});localStorage.setItem("deafah-theme","light");localStorage.setItem("deafah-theme-mode","manual");localStorage.setItem("deafah-theme-last-check",String(Date.now()));}catch(e){}` });
  await cdp.send("Page.navigate", { url: `${BASE}/${path}` }); await sleep(2500);
  return { cdp, close: () => httpJson(`http://127.0.0.1:${PORT}/json/close/${t.id}`).catch(() => {}) };
}

const results = []; const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
try {
  for (let i = 0; i < 60; i++) { try { if ((await httpJson(`http://127.0.0.1:${PORT}/json/version`))?.Browser) break; } catch {} await sleep(250); }

  /* 1. home, desktop: tab order head, badge, dialog, phone input */
  { const { cdp, close } = await page("index.html", 1440);
    const order = []; for (let i = 0; i < 12; i++) { await key(cdp, "Tab"); order.push(await ev(cdp, ACTIVE)); }
    check("tab order starts with skip link, then logo and nav", /sr-only/.test(order[0]) && /brand-logo/.test(order[1]) && order.some((o) => /nav-link/.test(o)), order.slice(0, 6).join(" → "));
    const visible = await ev(cdp, `getComputedStyle(document.activeElement, ":focus-visible") && (getComputedStyle(document.activeElement).outlineStyle !== "none" || getComputedStyle(document.activeElement).boxShadow !== "none")`);
    check("focused element shows a visible focus ring", visible);
    const n = await tabTo(cdp, `(a) => a.id === "themeBadgeChip"`);
    check("theme badge chip reachable by Tab", n > 0, `${n} more Tab presses`);
    await key(cdp, "Enter");
    check("Enter opens the badge panel and moves focus inside", await ev(cdp, `document.getElementById("themeBadgeChip").getAttribute("aria-expanded") === "true" && document.getElementById("themeBadgePanel").contains(document.activeElement)`), await ev(cdp, ACTIVE));
    const before = await ev(cdp, `document.documentElement.dataset.theme`);
    await key(cdp, LANG === "ar" ? "ArrowLeft" : "ArrowRight"); const moved = await ev(cdp, ACTIVE); await key(cdp, "Enter");
    const after = await ev(cdp, `document.documentElement.dataset.theme`);
    check("arrow key moves between swatches, Enter applies the palette", before !== after, `${before} → ${after} via ${moved}`);
    await key(cdp, "Escape");
    check("Esc closes the badge and returns focus to the chip", await ev(cdp, `document.getElementById("themeBadgeChip").getAttribute("aria-expanded") === "false" && document.activeElement.id === "themeBadgeChip"`));
    await ev(cdp, `document.activeElement.blur(), window.scrollTo(0, 0), true`);
    const m = await tabTo(cdp, `(a) => a.hasAttribute("data-modal-open") && a.getAttribute("data-modal-open") === "contactModal"`);
    const opener = await ev(cdp, ACTIVE); await key(cdp, "Enter"); await sleep(400);
    check("contact dialog opens from the keyboard", m > 0 && await ev(cdp, `document.getElementById("contactModal").open`), opener);
    check("focus moves into the dialog", await ev(cdp, `document.getElementById("contactModal").contains(document.activeElement)`), await ev(cdp, ACTIVE));
    let escaped = false; for (let i = 0; i < 40; i++) { await key(cdp, "Tab"); if (!(await ev(cdp, `document.getElementById("contactModal").contains(document.activeElement)`))) { escaped = await ev(cdp, ACTIVE); break; } }
    check("Tab stays inside the open dialog (40 presses)", !escaped, escaped || "trapped");
    const pi = await tabTo(cdp, `(a) => a.classList.contains("pi-trigger") && a.offsetParent !== null`, 40);
    await key(cdp, "Enter"); await sleep(250);
    check("phone input: Enter on the country button opens the list", pi > 0 && await ev(cdp, `[...document.querySelectorAll(".pi-trigger")].some((b) => b.getAttribute("aria-expanded") === "true")`), await ev(cdp, ACTIVE));
    await cdp.send("Input.insertText", { text: LANG === "ar" ? "مصر" : "Egypt" }); await sleep(250); await key(cdp, "ArrowDown"); await key(cdp, "Enter"); await sleep(250);
    const country = await ev(cdp, `(() => { const t = [...document.querySelectorAll(".pi-trigger")].find((b) => b.offsetParent !== null); return t ? t.innerText.trim().replace(/\\s+/g, " ") : null; })()`);
    check("phone input: typing filters, ArrowDown + Enter selects", /\+20|EG/.test(country || ""), country);
    await key(cdp, "Escape"); await sleep(300);
    check("Esc closes the dialog and returns focus to the opener", !(await ev(cdp, `document.getElementById("contactModal").open`)) && (await ev(cdp, ACTIVE)) === opener, await ev(cdp, ACTIVE));
    check("no console errors on the home walkthrough", cdp.errors.length === 0, cdp.errors.slice(0, 2).join(" | "));
    await close(); }

  /* 2. home, phone width: menu button */
  { const { cdp, close } = await page("index.html", 390);
    const n = await tabTo(cdp, `(a) => a.getAttribute("aria-controls") === "primaryNav"`, 40);
    await key(cdp, "Enter"); await sleep(250);
    check("390 px: menu button reachable and Enter opens the nav", n > 0 && await ev(cdp, `document.activeElement.getAttribute("aria-expanded") === "true" || document.querySelector('[aria-controls="primaryNav"]').getAttribute("aria-expanded") === "true"`));
    await key(cdp, "Tab"); const inNav = await ev(cdp, `document.getElementById("primaryNav").contains(document.activeElement)`);
    check("390 px: keyboard open moves focus into the nav, next Tab stays in it", inNav, await ev(cdp, ACTIVE));
    await key(cdp, "Escape"); await sleep(200);
    check("390 px: Esc closes the nav and returns focus to the button", await ev(cdp, `document.querySelector('[aria-controls="primaryNav"]').getAttribute("aria-expanded") === "false" && document.activeElement.getAttribute("aria-controls") === "primaryNav"`));
    await close(); }

  /* 3. hotel page: FAQ */
  { const { cdp, close } = await page("hotels/taj-park.html", 1440);
    const n = await tabTo(cdp, `(a) => a.tagName === "SUMMARY"`, 250);
    await key(cdp, "Enter"); const open1 = await ev(cdp, `document.activeElement.parentElement.open`);
    await key(cdp, " "); const open2 = await ev(cdp, `document.activeElement.parentElement.open`);
    check("FAQ: summary reachable, Enter opens, Space closes", n > 0 && open1 === true && open2 === false, `${n} Tab presses`);
    check("no console errors on the hotel walkthrough", cdp.errors.length === 0, cdp.errors.slice(0, 2).join(" | "));
    await close(); }
} catch (e) { console.error("qa-keyboard failed:", e.message); process.exitCode = 1; }
finally { if (process.platform === "win32") spawn("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" }); else chrome.kill(); }
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} keyboard checks passed (${LANG})`);
console.log("JSON " + JSON.stringify(results));
if (failed) process.exitCode = 1;
