// Served HTML must be byte-identical to the committed HTML (Netlify post-processing is off).
// Usage: node tools/qa-served.mjs [baseUrl]   (default: the branch preview)
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const BASE = process.argv[2] || "https://overhaul-phase-1--deafah.netlify.app";
const pages = ["index.html", "about.html", "catering.html", "hotels/taj-park.html", "dev/3d.html", "dev/icons.html", "sitemap.xml", "robots.txt", "data/hotels.json", "data/pages.json"];
const sha = (b) => createHash("sha256").update(b).digest("hex");
let bad = 0;
for (const p of pages) {
  const local = sha(readFileSync("frontend/" + p));
  const res = await fetch(`${BASE}/${p}`, { cache: "no-store" });
  const served = sha(Buffer.from(await res.arrayBuffer()));
  const ok = res.ok && served === local; if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${p.padEnd(22)} ${res.status} served ${served.slice(0, 12)} committed ${local.slice(0, 12)}`);
}
process.exit(bad ? 1 : 0);
