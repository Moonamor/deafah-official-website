// Generates frontend/sitemap.xml and frontend/robots.txt from the HTML pages on disk, and applies the settings in
// frontend/data/pages.json (run by `npm run build`, after fingerprinting). Idempotent.
//   site_url         → the one production origin: sitemap <loc>, robots Sitemap:, <link rel="canonical">, og:url, and an
//                      absolute og:image pointing at the current fingerprinted file (dist/asset-manifest.json).
//   unpublished page → every <a> pointing at it (nav, footer, any page) is wrapped in <template data-unpublished="…">
//                      (not rendered, not crawled as a link); the page gets <meta name="robots" content="noindex">;
//                      it is left out of the sitemap; a linked hotel card in hotels.json loses details_url, so its
//                      «عرض التفاصيل» button falls back to the contact dialog (hotels.js).
//   published page   → all of the above is undone.
import { readdirSync, statSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, relative, dirname, posix } from "node:path";

const ROOT = "frontend";
const settings = JSON.parse(readFileSync(join(ROOT, "data", "pages.json"), "utf8"));
const SITE = String(settings.site_url || "").replace(/\/+$/, "");
if (!/^https:\/\/[a-z0-9.-]+$/i.test(SITE)) throw new Error(`pages.json site_url must be an https origin, got "${settings.site_url}"`);
const manifest = settings.pages;
const assetManifest = (() => { try { return JSON.parse(readFileSync(join(ROOT, "dist", "asset-manifest.json"), "utf8")); } catch { return {}; } })();
const pageUrl = (r) => (r === "index.html" ? `${SITE}/` : `${SITE}/${r}`);
const unpublished = new Set(manifest.filter((p) => !p.published).map((p) => p.path));

const pages = [];
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (["vendor", "node_modules", "dist", "assets", "imgs", "src", "dev"].includes(n)) continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith(".html")) pages.push(p);
  }
})(ROOT);
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");

/* ---- links + robots per page ---- */
const ROBOTS = '<meta name="robots" content="noindex" data-unpublished-robots>';
let wrapped = 0, unwrapped = 0;
for (const file of pages) {
  const me = rel(file);
  let html = readFileSync(file, "utf8"), before = html;
  // undo everything first, then re-apply from the manifest → idempotent
  html = html.replace(/<template data-unpublished="[^"]*">(<a\b[\s\S]*?<\/a>)<\/template>/g, (m, a) => { unwrapped++; return a; });
  html = html.replace(new RegExp("\\s*" + ROBOTS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "");
  for (const target of unpublished) {
    html = html.replace(/<a\b[^>]*\bhref="([^"#?]+)"[\s\S]*?<\/a>/g, (a, href) => {
      const resolved = posix.normalize(posix.join(posix.dirname(me), href));
      if (resolved !== target) return a;
      wrapped++;
      return `<template data-unpublished="${target}">${a}</template>`;
    });
  }
  if (unpublished.has(me)) html = html.replace(/(<meta name="viewport"[^>]*>)/, `$1\n  ${ROBOTS}`);
  // canonical + og:url from site_url; og:image absolute, pointing at the current fingerprinted file
  html = html.replace(/\s*<link rel="canonical"[^>]*>/g, "").replace(/\s*<meta property="og:url"[^>]*>/g, "");
  html = html.replace(/\n([ \t]*)(<meta property="og:type"[^>]*>)/, (m, ind, tag) => `\n${ind}<link rel="canonical" href="${pageUrl(me)}">\n${ind}<meta property="og:url" content="${pageUrl(me)}">\n${ind}${tag}`);
  html = html.replace(/<meta property="og:image" content="([^"]+)">/, (m, src) => {
    const path = /^https?:/.test(src) ? new URL(src).pathname.slice(1) : posix.normalize(posix.join(posix.dirname(me), src));
    const original = path.replace(/\.[0-9a-f]{8}(\.[a-z0-9]+)$/i, "$1");
    return `<meta property="og:image" content="${SITE}/${assetManifest[original] || path}">`;
  });
  if (html !== before) writeFileSync(file, html);
}

/* ---- hotel cards: details link only for published pages ---- */
const hotelsPath = join(ROOT, "data", "hotels.json");
const hotels = JSON.parse(readFileSync(hotelsPath, "utf8"));
for (const p of manifest.filter((p) => p.hotel)) {
  const h = hotels.hotels.find((x) => x.slug === p.hotel);
  if (!h) continue;
  if (p.published) h.details_url = p.path; else delete h.details_url;
}
const hotelsOut = JSON.stringify(hotels, null, 2) + "\n";
if (hotelsOut !== readFileSync(hotelsPath, "utf8")) writeFileSync(hotelsPath, hotelsOut);

/* ---- sitemap + robots.txt ---- */
const listed = pages.filter((p) => !unpublished.has(rel(p)));
const urls = listed.map((p) => {
  const r = rel(p);
  const loc = pageUrl(r);
  const lastmod = statSync(p).mtime.toISOString().slice(0, 10);
  const priority = r === "index.html" ? "1.0" : r.startsWith("hotels/") ? "0.8" : "0.7";
  return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><priority>${priority}</priority></url>`;
});
writeFileSync(join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
writeFileSync(join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /vendor/\nDisallow: /data/mock/\nDisallow: /dev/\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`sitemap: ${urls.length} pages →`, listed.map(rel).join(", "));
console.log(`publication: unpublished = ${[...unpublished].join(", ") || "none"}; links hidden = ${wrapped}`);
if (!existsSync(join(ROOT, "dist", "site.css"))) console.warn("warning: frontend/dist/site.css missing — run npm run build:css");
