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
  { name: "no hardcoded hex colours outside the token file", re: /(?<!\.svg|sprite)#[0-9a-fA-F]{3,8}\b/, ext: [".css", ".html", ".js"], not: /src[\\/]styles[\\/]site\.css$|assets[\\/]brand|assets[\\/]icons|hotels\.json$/, allow: /theme-color|mask-icon|url\("data:image\/svg\+xml|%23|canvas-kufic|taj-park-3d|theme-badge/ },
  { name: "no emoji / dingbat / star glyphs (icons come from the sprite)", re: /[★☆✓✔✖➤→←▶◀]|[\u{1F300}-\u{1FAFF}]|[☀-⛿]/u, ext: [".html", ".js"] },
  { name: "arrow icons are RTL-aware (every arrow-start/arrow-end <use> sits in an .icon--flip svg)", re: /<svg(?![^>]*icon--flip)[^>]*>\s*<use[^>]*#arrow-(start|end)"/, ext: [".html", ".js"] },
  { name: "no inline SVG drawings outside the sprite (only <use> references)", re: /<svg[^>]*>\s*<(path|circle|rect|line|polyline|polygon|g)\b/, ext: [".html", ".js"], not: /assets[\\/]icons|assets[\\/]brand/ },
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
    // comments are not code: blank out HTML comments, block comments and line comments before testing
    const lines = readFileSync(f, "utf8")
      .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/(^|[^:"'\\])\/\/.*$/gm, "$1")
      .split("\n");
    lines.forEach((l, i) => { if (c.re.test(l) && !(c.allow && c.allow.test(l))) hits.push(`${relative(".", f)}:${i + 1}: ${l.trim().slice(0, 100)}`); });
  }
  console.log(`${hits.length === 0 ? "PASS" : "FAIL"}  ${c.name} (${hits.length})`);
  hits.slice(0, 12).forEach((h) => console.log("      " + h));
  violations += hits.length;
}

// hotel cards use photographs (Phase 5 approval): the 3D poster is only for pages that mount the scene
{
  const roster = JSON.parse(readFileSync(join(ROOT, "data", "hotels.json"), "utf8")).hotels;
  const bad = roster.filter((h) => /assets[\/]3d[\/]/.test([h.image, h.image_dark, h.srcset].join(" ")) || !/^imgs\/hotel-pics\//.test(h.image || ""));
  const taj = roster.find((h) => h.slug === "taj-park");
  const tajOk = taj && /^imgs\/hotel-pics\/taj-park-640(\.[0-9a-f]{8})?\.webp$/.test(taj.image) && !taj.image_dark;
  console.log(`${bad.length === 0 && tajOk ? "PASS" : "FAIL"}  hotel card images are photographs, Taj Park card = taj-park-640 photo (${bad.map((h) => h.slug).join(", ") || "none"})`);
  if (bad.length || !tajOk) violations += bad.length || 1;
}

// publication switch (data/pages.json): unpublished pages are noindex, absent from the sitemap, and no rendered <a> links to them
{
  const { posix } = await import("node:path");
  const man = JSON.parse(readFileSync(join(ROOT, "data", "pages.json"), "utf8")).pages;
  const sitemap = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  const htmls = files.filter((f) => f.endsWith(".html") && !/[\\/]dev[\\/]/.test(f));
  const problems = [];
  for (const p of man.filter((p) => !p.published)) {
    if (sitemap.includes("/" + p.path)) problems.push(p.path + " in sitemap");
    if (!/<meta name="robots" content="noindex"/.test(readFileSync(join(ROOT, p.path), "utf8"))) problems.push(p.path + " lacks noindex");
    for (const f of htmls) {
      const me = relative(ROOT, f).replace(/\\/g, "/");
      const visible = readFileSync(f, "utf8").replace(/<template data-unpublished="[^"]*">[\s\S]*?<\/template>/g, "");
      for (const m of visible.matchAll(/<a\b[^>]*\bhref="([^"#?]+)"/g)) if (posix.normalize(posix.join(posix.dirname(me), m[1])) === p.path) problems.push(`${me} links to ${p.path}`);
    }
  }
  for (const p of man.filter((p) => p.published)) if (!sitemap.includes(p.path)) problems.push(p.path + " published but not in sitemap");
  console.log(`${problems.length ? "FAIL" : "PASS"}  publication switch honoured (${man.map((p) => p.path + "=" + (p.published ? "published" : "hidden")).join(", ")})`);
  problems.slice(0, 12).forEach((x) => console.log("      " + x));
  violations += problems.length;
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
