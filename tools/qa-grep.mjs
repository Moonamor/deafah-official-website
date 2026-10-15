// QA greps required by the brief (Phase 8) — runnable at any phase. Exit code 1 on any violation.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = "frontend";
const SKIP_DIRS = new Set(["vendor", "node_modules", "dist"]);
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(n)) walk(p); }
    else if ([".html", ".css", ".js", ".json", ".mjs", ".svg"].includes(extname(n))) files.push(p);
  }
})(ROOT);

const checks = [
  { name: "no reference to visualIdentityReferences/", re: /visualIdentityReferences/, ext: [".html", ".css", ".js", ".json"] },
  { name: "no Bootstrap classes / assets", re: /\bbootstrap\b|\.btn-(?!-)|\bcol-md|\bd-flex\b|\bcol-\d|\brow-cols-|data-bs-/i, ext: [".html", ".css", ".js"] },
  { name: "no CDN runtime dependencies", re: /https?:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|code\.jquery\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)/, ext: [".html", ".css", ".js"] },
  { name: "no jQuery / Font Awesome / icon fonts", re: /jquery|font-?awesome|fa-solid|fa-regular|class="fa-|material-icons/i, ext: [".html", ".css", ".js"] },
  { name: "no physical-direction CSS in authored CSS", re: /(^|[^-\w])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right|text-align\s*:\s*(left|right))\s*:/m, ext: [".css"], only: /src[\\/]styles/ },
  { name: "no hardcoded hex colours outside the token file", re: /#[0-9a-fA-F]{3,8}\b/, ext: [".css", ".html", ".js"], not: /src[\\/]styles[\\/]site\.css$|assets[\\/]brand|assets[\\/]icons|hotels\.json$/, allow: /theme-color|mask-icon|url\("data:image\/svg\+xml|%23|canvas-kufic|taj-park-3d|theme-badge/ },
  { name: "no glass/blur/glow", re: /backdrop-filter|filter\s*:\s*blur|box-shadow\s*:\s*(?!none)/, ext: [".css"] },
  { name: "no border-radius above 2px", re: /border-radius\s*:(?!\s*(0|0px|2px|inherit|var\(--radius-(none|chip)\))\s*[;}])/, ext: [".css"], only: /src[\\/]styles/ },
];

let violations = 0;
for (const c of checks) {
  const hits = [];
  for (const f of files) {
    if (!c.ext.includes(extname(f))) continue;
    if (c.only && !c.only.test(f)) continue;
    if (c.not && c.not.test(f)) continue;
    // comments are not code: blank out block comments and line comments before testing
    const lines = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/(^|[^:"'\\])\/\/.*$/gm, "$1")
      .split("\n");
    lines.forEach((l, i) => { if (c.re.test(l) && !(c.allow && c.allow.test(l))) hits.push(`${relative(".", f)}:${i + 1}: ${l.trim().slice(0, 100)}`); });
  }
  console.log(`${hits.length === 0 ? "PASS" : "FAIL"}  ${c.name} (${hits.length})`);
  hits.slice(0, 12).forEach((h) => console.log("      " + h));
  violations += hits.length;
}

// inline pre-paint script must equal js/theme-boot.js (minus its leading comment)
const boot = readFileSync(join(ROOT, "js", "theme-boot.js"), "utf8").replace(/^\/\*[\s\S]*?\*\/\s*/, "").trim();
for (const f of files.filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(f, "utf8");
  const m = html.match(/<script id="theme-boot">([\s\S]*?)<\/script>/);
  const ok = m && m[1].trim() === boot;
  const before = m ? html.indexOf('<script id="theme-boot">') < html.search(/<link[^>]+rel="stylesheet"/) : false;
  console.log(`${ok && before ? "PASS" : "FAIL"}  pre-paint script in ${relative(".", f)} ${ok ? "" : "(content differs from js/theme-boot.js)"} ${before ? "" : "(must precede the first stylesheet)"}`);
  if (!(ok && before)) violations++;
}
console.log(violations ? `\n${violations} violation(s)` : "\nall clean");
process.exit(violations ? 1 : 0);
