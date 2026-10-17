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
  /* owner override 5 (2026-10-17): Font Awesome Free is allowed ONLY as the build-time SVG sprite — no kit, CSS or webfont */
  { name: "no jQuery / Font Awesome kit, CSS or webfont / icon fonts", re: /jquery|kit\.fontawesome|fontawesome\.com\/kit|fontawesome[^"']*\.css|fa-(solid|regular|brands)-\d+|webfonts\/fa-|class="fa-|material-icons/i, ext: [".html", ".css", ".js"] },
  { name: "no physical-direction CSS in authored CSS", re: /(^|[^-\w])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right|text-align\s*:\s*(left|right))\s*:/m, ext: [".css"], only: /src[\\/]styles/ },
  { name: "no hardcoded hex colours outside the token file", re: /(?<!\.svg|sprite)#[0-9a-fA-F]{3,8}\b/, ext: [".css", ".html", ".js"], not: /src[\\/]styles[\\/]site\.css$|assets[\\/]brand|assets[\\/]icons|hotels\.json$/, allow: /theme-color|mask-icon|url\("data:image\/svg\+xml|%23|canvas-kufic|taj-park-3d|theme-badge/ },
  { name: "no emoji / dingbat / star glyphs (icons come from the sprite)", re: /[★☆✓✔✖➤→←▶◀]|[\u{1F300}-\u{1FAFF}]|[☀-⛿]|fromCodePoint\(\s*127397|\\u\{1F1|\\uD83C\\uDD/u, ext: [".html", ".js"] },
  { name: "arrow icons are RTL-aware (every arrow-start/arrow-end <use> sits in an .icon--flip svg)", re: /<svg(?![^>]*icon--flip)[^>]*>\s*<use[^>]*#arrow-(start|end)"/, ext: [".html", ".js"] },
  { name: "no inline SVG drawings outside the sprite (only <use> references)", re: /<svg[^>]*>\s*<(path|circle|rect|line|polyline|polygon|g)\b/, ext: [".html", ".js"], not: /assets[\\/]icons|assets[\\/]brand/ },
  /* owner brief F1: theme-tinted elevation shadows are allowed; glass and blur stay forbidden */
  { name: "no glass/blur", re: /backdrop-filter|filter\s*:\s*blur/, ext: [".css"] },
  /* owner override 1: radius only through the scale tokens (sm 4 / md 8 / lg 12 / xl 16 / full) or 0 */
  { name: "border-radius uses the radius tokens", re: /border-radius\s*:(?!\s*(0|0px|inherit|var\(--radius-(none|sm|md|lg|xl|full)\))\s*[;}])/, ext: [".css"], only: /src[\\/]styles/ },
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
    if (!/<meta name="robots" content="noindex[",]/.test(readFileSync(join(ROOT, p.path), "utf8"))) problems.push(p.path + " lacks noindex");
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

// one production origin (data/pages.json site_url): canonical, og:url, og:image, sitemap and robots all derive from it
{
  const SITE = JSON.parse(readFileSync(join(ROOT, "data", "pages.json"), "utf8")).site_url.replace(/\/+$/, "");
  const problems = [];
  const sitemap = readFileSync(join(ROOT, "sitemap.xml"), "utf8"), robots = readFileSync(join(ROOT, "robots.txt"), "utf8");
  for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) if (!m[1].startsWith(SITE + "/")) problems.push("sitemap loc " + m[1]);
  const PROTO = JSON.parse(readFileSync(join(ROOT, "data", "pages.json"), "utf8")).prototype_noindex === true;
  if (PROTO) {   /* prototype (BRAND_GAPS G41): nothing indexed — Disallow: /, every page noindex,nofollow, X-Robots-Tag in _headers */
    if (!/User-agent: \*\s*\nDisallow: \/\s*$/m.test(robots)) problems.push("robots.txt must Disallow: / (prototype)");
    if (!/X-Robots-Tag: noindex/.test(readFileSync(join(ROOT, "_headers"), "utf8"))) problems.push("_headers X-Robots-Tag (prototype)");
    for (const f of files.filter((f) => f.endsWith(".html") && !/[\\/]dev[\\/]/.test(f))) if (!/<meta name="robots" content="noindex, nofollow"/.test(readFileSync(f, "utf8"))) problems.push(relative(ROOT, f) + " lacks noindex, nofollow (prototype)");
  } else if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) problems.push("robots.txt Sitemap line");
  for (const f of files.filter((f) => f.endsWith(".html") && !/[\\/]dev[\\/]/.test(f))) {
    const me = relative(ROOT, f).replace(/\\/g, "/"), want = me === "index.html" ? SITE + "/" : `${SITE}/${me}`;
    const h = readFileSync(f, "utf8");
    if (!h.includes(`<link rel="canonical" href="${want}">`)) problems.push(me + " canonical");
    if (!h.includes(`<meta property="og:url" content="${want}">`)) problems.push(me + " og:url");
    const og = (h.match(/<meta property="og:image" content="([^"]+)">/) || [])[1] || "";
    if (!og.startsWith(SITE + "/")) problems.push(me + " og:image not absolute on site_url");
    else { try { statSync(join(ROOT, og.slice(SITE.length + 1))); } catch { problems.push(me + " og:image file missing " + og); } }
  }
  console.log(`${problems.length ? "FAIL" : "PASS"}  canonical / og:url / og:image / sitemap / robots derive from site_url (${SITE})`);
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
