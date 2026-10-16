// Content-hash fingerprinting (BUG 1 fix). Runs last in `npm run build`.
//   1. leaf assets (images, fonts, SVG, vendor JS incl. three) → copies named name.<8-hex>.ext next to the originals
//   2. app JS (js/*.js) and dist/site.css: references to leaves are rewritten, then the rewritten content is hashed too
//   3. every HTML page and data/*.json is rewritten in place to the hashed names; HTML gets an inline manifest
//      (window.__assetManifest + window.__asset()) for scripts that compose paths at runtime
//   4. dist/asset-manifest.json is written; hashed files from earlier runs that are no longer current are deleted
// Idempotent: a reference already in the form name.<8-hex>.ext is normalised to its source name before mapping,
// so running the build twice yields identical files (the committed state is the built state).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, unlinkSync, copyFileSync } from "node:fs";
import { join, relative, basename, extname, posix, resolve } from "node:path";

const ROOT = resolve("frontend");
const MANIFEST = join(ROOT, "dist", "asset-manifest.json");
const HASH_RE = /\.([0-9a-f]{8})(\.[a-z0-9]+(?:\.[a-z0-9]+)?)$/i;
const rel = (p) => relative(ROOT, p).split("\\").join("/");
const sha = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 8);
const hashedName = (name, h) => { const m = name.match(/^(.*?)((?:\.min)?\.[a-z0-9]+)$/i); return m ? `${m[1]}.${h}${m[2]}` : `${name}.${h}`; };
const LEAF_DIRS = ["assets/", "imgs/", "vendor/"];
const LEAF_EXT = new Set([".png", ".webp", ".jpg", ".jpeg", ".svg", ".ico", ".woff2", ".ttf", ".js"]);
const SKIP = new Set(["js/theme-boot.js"]); // source of the inline pre-paint script; never loaded by URL

function walk(dir, out = []) { for (const n of readdirSync(dir)) { const p = join(dir, n); if (n === "node_modules" || n === "src") continue; statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; }
const prev = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
// sorted with a byte-order compare so the manifest (and the inline copy in every page) is identical on Windows and Linux
// camera originals are never published: they stay on disk (git-ignored) and only their WebP derivatives
// (tools/make_webp.py) are fingerprinted. Also skipped: file names that are not web-safe (spaces, parentheses).
const NOT_PUBLISHED = (r) => /^imgs\/hotel-pics\/RST\//.test(r) || /[\s()]/.test(basename(r));
const originals = walk(ROOT).map((p) => ({ abs: p, rel: rel(p) })).filter((f) => !HASH_RE.test(basename(f.rel)) && !NOT_PUBLISHED(f.rel)).sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
const manifest = {};

/* rewrite asset references in text; paths resolve relative to the file (or the site root for leading "/") */
const REF = /(^|[\s"'(,=])((?:\.{1,2}\/)*(?:[\w\-]+\/)*[\w\-]+(?:\.[0-9a-f]{8})?(?:\.min)?\.(?:png|webp|jpg|jpeg|svg|ico|woff2|ttf|js|css))(?=[\s"')#?,>]|$)/gim;
function rewriteText(text, fileRel, rootRelative = false) {
  const dir = rootRelative || posix.dirname(fileRel) === "." ? "" : posix.dirname(fileRel);
  return text.replace(REF, (m, pre, ref) => {
    if (/^(https?:|data:)/.test(ref) || ref.includes("://")) return m;
    const clean = ref.replace(HASH_RE, "$2");
    const target = posix.normalize(dir ? posix.join(dir, clean) : clean).replace(/^\.\//, "");
    const mapped = manifest[target]; if (!mapped) return m;
    const out = dir ? posix.relative(dir, mapped) : mapped;
    return pre + (clean.startsWith("./") ? "./" + out : out);
  });
}
function emit(f, content) { const h = sha(content); const out = hashedName(f.rel, h); manifest[f.rel] = out; const dst = join(ROOT, out); if (!existsSync(dst) || readFileSync(dst).equals(Buffer.from(content)) === false) writeFileSync(dst, content); }

/* 1. leaves */
for (const f of originals) {
  if (!LEAF_DIRS.some((d) => f.rel.startsWith(d)) || !LEAF_EXT.has(extname(f.rel)) || f.rel === "vendor/three.min.js") continue;
  emit(f, readFileSync(f.abs));
}
emit(originals.find((f) => f.rel === "vendor/three.min.js"), readFileSync(join(ROOT, "vendor/three.min.js")));
/* 2. app JS + CSS (content rewritten before hashing) */
for (const f of originals) {
  const isApp = (f.rel.startsWith("js/") && f.rel.endsWith(".js") && !SKIP.has(f.rel)) || f.rel === "dist/site.css";
  if (!isApp) continue;
  emit(f, Buffer.from(rewriteText(readFileSync(f.abs, "utf8"), f.rel)));
}
/* 3. HTML + JSON in place, manifest injected into HTML */
for (const f of originals) {
  const isPage = f.rel.endsWith(".html"), isData = f.rel.startsWith("data/") && f.rel.endsWith(".json");
  if (!isPage && !isData) continue;
  let txt = readFileSync(f.abs, "utf8");
  txt = txt.replace(/\n?\s*<script id="asset-manifest">[\s\S]*?<\/script>/, "");
  txt = rewriteText(txt, f.rel, isData); /* data/*.json paths are site-root relative (hotels.js joins them with its data-base) */
  if (isPage) {
    const depth = f.rel.split("/").length - 1, base = "../".repeat(depth);
    const tag = `<script id="asset-manifest">window.__assetManifest=${JSON.stringify(manifest)};window.__asset=function(p){var b=${JSON.stringify(base)},r=String(p).replace(/^\\.\\//,"");if(b&&r.indexOf(b)===0)r=r.slice(b.length);var m=window.__assetManifest[r];return m?b+m:p;};</script>`;
    txt = txt.replace(/(\n[ \t]*<script src=")/, `\n  ${tag}$1`);
  }
  writeFileSync(f.abs, txt);
}
/* 4. manifest + cleanup */
const current = new Set(Object.values(manifest));
for (const p of walk(ROOT)) { const r = rel(p); if (HASH_RE.test(basename(r)) && !current.has(r)) unlinkSync(p); }
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
const changed = Object.keys(manifest).filter((k) => prev[k] && prev[k] !== manifest[k]).length;
console.log(`fingerprint: ${Object.keys(manifest).length} assets hashed, ${changed} changed since last build → dist/asset-manifest.json`);
