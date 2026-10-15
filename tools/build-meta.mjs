// Generates frontend/sitemap.xml and frontend/robots.txt from the HTML pages on disk (run by `npm run build`).
import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const SITE = process.env.SITE_URL || "https://www.deafah.com";
const ROOT = "frontend";
const pages = [];
function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (["vendor", "node_modules", "dist", "assets", "imgs", "src"].includes(n)) continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith(".html")) pages.push(p);
  }
}
walk(ROOT);
const urls = pages.map((p) => {
  const rel = relative(ROOT, p).replace(/\\/g, "/");
  const loc = rel === "index.html" ? `${SITE}/` : `${SITE}/${rel}`;
  const lastmod = statSync(p).mtime.toISOString().slice(0, 10);
  const priority = rel === "index.html" ? "1.0" : rel.startsWith("hotels/") ? "0.8" : "0.7";
  return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><priority>${priority}</priority></url>`;
});
writeFileSync(join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
writeFileSync(join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /vendor/\nDisallow: /data/mock/\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`sitemap: ${urls.length} pages →`, pages.map((p) => relative(ROOT, p)).join(", "));
if (!existsSync(join(ROOT, "dist", "site.css"))) console.warn("warning: frontend/dist/site.css missing — run npm run build:css");
