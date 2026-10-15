// Generates frontend/dev/icons.html — a visual contact sheet of every symbol in assets/icons/sprite.svg (dev only, noindex,
// excluded from the sitemap by build-meta.mjs). Re-run after editing the sprite: node tools/icons-sheet.mjs, then npm run build.
// The page reuses the shell of dev/3d.html (head, header, scripts) so theme / scheme / language switching works on it.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = "frontend";
const sprite = readFileSync(join(ROOT, "assets", "icons", "sprite.svg"), "utf8");
const symbols = [...sprite.matchAll(/<!-- (\w+) -->|<symbol id="([^"]+)" viewBox="0 0 24 24">([\s\S]*?)<\/symbol>/g)].reduce((acc, m) => {
  if (m[1]) acc.group = m[1]; else acc.list.push({ id: m[2], body: m[3], group: acc.group });
  return acc;
}, { group: "", list: [] }).list;

/* where each icon is used: pages (static <use>), scripts (icon("…") / "#…"), data files ("icon": "…") */
const usage = {};
const add = (id, where) => { (usage[id] = usage[id] || new Set()).add(where); };
const pages = ["index.html", "about.html", "catering.html", "hotels/taj-park.html", "dev/3d.html"];
for (const p of pages) for (const m of readFileSync(join(ROOT, p), "utf8").matchAll(/sprite(?:\.[0-9a-f]{8})?\.svg#([a-z0-9-]+)/g)) add(m[1], p);
for (const f of readdirSync(join(ROOT, "js")).filter((n) => n.endsWith(".js") && !/\.[0-9a-f]{8}\.js$/.test(n))) {
  const t = readFileSync(join(ROOT, "js", f), "utf8");
  for (const m of t.matchAll(/icon\("([a-z0-9-]+)"/g)) add(m[1], "js/" + f);
  for (const m of t.matchAll(/"#([a-z][a-z0-9-]*)"/g)) if (symbols.some((s) => s.id === m[1])) add(m[1], "js/" + f);
  for (const m of t.matchAll(/#([a-z][a-z0-9-]*)"><\/use>/g)) add(m[1], "js/" + f);
}
for (const dir of ["data", "data/mock"]) for (const f of readdirSync(join(ROOT, dir)).filter((n) => n.endsWith(".json"))) {
  for (const m of readFileSync(join(ROOT, dir, f), "utf8").matchAll(/"icon":\s*"([a-z0-9-]+)"/g)) add(m[1], dir + "/" + f);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const cell = (s) => `
        <li class="icon-cell card bg-surface p-4" id="icon-${s.id}">
          <div class="flex items-center gap-4 mb-3">
            <svg class="icon icon--lg${/^arrow-/.test(s.id) ? " icon--flip" : ""}" aria-hidden="true"><use href="../assets/icons/sprite.svg#${s.id}"/></svg>
            <svg class="icon${/^arrow-/.test(s.id) ? " icon--flip" : ""}" aria-hidden="true"><use href="../assets/icons/sprite.svg#${s.id}"/></svg>
            <svg class="icon icon--sm${/^arrow-/.test(s.id) ? " icon--flip" : ""}" aria-hidden="true"><use href="../assets/icons/sprite.svg#${s.id}"/></svg>
            <span class="icon-box !mb-0 shrink-0" aria-hidden="true"><svg class="icon${/^arrow-/.test(s.id) ? " icon--flip" : ""}"><use href="../assets/icons/sprite.svg#${s.id}"/></svg></span>
            <span class="icon-module" aria-hidden="true"><svg class="icon-module__grid"><use href="module-grid.svg#grid"/></svg><svg class="icon icon-module__icon${/^arrow-/.test(s.id) ? " icon--flip" : ""}"><use href="../assets/icons/sprite.svg#${s.id}"/></svg></span>
          </div>
          <code class="t-label">${s.id}</code>
          <p class="muted text-sm mt-1">${usage[s.id] ? [...usage[s.id]].sort().map(esc).join(" · ") : '<span class="lang-ar">غير مستخدم بعد</span><span class="lang-en">not used yet</span>'}</p>
        </li>`;

const groups = [...new Set(symbols.map((s) => s.group))];
const main = `  <main id="main">
    <section class="section">
      <div class="wrap">
        <div class="demo-ribbon mb-8" data-ribbon="devicons" role="note">
          <span><strong><span class="lang-ar">صفحة تطوير</span><span class="lang-en">Development page</span></strong> <span class="lang-ar">— لوحة مراجعة مجموعة الأيقونات (المرحلة 7). غير مفهرسة.</span><span class="lang-en">— icon set review sheet (Phase 7). Not indexed.</span></span>
          <button type="button" class="btn btn--icon" data-dismiss aria-label="إخفاء"><svg class="icon icon--sm" aria-hidden="true"><use href="../assets/icons/sprite.svg#close"/></svg></button>
        </div>
        <span class="eyebrow"><span class="lang-ar">نظام الأيقونات</span><span class="lang-en">Icon system</span></span>
        <h1 class="t-headline mb-4"><span class="lang-ar">${symbols.length} رمزًا من شبكة الكوفي المربع</span><span class="lang-en">${symbols.length} symbols on the square-Kufic module</span></h1>
        <p class="muted max-w-2xl mb-4"><span class="lang-ar">شبكة 24 بكسل، وحدة 1.5 بكسل مشتقة من بلاطة النقش الكوفي (27 وحدة لكل كتلة 2×2، كل ضربة وكل فراغ وحدة واحدة). سماكة الخط 1.5 بكسل، نهايات مربعة، زوايا قائمة، نصف قطر 0، اللون من <code>currentColor</code>. كل خلية تعرض الرمز بأحجام 32/24/20 بكسل، داخل صندوق الأيقونة، وفوق شبكة الوحدات.</span><span class="lang-en">24 px grid with a 1.5 px module taken from the Kufic tile (27 modules per 2×2 block; every stroke and gap is one module). 1.5 px stroke, square caps, mitre joins, radius 0, <code>currentColor</code>. Each cell shows the symbol at 32/24/20 px, inside the icon box, and over the module grid.</span></p>
        <p class="muted max-w-2xl"><span class="lang-ar">الأسهم منطقية: <code>arrow-end</code> يشير إلى نهاية السطر في الاتجاه الحالي (بدّل اللغة لرؤية الانعكاس).</span><span class="lang-en">Arrows are logical: <code>arrow-end</code> points to the inline end of the current direction (switch the language to see them mirror).</span></p>
      </div>
    </section>
${groups.map((g) => `    <section class="section${groups.indexOf(g) % 2 ? " bg-raised" : ""}" aria-label="${g}">
      <div class="wrap">
        <h2 class="t-title mb-6">${g} <span class="muted">· ${symbols.filter((s) => s.group === g).length}</span></h2>
        <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 list-none p-0 m-0">${symbols.filter((s) => s.group === g).map(cell).join("")}
        </ul>
      </div>
    </section>
`).join("")}    <section class="section">
      <div class="wrap">
        <h2 class="t-title mb-6"><span class="lang-ar">الاشتقاق من البلاطة</span><span class="lang-en">Derivation from the tile</span></h2>
        <div class="flex flex-wrap items-center gap-8">
          <img class="kufic-ref" src="../assets/brand/pattern/kufic-2x2.svg" width="162" height="162" alt="Kufic 2×2 block" decoding="async">
          <p class="muted max-w-xl"><span class="lang-ar">الكتلة 2×2 مرسومة على 27 وحدة (3.016 من 81.553). عند إسقاط كتلة واحدة على 24 بكسل تصبح الوحدة 1.5 بكسل، وهي سماكة الخط نفسها، فتُبنى الرموز من امتدادات متعامدة ودرجات قائمة على هذه الوحدة. تبقى الخطوط المائلة فقط حيث لا يقوم المعنى بدونها (الأسهم، علامة الصح، الإغلاق، النجمة، الطائرة).</span><span class="lang-en">The 2×2 block sits on 27 modules (3.016 of 81.553 units). One block mapped to 24 px makes the module 1.5 px, the stroke width, so symbols are built from orthogonal runs and right-angle steps on that module. Diagonals remain only where the sign cannot exist without them (arrows, check, close, star, plane).</span></p>
        </div>
      </div>
    </section>
  </main>
`;

let shell = readFileSync(join(ROOT, "dev", "3d.html"), "utf8")
  .replace(/\.[0-9a-f]{8}\.(css|js|svg|ico|webp|png)/g, ".$1")                                   // de-hash; npm run build re-fingerprints
  .replace(/<script id="asset-manifest">[\s\S]*?<\/script>\s*/, "")
  .replace(/<title>[^<]*<\/title>/, "<title>مراجعة: مجموعة الأيقونات (صفحة تطوير)</title>")
  .replace(/<span class="lang-ar">صفحة تطوير — المرحلة 5<\/span><span class="lang-en">Dev page — Phase 5<\/span>/, '<span class="lang-ar">صفحة تطوير — المرحلة 7</span><span class="lang-en">Dev page — Phase 7</span>')
  .replace(/  <main id="main">[\s\S]*?<\/main>\n/, main)
  .replace(/  <script src="\.\.\/js\/taj-park-3d-loader\.js"><\/script>\n/, "")
  .replace(/  <script>\n    \(function \(\) \{\n      var ids = [\s\S]*?<\/script>\n/, "");
if (!/icon-module/.test(shell)) throw new Error("main not replaced");
shell = shell.replace("</head>", `  <style>
    /* contact-sheet only: module grid behind each icon (border token at low opacity, lines not gradients) */
    .icon-module { position: relative; display: inline-block; width: 48px; height: 48px; border: 1.5px solid var(--border); }
    .icon-module__grid { position: absolute; inset: 0; width: 100%; height: 100%; fill: none; stroke: var(--border); stroke-width: 0.15; }
    .icon-module__icon { position: absolute; inset: 0; width: 100%; height: 100%; }
    .icon-cell code { font-family: ui-monospace, Consolas, monospace; font-size: 13px; }
    .kufic-ref { border: 1.5px solid var(--border); padding: 16px; background: var(--surface); }
  </style>
</head>`);
writeFileSync(join(ROOT, "dev", "icons.html"), shell);
console.log(`icons-sheet: ${symbols.length} symbols → ${ROOT}/dev/icons.html`);
console.log("unused:", symbols.filter((s) => !usage[s.id]).map((s) => s.id).join(", ") || "none");
