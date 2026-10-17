// Builds frontend/assets/icons/sprite.svg from Font Awesome Free (npm @fortawesome/fontawesome-free, build-time only).
// Only the icons listed in MAP are inlined — no Font Awesome JS kit, CSS or webfont ships to the browser.
// Each <symbol> keeps Font Awesome's licence comment (icons: CC BY 4.0). Our ids stay semantic, so markup reads
// <svg class="icon"><use href="assets/icons/sprite.svg#walk"/></svg> and the FA name can change here only.
// Style rule (owner brief E3): Solid for UI icons, Brands for social marks — never mixed inside one component.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("@fortawesome/fontawesome-free/package.json");
const FA = "node_modules/@fortawesome/fontawesome-free/svgs/";

/* our id → [style, Font Awesome name]. Directional icons are drawn pointing to the inline END in LTR; the .icon--flip
   class mirrors them under dir="rtl". */
export const MAP = {
  /* interface */
  menu: ["solid", "bars"], close: ["solid", "xmark"], "chevron-down": ["solid", "chevron-down"], plus: ["solid", "plus"], minus: ["solid", "minus"],
  check: ["solid", "check"], send: ["solid", "paper-plane"], "arrow-end": ["solid", "arrow-right"], "arrow-start": ["solid", "arrow-left"], "arrow-up": ["solid", "arrow-up"],
  "chevron-end": ["solid", "chevron-right"], "chevron-start": ["solid", "chevron-left"],
  moon: ["solid", "moon"], sun: ["solid", "sun"], auto: ["solid", "circle-half-stroke"], palette: ["solid", "palette"], language: ["solid", "language"],
  pause: ["solid", "pause"], play: ["solid", "play"], info: ["solid", "circle-info"], "circle-check": ["solid", "circle-check"], "circle-exclamation": ["solid", "circle-exclamation"],
  reset: ["solid", "rotate-left"], filter: ["solid", "sliders"], images: ["solid", "images"], zoom: ["solid", "magnifying-glass-plus"],
  /* contact & forms */
  phone: ["solid", "phone"], mail: ["solid", "envelope"], user: ["solid", "user"], message: ["solid", "message"], location: ["solid", "location-dot"],
  /* hospitality */
  hotel: ["solid", "hotel"], rooms: ["solid", "door-open"], bed: ["solid", "bed"], "haram-distance": ["solid", "map-location-dot"], walk: ["solid", "person-walking"],
  shuttle: ["solid", "van-shuttle"], restaurant: ["solid", "utensils"], "prayer-time": ["solid", "clock"], clock: ["solid", "clock"], wifi: ["solid", "wifi"],
  parking: ["solid", "square-parking"], family: ["solid", "people-roof"], elevator: ["solid", "elevator"], kitchen: ["solid", "kitchen-set"], chef: ["solid", "bowl-food"],
  tray: ["solid", "bell-concierge"], meal: ["solid", "bowl-food"], coffee: ["solid", "mug-hot"], calendar: ["solid", "calendar-days"], star: ["solid", "star"], tag: ["solid", "tag"],
  train: ["solid", "train"], plane: ["solid", "plane"], route: ["solid", "route"], users: ["solid", "users"], certificate: ["solid", "certificate"], building: ["solid", "building"],
  /* about page values */
  eye: ["solid", "eye"], target: ["solid", "bullseye"], care: ["solid", "hand-holding-heart"], shield: ["solid", "shield-halved"], value: ["solid", "gem"],
  growth: ["solid", "seedling"], handshake: ["solid", "handshake"], globe: ["solid", "globe"], award: ["solid", "award"],
  /* social (Brands) */
  whatsapp: ["brands", "whatsapp"], instagram: ["brands", "instagram"], x: ["brands", "x-twitter"], snapchat: ["brands", "snapchat"],
  tiktok: ["brands", "tiktok"], youtube: ["brands", "youtube"], linkedin: ["brands", "linkedin"],
};

/* only the icons actually referenced: sprite fragments (#id), icon("id") calls, "icon": "id" data fields and quoted ids
   in the scripts that compose sprite URLs at run time (theme badge, phone input, nav, page renderers) */
import { readdirSync } from "node:fs";
const sources = [
  ...["frontend", "frontend/hotels"].flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".html")).map((f) => `${d}/${f}`)),
  ...readdirSync("frontend/js").filter((f) => f.endsWith(".js") && !/\.[0-9a-f]{8}\.js$/.test(f)).map((f) => `frontend/js/${f}`),
  ...["frontend/data", "frontend/data/mock"].flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".json")).map((f) => `${d}/${f}`)),
  "tools/build-sections.mjs",
];
const text = sources.map((f) => readFileSync(f, "utf8")).join("\n");
const used = new Set(Object.keys(MAP).filter((id) => new RegExp(`(#${id}\\b|icon\\(\\s*"${id}"|"icon"\\s*:\\s*"${id}"|["']${id}["'])`).test(text)));

const symbols = Object.entries(MAP).filter(([id]) => used.has(id)).map(([id, [style, name]]) => {
  const svg = readFileSync(`${FA}${style}/${name}.svg`, "utf8");
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  const comment = (svg.match(/<!--![\s\S]*?-->/) || [""])[0];
  const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<!--![\s\S]*?-->/, "").replace(/ fill="currentColor"/g, "");
  return `    <symbol id="${id}" viewBox="${viewBox}" data-fa="${style}/${name}">${comment}${body}</symbol>`;
});

const out = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
  <!-- Generated by tools/build-icons.mjs from Font Awesome Free ${pkg.version} (https://fontawesome.com). Icons: CC BY 4.0.
       Do not edit by hand. Solid style for UI icons, Brands style for social marks. Colour: currentColor (CSS fill). -->
  <defs>
${symbols.join("\n")}
  </defs>
</svg>
`;
writeFileSync("frontend/assets/icons/sprite.svg", out);
console.log(`build-icons: ${symbols.length} Font Awesome ${pkg.version} icons → frontend/assets/icons/sprite.svg (${Buffer.byteLength(out)} bytes)`);

/* review sheet: frontend/dev/icons.html <main> is regenerated from MAP (every mapped icon, with its Font Awesome name,
   at 24 / 20 / 16 px and inside the icon box). Not indexed (dev page). */
{
  const page = "frontend/dev/icons.html";
  const html = readFileSync(page, "utf8");
  const SP = "../assets/icons/sprite.svg";
  const groups = { interface: [], "contact & forms": [], hospitality: [], values: [], social: [] };
  const order = Object.keys(MAP);
  const groupOf = (id) => MAP[id][0] === "brands" ? "social"
    : ["phone", "mail", "user", "message", "location", "send"].includes(id) ? "contact & forms"
    : ["eye", "target", "care", "shield", "value", "growth", "handshake", "globe", "award"].includes(id) ? "values"
    : order.indexOf(id) >= order.indexOf("hotel") ? "hospitality" : "interface";
  for (const id of order) if (used.has(id)) groups[groupOf(id)].push(id);
  const flip = (id) => (/^(arrow|chevron)-(start|end)$/.test(id) || id === "send" ? " icon--flip" : "");
  const cell = (id) => `        <li class="icon-cell card bg-surface p-4" id="icon-${id}">
          <div class="flex items-center gap-4 mb-3">
            <svg class="icon${flip(id)}" aria-hidden="true"><use href="${SP}#${id}"/></svg>
            <svg class="icon icon--sm${flip(id)}" aria-hidden="true"><use href="${SP}#${id}"/></svg>
            <svg class="icon icon--xs${flip(id)}" aria-hidden="true"><use href="${SP}#${id}"/></svg>
            <span class="icon-box mb-0" aria-hidden="true"><svg class="icon${flip(id)}"><use href="${SP}#${id}"/></svg></span>
          </div>
          <p class="t-label"><code>${id}</code></p>
          <p class="muted text-sm">fa-${MAP[id][0]} · ${MAP[id][1]}</p>
        </li>`;
  const main = `  <main id="main">
    <section class="section">
      <div class="wrap">
        <span class="eyebrow"><span class="lang-ar">نظام الأيقونات</span><span class="lang-en">Icon system</span></span>
        <h1 class="t-headline mb-4"><span class="lang-ar">${used.size} أيقونة من Font Awesome Free ${pkg.version}</span><span class="lang-en">${used.size} icons from Font Awesome Free ${pkg.version}</span></h1>
        <p class="muted max-w-2xl"><span class="lang-ar">مولّدة وقت البناء في ملف رموز واحد (tools/build-icons.mjs)، اللون من currentColor، الأحجام 16 و20 و24 بكسل. النمط Solid لأيقونات الواجهة، وBrands لحسابات التواصل فقط. الأسهم تنعكس مع اتجاه اللغة. الترخيص: CC BY 4.0 (انظر NOTICE).</span><span class="lang-en">Built at build time into one sprite (tools/build-icons.mjs), coloured by currentColor, sizes 16 / 20 / 24 px. Solid for interface icons, Brands for social accounts only. Arrows mirror with the reading direction. Licence: CC BY 4.0 (see NOTICE).</span></p>
      </div>
    </section>
${Object.entries(groups).filter(([, ids]) => ids.length).map(([g, ids]) => `    <section class="section pt-0" aria-label="${g}">
      <div class="wrap">
        <h2 class="t-title mb-6">${g} <span class="muted">· ${ids.length}</span></h2>
        <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 list-none p-0 m-0">
${ids.map(cell).join("\n")}
        </ul>
      </div>
    </section>`).join("\n")}
  </main>`;
  const out = html.replace(/  <main id="main">[\s\S]*?  <\/main>/, main);
  if (out !== html) writeFileSync(page, out);
}
