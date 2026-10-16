// Renders data-driven sections into the static pages at build time (first step of `npm run build`).
// Each section lives between markers   <!-- build:NAME -->  …  <!-- /build:NAME -->   and is regenerated from JSON on
// every build, so content changes are data-only. Output uses unhashed asset paths; tools/fingerprint.mjs rewrites them.
//   data/home.json          → hero-slides, highlights, explore (statement + quick links), makkah, gallery-teaser (index)
//   data/gallery-al-taj.json→ gallery (catering, full) and gallery-teaser (index, featured subset) + the lightbox dialog
//   data/hotels.json        → hotel-filters (index: ARIA tablists derived from the data)
//   data/site.json          → social (footer of every public page)
//   data/pages.json         → quick links / links to unpublished pages are not rendered
import { readFileSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";

const ROOT = "frontend";
const J = (p) => JSON.parse(readFileSync(join(ROOT, "data", p), "utf8"));
const home = J("home.json"), gallery = J("gallery-al-taj.json"), hotels = J("hotels.json"), site = J("site.json");
const pages = J("pages.json").pages;
const unpublished = new Set(pages.filter((p) => !p.published).map((p) => p.path));

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const bi = (o) => `<span class="lang-ar">${esc(o.ar)}</span><span class="lang-en">${esc(o.en)}</span>`;
const AR_WORDS = { 1: "فندق واحد", 2: "فندقان", 3: "ثلاثة فنادق", 4: "أربعة فنادق", 5: "خمسة فنادق", 6: "ستة فنادق", 7: "سبعة فنادق", 8: "ثمانية فنادق", 9: "تسعة فنادق", 10: "عشرة فنادق" };
const AR_DIGITS = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
const N = hotels.hotels.length;
const num = (n) => `<span class="num"><span class="lang-ar">${AR_DIGITS(n)}</span><span class="lang-en">${n}</span></span>`;

/* asset paths are written relative to each page (prefix "" for root pages, "../" for hotels/*) */
let P = "";
const url = (src) => P + src.replace(/^\//, "");
const icon = (id, cls = "") => `<svg class="icon ${cls}" aria-hidden="true"><use href="${url("assets/icons/sprite.svg")}#${id}"/></svg>`;
function img(sizes, { alt = "", cls = "", sizesAttr = "100vw", loading = "lazy", priority = false, extra = "" } = {}) {
  const s = [...sizes].sort((a, b) => a.width - b.width);
  const fallback = s.find((x) => x.width >= 1000) || s[s.length - 1];
  return `<img src="${url(fallback.src)}" srcset="${s.map((x) => `${url(x.src)} ${x.width}w`).join(", ")}" sizes="${sizesAttr}" width="${fallback.width}" height="${fallback.height}" alt="${esc(alt)}"${cls ? ` class="${cls}"` : ""} ${priority ? 'fetchpriority="high" loading="eager"' : `loading="${loading}"`} decoding="async"${extra}>`;
}

/* ---------------------------------------------------------------- sections */
const S = {};

S["hero-slides"] = () => {
  const h = home.hero;
  return `<div class="hero-slides opacity-50" data-slideshow data-interval="${h.interval_ms}" data-fade="${h.fade_ms}">
          ${h.slides.map((sl, i) => img(sl.sizes, { alt: "", cls: `hero-slide${i === 0 ? " is-current" : ""}`, priority: i === 0, extra: ` data-slide="${i}"` })).join("\n          ")}
        </div>`;
};

S["hero-pause"] = () => `<button type="button" class="hero-pause btn btn--icon" data-slideshow-toggle aria-pressed="false" data-label-pause="إيقاف عرض الصور مؤقتًا" data-label-play="تشغيل عرض الصور" aria-label="إيقاف عرض الصور مؤقتًا">
          ${icon("pause", "only-playing")}${icon("play", "only-paused")}
        </button>`;

S["highlights"] = () => {
  const h = home.highlights, n = h.items.length;
  const title = (t) => ({ ar: t.ar.replace("{n_words}", AR_WORDS[N] || `${AR_DIGITS(N)} فنادق`), en: t.en.replace("{n}", N) });
  return `<section class="section" id="why" aria-labelledby="whyTitle">
      <div class="wrap">
        <span class="eyebrow reveal">${bi(h.eyebrow)}</span>
        <h2 id="whyTitle" class="t-headline mb-8" data-split="lines">${bi(h.title)}</h2>
        <div class="hl reveal" data-feature-slider aria-roledescription="carousel" aria-labelledby="whyTitle">
          <div class="hl__media">
            ${h.items.map((it, i) => img(it.image.sizes, { alt: it.image.alt.ar, cls: `hl__img${i === 0 ? " is-current" : ""}`, sizesAttr: "(min-width: 1024px) 50vw, 100vw", extra: ` data-slide="${i}" data-alt-en="${esc(it.image.alt.en)}"` })).join("\n            ")}
          </div>
          <div class="hl__body">
            <div class="hl__viewport">
              <div class="hl__track">
                ${h.items.map((it, i) => `<article class="hl__item" data-slide="${i}" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${n}">
                  <span class="icon-box" aria-hidden="true">${icon(it.icon)}</span>
                  <h3 class="t-title mb-2">${bi(title(it.title))}</h3>
                  <p class="muted">${bi(it.text)}</p>
                </article>`).join("\n                ")}
              </div>
            </div>
            <div class="hl__nav">
              <button type="button" class="btn btn--icon" data-slide-prev aria-label="السابق">${icon("arrow-start", "icon--flip")}</button>
              <span class="hl__count num" aria-live="polite" data-slide-count>1 / ${n}</span>
              <button type="button" class="btn btn--icon" data-slide-next aria-label="التالي">${icon("arrow-end", "icon--flip")}</button>
            </div>
          </div>
        </div>
      </div>
    </section>`;
};

S["explore"] = () => {
  const st = home.statement, q = home.quicklinks;
  const items = q.items.filter((it) => !(it.page && unpublished.has(it.page)));
  return `<section class="section pt-0" id="explore" aria-labelledby="exploreTitle">
      <div class="wrap">
        <div class="statement panel relative overflow-hidden reveal">
          <div class="kufic-field kufic-field--abs start-auto hidden lg:grid" data-kufic data-cols="2" data-block="48" aria-hidden="true"></div>
          <div class="statement__copy relative z-10">
            <p class="statement__text t-headline">${bi(st.text)}</p>
            <span class="rule" aria-hidden="true"></span>
            <p class="muted">${bi(st.sub)}</p>
          </div>
        </div>
        <h2 id="exploreTitle" class="t-title mt-16 mb-8 reveal">${bi(q.title)}</h2>
        <ul class="qtiles" role="list">
          ${items.map((it) => `<li class="reveal"><a class="qtile" href="${it.href}"${it.modal ? ` data-modal-open="${it.modal}"` : ""}>
            ${img(it.image.sizes, { alt: "", cls: "qtile__img", sizesAttr: "(min-width: 1024px) 25vw, 50vw" })}
            <span class="qtile__veil" aria-hidden="true"></span>
            <span class="qtile__label">${icon(it.icon, "qtile__icon")}<span class="t-title">${bi(it.label)}</span></span>
          </a></li>`).join("\n          ")}
        </ul>
      </div>
    </section>`;
};

S["makkah"] = () => {
  const m = home.makkah;
  const minWalk = Math.min(...hotels.hotels.map((h) => h.walk_minutes).filter((x) => typeof x === "number"));
  const derived = { "hotels.min_walk": minWalk, "hotels.count": N, "hotels.min_price": Math.min(...hotels.hotels.map((h) => h.price_from_sar).filter((x) => typeof x === "number")) };
  const fact = (f) => {
    const v = f.value_from ? derived[f.value_from] : f.value;
    return `<li class="makkah__fact">
              <span class="icon-box" aria-hidden="true">${icon(f.icon)}</span>
              <span>${v === null || v === undefined ? `<span class="makkah__value makkah__value--todo" title="TODO_CONTENT">—</span>` : `<span class="makkah__value num"><span class="lang-ar">${AR_DIGITS(v)}</span><span class="lang-en">${v}</span></span>`}
              <span class="muted">${bi(f.label)}</span></span>
            </li>`;
  };
  return `<section class="section" id="makkah" aria-labelledby="makkahTitle">
      <div class="wrap">
        <div class="makkah panel relative overflow-hidden">
          <div class="makkah__copy relative z-10 reveal">
            <span class="eyebrow">${bi(m.eyebrow)}</span>
            <h2 id="makkahTitle" class="t-headline mb-4" data-split="lines">${bi(m.title)}</h2>
            <p class="muted max-w-xl">${bi(m.text)}</p>
          </div>
          <ul class="makkah__facts relative z-10" role="list">
            ${m.facts.filter((f) => f.value_from || (f.value !== null && f.value !== undefined)).map(fact).join("\n            ")}
          </ul>
          <div class="makkah__pattern kufic-field kufic-field--strip h-[104px]" data-kufic data-rows="1" data-block="40" aria-hidden="true"></div>
        </div>
      </div>
    </section>`;
};

S["hotel-filters"] = () => {
  const F = hotels.filters;
  const matches = {
    rating: (o) => hotels.hotels.some((h) => (o.stars === null ? h.stars === null || h.stars === undefined : h.stars === o.stars)),
    walk: (o) => hotels.hotels.some((h) => h.walk_minutes >= (o.min ?? 0) && h.walk_minutes <= (o.max ?? 1e9)),
  };
  const group = (key) => {
    const g = F[key], opts = g.options.filter(matches[key]);
    const attrs = (o) => key === "rating" ? `data-stars="${o.stars === null ? "none" : o.stars}"` : `data-min="${o.min ?? 0}" data-max="${o.max ?? ""}"`;
    return `<div class="hfilters__group">
            <span class="t-label" id="hf-${key}">${bi(g.label)}</span>
            <div class="hfilters__tabs" role="tablist" aria-labelledby="hf-${key}" data-filter-group="${key}">
              <button type="button" class="chip is-active" role="tab" aria-selected="true" aria-controls="hotelGrid" data-filter="all">${bi(F.all)}</button>
              ${opts.map((o) => `<button type="button" class="chip" role="tab" aria-selected="false" tabindex="-1" aria-controls="hotelGrid" data-filter="${o.id}" ${attrs(o)}>${key === "rating" && o.stars ? `<span class="stars" aria-hidden="true">${icon("star").repeat(o.stars)}</span>` : ""}${bi(o.label)}</button>`).join("\n              ")}
            </div>
          </div>`;
  };
  return `<div class="hfilters reveal">
          ${group("rating")}
          ${group("walk")}
        </div>
        <div class="hcar" data-carousel>
          <div class="hcar__viewport" id="hotelGrid" data-track tabindex="0" role="region" aria-roledescription="carousel" aria-label="فنادق المجموعة"></div>
          <p class="muted hcar__empty" data-carousel-empty hidden>${bi(F.empty)}</p>
          <div class="hcar__nav">
            <button type="button" class="btn btn--icon" data-carousel-prev aria-label="الفندق السابق">${icon("arrow-start", "icon--flip")}</button>
            <span class="hcar__status num" data-carousel-status aria-live="polite"></span>
            <button type="button" class="btn btn--icon" data-carousel-next aria-label="الفندق التالي">${icon("arrow-end", "icon--flip")}</button>
          </div>
        </div>`;
};

function galleryMarkup({ items, id, headingTag = "h2", full }) {
  const g = gallery;
  const cats = g.categories.filter((c) => items.some((it) => it.category === c.id));
  const count = (c) => items.filter((it) => it.category === c).length;
  const more = !full && home.gallery_teaser && !unpublished.has("catering.html")
    ? `<a class="btn btn--secondary mt-8" href="${home.gallery_teaser.more_href}">${bi(home.gallery_teaser.more_label)} (${num(g.items.length)})${icon("arrow-end", "icon--sm icon--flip")}</a>` : "";
  return `<section class="section" id="${id}" aria-labelledby="${id}Title">
      <div class="wrap">
        <span class="eyebrow reveal">${bi(g.subtitle)}</span>
        <${headingTag} id="${id}Title" class="t-headline mb-4" data-split="lines">${bi(g.title)}</${headingTag}>
        <p class="muted max-w-2xl mb-8 reveal">${bi(g.intro)}</p>
        <div class="tabs gallery-tabs reveal" role="tablist" aria-label="تصفية الصور" data-gallery-filters>
          <button type="button" class="tab" role="tab" aria-selected="true" aria-controls="${id}Grid" data-filter="all">${bi({ ar: "الكل", en: "All" })} <span class="muted">${num(items.length)}</span></button>
          ${cats.map((c) => `<button type="button" class="tab" role="tab" aria-selected="false" tabindex="-1" aria-controls="${id}Grid" data-filter="${c.id}">${bi(c)} <span class="muted">${num(count(c.id))}</span></button>`).join("\n          ")}
        </div>
        <ul class="gallery-grid" id="${id}Grid" role="list" data-gallery="${id}">
          ${items.map((it) => `<li class="gallery-item" data-category="${it.category}">
            <button type="button" class="gallery-thumb" data-lightbox="${esc(it.id)}" aria-haspopup="dialog">
              ${img(it.sizes, { alt: it.alt.ar, cls: "gallery-thumb__img", sizesAttr: "(min-width: 1024px) 25vw, 50vw", extra: ` data-alt-en="${esc(it.alt.en)}"` })}
              <span class="gallery-thumb__zoom" aria-hidden="true">${icon("plus")}</span>
            </button>
          </li>`).join("\n          ")}
        </ul>
        <p class="muted mt-4 gallery-empty" hidden>${bi({ ar: "لا توجد صور في هذه الفئة.", en: "No photos in this category." })}</p>
        ${more}
      </div>
    </section>`;
}

S["gallery"] = () => galleryMarkup({ items: gallery.items, id: "gallery", full: true });
S["gallery-teaser"] = () => {
  const ids = home.gallery_teaser.items;
  return galleryMarkup({ items: ids.map((i) => gallery.items.find((x) => x.id === i)).filter(Boolean), id: "gallery", full: false });
};

/* one lightbox per page; its slides are the gallery items rendered on that page (data in a JSON script) */
S["lightbox"] = () => {
  const data = gallery.items.map((it) => ({ id: it.id, category: it.category, alt: it.alt, sizes: it.sizes.map((s) => ({ src: url(s.src), width: s.width, height: s.height })) }));
  return `<dialog class="lightbox" id="lightbox" aria-modal="true" aria-labelledby="lightboxCaption" data-lightbox-dialog>
    <div class="lightbox__bar">
      <span class="lightbox__count num" data-lightbox-count aria-live="polite"></span>
      <button type="button" class="btn btn--icon lightbox__close" data-lightbox-close aria-label="إغلاق">${icon("close")}</button>
    </div>
    <figure class="lightbox__figure">
      <div class="lightbox__stage" data-lightbox-stage>
        <img class="lightbox__img is-current" alt="" data-lightbox-img>
        <img class="lightbox__img" alt="" data-lightbox-img aria-hidden="true">
      </div>
      <figcaption class="lightbox__caption" id="lightboxCaption" data-lightbox-caption></figcaption>
    </figure>
    <button type="button" class="btn btn--icon lightbox__nav lightbox__nav--prev" data-lightbox-prev aria-label="الصورة السابقة">${icon("arrow-start", "icon--flip")}</button>
    <button type="button" class="btn btn--icon lightbox__nav lightbox__nav--next" data-lightbox-next aria-label="الصورة التالية">${icon("arrow-end", "icon--flip")}</button>
    <script type="application/json" data-lightbox-data>${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
  </dialog>`;
};

S["social"] = () => `<div class="social">
          <h3 class="t-label mb-2">${bi(site.social_title)}</h3>
          <ul class="social__list" role="list">
            ${site.social.map((s) => s.url
              ? `<li><a class="social__link" href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(s.label.ar)}">${icon(s.id)}</a></li>`
              : `<li><span class="social__link is-pending" aria-disabled="true" role="img" aria-label="${esc(s.label.ar)} — ${esc(site.social_pending.ar)}" title="${esc(s.label.en)} — ${esc(site.social_pending.en)}">${icon(s.id)}</span></li>`).join("\n            ")}
          </ul>
        </div>`;

/* ---------------------------------------------------------------- apply */
const FILES = ["index.html", "about.html", "catering.html", "hotels/taj-park.html"];
let total = 0;
for (const f of FILES) {
  P = "../".repeat(f.split("/").length - 1);
  const path = join(ROOT, f);
  let html = readFileSync(path, "utf8"), before = html, n = 0;
  html = html.replace(/<!-- build:([a-z-]+) -->[\s\S]*?<!-- \/build:\1 -->/g, (m, name) => {
    if (!S[name]) throw new Error(`${f}: unknown section "${name}"`);
    n++;
    return `<!-- build:${name} -->\n    ${S[name]()}\n    <!-- /build:${name} -->`;
  });
  total += n;
  if (html !== before) writeFileSync(path, html);
  console.log(`build-sections: ${f} → ${n} section(s)`);
}
if (!total) console.warn("build-sections: no markers found");
