// Verifies that every local path referenced from HTML/CSS/JS/JSON exists on disk WITH THE SAME CASE
// (Windows is case-insensitive, Netlify's Linux CDN is not). Exit 1 on any mismatch or missing file.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname, resolve, sep, extname } from "node:path";

const ROOT = resolve("frontend");
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (!["vendor", "node_modules"].includes(n)) walk(p); } else if ([".html", ".css", ".js", ".json"].includes(extname(n))) files.push(p); } })(ROOT);

function realCasePath(p) {
  // rebuild the path segment by segment using the directory listing's exact spelling
  let cur = ROOT; const parts = relative(ROOT, p).split(sep);
  for (const part of parts) {
    if (!existsSync(cur)) return null;
    const match = readdirSync(cur).find((n) => n === part);
    if (!match) return null;
    cur = join(cur, match);
  }
  return cur;
}

const re = /(?:src|href|srcset|poster|data-src|data-base)=["']([^"'#?]+)|url\(["']?([^"')#?]+)|"(?:image|details_url|srcset)":\s*"([^"]+)"/g;
let bad = 0, checked = 0;
for (const f of files) {
  const txt = readFileSync(f, "utf8");
  for (const m of txt.matchAll(re)) {
    const raw = (m[1] || m[2] || m[3] || "").trim();
    if (/^data:/.test(raw)) continue;
    for (const candidate of raw.split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean)) {
      if (/^(https?:|mailto:|tel:|data:|\/\/|#|javascript:)/.test(candidate) || candidate.startsWith("{") || candidate.endsWith("/")) continue;
      // authored CSS under src/styles is compiled to dist/site.css, so its url() values resolve against dist/
      const baseDir = /src[\\/]styles/.test(f) ? join(ROOT, "dist") : dirname(f);
      const fromRoot = candidate.startsWith("/") ? join(ROOT, candidate) : resolve(baseDir, candidate);
      const alt = resolve(ROOT, candidate); // hotels.json paths and JS data-base paths are site-root relative
      checked++;
      const ok = [fromRoot, alt].some((p) => existsSync(p) && realCasePath(p) === p);
      if (!ok) { bad++; console.log(`MISSING/CASE  ${relative(".", f)} → ${candidate}`); }
    }
  }
}
console.log(`${checked} references checked, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
