# MIGRATION_PLAN.md — Al Deafah International Group website overhaul

Phase 0 deliverable (reconnaissance, no code changed). Status: **waiting for Badr's approval** before Phase 1.
Date: 2026-10-15. Repo: `Moonamor/deafah-official-website`, branch `main`. Site root (served folder): `frontend/` (assumption, see Q1).

Sources consulted, in precedence order: `visualIdentityReferences/` (read-only), the brief, and nothing else. The `al-deafah-brand` skill is **not available** in this environment; the folder's own docs (`01_Brand_Reference/*.md`, `09_Website/*`) were used as the written rules.

---

## 1. Repo inventory

### 1.1 Pages, partials, scripts

| Item | Finding |
|---|---|
| Pages | `frontend/index.html` (539 lines), `frontend/about.html` (621 lines). No partials/templating: header, footer, contact modal and `<script>` block are **duplicated by hand** in both pages. |
| Languages | Bilingual by duplication: every string exists twice as `<span class="lang-ar">` / `<span class="lang-en">`; CSS hides the inactive one via `[data-lang]`. `<html lang="ar" dir="rtl" data-theme="light" data-lang="ar">` is hardcoded. |
| CSS | `css/styles.css` (1501 lines, Bootstrap-era), `css/liquid-glass.css` (214, blur/glass/blobs/shimmer), `css/phone-input.css` (270). All three loaded on both pages. |
| CDN runtime deps (to remove) | Bootstrap 5.3.8 CSS+JS (jsdelivr), jQuery 3.7.1, Font Awesome 6.7.2 (cdnjs), Google Fonts **Cairo**, GSAP 3.12.5 + ScrollTrigger (cdnjs), `@emailjs/browser@4` (jsdelivr). |
| JS | `main.js` (jQuery: theme/lang toggles, header condense, smooth anchors, guest stepper, chips, booking + newsletter fake submits, Bootstrap modal reset), `auto-theme-manager.js` (the time-of-day script, see 1.2), `effects.js` (jQuery: blob parallax, card tilt, stat counters, `DeafahEffects.showToast`), `animations.js` (GSAP reveals, magnetic buttons, hero parallax), `chairman-canvas.js` + `chairman-hero.js` (about page only), `countries-data.js` + `phone-input.js` (custom intl phone field, vanilla, injects two Font Awesome `<i>` icons), `contact-form.js` (EmailJS handler, vanilla; reads `config.json`). |
| Config | `frontend/config.json`: EmailJS keys, selectors `#contactForm`, `#contactModal`, `#contactModal button[type="submit"][form="contactForm"]`, field base ids `contactName/contactEmail/contactPhone/contactMessage` (resolved as `<id>-ar` / `<id>-en`), bilingual messages. **These selectors/ids must survive the rebuild.** |
| Build | None. No `package.json`, no bundler, no sitemap, no robots, no deploy config, no CI. Node v24.12 / npm 11.6 / Python 3.11 (+Pillow) are available on this machine. GitHub Pages is not enabled on the repo. |
| Working tree | 5 image files are **deleted but uncommitted**: `imgs/deafahLogo.png`, `imgs/deafahLogo-dark.png`, `imgs/deafahpanner.png`, `imgs/deafahpanner-dark.png`, `imgs/logo.png`. They are still referenced (`--deafah-logo`, `--background-img-panner`, favicon) so the live tree currently renders **no logo, no hero image, no favicon**. The overhaul replaces all five. |
| Images | `imgs/hotel-pics/` 6 JPGs (Amjad 2420×1936 390 KB, bustan 3343×2675 949 KB, taj 3500×2625 554 KB, diar/lav 681×545, saraya 341×273); `imgs/mr.ailayyash.png` 806×604 355 KB. **Case bug:** HTML references `Saraya.JPG`, `Diar.JPG`, `Bustan.JPG` but files are `saraya.jpg`, `diar.jpg`, `bustan.JPG` → broken on case-sensitive hosts. |

### 1.2 The theming script (base to extend, never replace)

`frontend/js/auto-theme-manager.js` — IIFE, no public object. Behaviour and storage keys:

| Key / constant | Value | Meaning |
|---|---|---|
| `localStorage["deafah-theme"]` | `"light"` \| `"dark"` | the applied scheme; mirrored to `<html data-theme>` |
| `localStorage["deafah-theme-mode"]` | `"auto"` \| `"manual"` | `manual` is set (via `setTimeout(…,0)`) when `#themeToggle` is clicked |
| `localStorage["deafah-theme-last-check"]` | ms timestamp | last auto evaluation |
| `DAY_START_HOUR / DAY_END_HOUR` | 6 / 18 | light between 06:00 and 18:00 local, else dark |
| `REFRESH_INTERVAL_HOURS` | 6 | an auto re-check happens only if the last check is ≥ 6 h old; **note:** the re-check runs even when mode is `manual` (any visit > 6 h after the override resets to auto). This is the existing behaviour; I will keep it unless told otherwise (Q2). |
| Toggle selector | `#themeToggle` | |

`main.js` duplicates part of this: it also reads/writes `deafah-theme` on load and on toggle, and owns `localStorage["deafah-lang"]` (`"ar"`/`"en"`, sets `lang`, `dir`, `data-lang`). Both scripts run at DOMContentLoaded → there is **no pre-paint**, so a dark user sees a light flash (`data-theme="light"` is hardcoded in HTML). Also `:root` declares `color-scheme: light` and then `color-scheme: dark` (the latter wins in light mode).

**Naming conflict with the brief:** today `data-theme` means *light/dark*. The brief wants `data-theme="default|green|red|blue"` and `data-scheme="light|dark"`. Proposed resolution (Q2): `data-scheme` takes over the light/dark role and keeps reading/writing the existing `deafah-theme` key (so stored preferences keep working); the palette becomes `data-theme` with a new key `deafah-palette` (default `"default"`), and `deafah-theme-mode` keeps its auto/manual meaning for the scheme.

### 1.3 Hotels and Taj Park

Hotels are **hardcoded HTML** in `index.html#hotels` (6 `article.hotel-card` inside a Bootstrap grid, no data file). Each has a `button.btn-ghost` «عرض التفاصيل / View Details» with no handler. Taj Park is card 5 (`index.html:328-347`): image `imgs/hotel-pics/taj.JPG`, "rating pending", "10 min walk", "from SAR 180". The page claims **14** hotels (nav button, stats, meta description) while `about.html` says **13** everywhere (Q9). The old `imgs/taj-park/GV0A8124.JPG`, `GV0A8125.JPG` photos were deleted in commit `228d857`.

### 1.4 Existing CSS custom properties (all replaced by the brand tokens)

`--color-bg #fcfaf6`, `--color-bg-alt #f2ece0`, `--color-surface #fff`, `--color-on-surface #201a13`, `--color-accent #b89047`, `--color-accent-light #8a6a30`, `--color-accent-secondary #e3c598`, `--color-error #d9534f`, `--color-success #6b8e23`, glass border/highlight rgba's, dark set (`#161311`, `#1c1815`, `#231e1b`, `#eae3d9`, `#d4b06a`), spacing `--space-1…24`, radii `8/14/20/28/999px`, `--duration-fast/base/slow 220/380/620ms`, `--container-max 1320px`, `--header-height 84px`. **None of these colours are brand colours**; the whole set goes.

---

## 2. `visualIdentityReferences/` inventory and copy list

Rules applied: copy only what the site needs; byte-for-byte; logo files never recoloured; nothing is served from the reference folder. Target folder for brand files: `frontend/assets/brand/` (the site has no existing brand folder; `imgs/` holds photos only). Build-time-only sources go to a repo-root `brand-src/` that is **outside the served folder**.

### 2.1 Files to COPY (awaiting approval)

| Source (in `visualIdentityReferences/`) | Type | Colourway | Dir | Format / size | Target (new name) | Use |
|---|---|---|---|---|---|---|
| `02_Logo/SVG/AlDeafah-International-Group-CMYK.svg` | stacked | gradient gold + black name (positive) | n/a | SVG 404.0×328.8 (45 KB) | `frontend/assets/brand/logo/logo-stacked-pos.svg` | footer/OG on light panels (if Q7 says footer follows surface) |
| `02_Logo/SVG/AlDeafah-International-Group-NEG-CMYK.svg` | stacked | gradient gold + white name (NEG) | n/a | SVG 404.0×328.4 (45 KB) | `…/logo/logo-stacked-neg.svg` | footer (dark panel), OG image |
| `02_Logo/SVG/AlDeafah-International-Group-Left_CMYK.svg` | horizontal-left | positive | LTR | SVG 606.5×172 (44 KB) | `…/logo/logo-ltr-pos.svg` | header, LTR, light |
| `02_Logo/SVG/AlDeafah-International-Group-Left_NEG_CMYK.svg` | horizontal-left | NEG | LTR | SVG 606.5×172 (44 KB) | `…/logo/logo-ltr-neg.svg` | header, LTR, dark |
| `02_Logo/SVG/AlDeafah-International-Group-Right_CMYK.svg` | horizontal-right | positive | RTL | SVG 587.2×172 (44 KB) | `…/logo/logo-rtl-pos.svg` | header, RTL, light (see Q3) |
| `02_Logo/SVG/AlDeafah-International-Group-Right_NEG_CMYK.svg` | horizontal-right | NEG | RTL | SVG 587.6×172 (44 KB) | `…/logo/logo-rtl-neg.svg` | header, RTL, dark (see Q3) |
| `03_Symbol/SVG/AlDeafah-International-Group-Symbol_CMYK.svg` | symbol | gradient gold | n/a | SVG 242.4×245.7 (16 KB) | `…/logo/symbol-pos.svg` | mobile header (<640 px), favicon source, card icon, theme badge chip |
| `03_Symbol/SVG/AlDeafah-International-Group-Symbol_BLACK.svg` | symbol | black | n/a | SVG 242.4×245.7 (3 KB) | `…/logo/symbol-black.svg` | Safari `mask-icon` (monochrome by spec) |
| `03_Symbol/SVG/AlDeafah-International-Group-Symbol_WHITE.svg` | symbol | white | n/a | SVG 242.4×245.7 (3 KB) | `…/logo/symbol-white.svg` | 3D poster / dark-only contexts where the gradient cannot render (canvas texture) — may end up unused; kept only if used |
| `03_Symbol/4x/AlDeafah-International-Group-Symbol_CMYK@4x.png` | symbol | gradient gold | n/a | PNG 2424×2457 (615 KB) | `brand-src/symbol-pos@4x.png` (not served) | raster source for favicon PNGs 16/32/48/180/192/512 and `favicon.ico` |
| `02_Logo/4x/AlDeafah-International-Group-NEG-CMYK@4x.png` | stacked | NEG | n/a | PNG 4040×3284 (868 KB) | `brand-src/logo-stacked-neg@4x.png` (not served) | raster source for the 1200×630 OG image (composition in Q10) |
| `04_Pattern/Tiles/ADIG_decor_pattern_SOLID GOLD_2x2.svg` | pattern 2×2 block | solid gold #BC9639 | n/a | SVG viewBox 81.553² = 28.77 mm (5 KB), 2×2 tiles, pitch 42.2 units | `frontend/assets/brand/pattern/kufic-2x2.svg` | the only pattern unit used (CSS field, canvas, 3D ground texture). Fill handling in Q4 |
| `12_Fonts/Almarai_OFL/Almarai-300/400/700/800.ttf` + `OFL.txt` | font | — | — | TTF 92–108 KB each | `frontend/assets/fonts/Almarai-*.ttf` + `OFL.txt` | self-hosted Arabic font (no Google Fonts CDN). woff2 conversion proposed in Q6 |

Total served brand payload ≈ 300 KB SVG (logos are cached, only 1–2 load per page) + ≈ 400 KB TTF (or ≈ 170 KB as woff2).

### 2.2 UNCLEAR (decision needed, nothing copied yet)

| Source | Why unclear | My recommendation |
|---|---|---|
| `02_Logo/SVG/*SOLID GOLD*.svg` (6 files, solid #BC9639) | Guidelines §1.2 reserve SOLID GOLD for foil/signage/packaging, but `02_Logo/RGB_designer/README.txt` says the designer's official RGB set ships the **Right** lockup only in SOLID GOLD (no Right CMYK RGB export exists; the `Right_CMYK.svg` is the pixel-verified rebuild from the .ai master). | Use `Right_CMYK` / `Right_NEG_CMYK` (gradient, identical treatment to the Left files) — Q3. |
| `03_Symbol/SVG/…Symbol_SOLID GOLD.svg` | Brief's favicon row says "black or gold-for-light"; at 16–32 px gradient vs solid is indistinguishable. | Favicon PNGs from `Symbol_CMYK@4x`; `mask-icon` from `Symbol_BLACK`. Not copying SOLID GOLD. |
| `10_Motion/*.mp4` (approved 6 s logo animation, NEG and CMYK, 3 sizes) | The brief does not ask for it; brand says the logo never animates except fade-in, and this is the approved exception. | Do **not** use (no autoplay video in a hero). Q8 if Badr wants an intro. |
| `09_Website/` (tokens.css, components.md, index.html) | Brand team's own web spec. Values already match the brief; the sample nav is 44 px high, which makes a horizontal lockup ≈150 px wide, **below** the approved 200 px minimum. | Adopt tokens as-is; header logo rendered at ≥ 200 px wide (≈ 59 px tall) on desktop, symbol 40 px on mobile. Nothing copied. |

### 2.3 IGNORE (treated as non-existent)

| Group | Files | Reason |
|---|---|---|
| `02_Logo/1x`, `02_Logo/4x` (except the one NEG@4x above), `02_Logo/PDF`, `02_Logo/RGB_designer` | 18 + 17 + 18 + 12 | SVG carries the same verified geometry/colours; PDFs are print; RGB set is a reference. |
| `02_Logo/SVG` BLACK / WHITE lockups (6) | — | one-colour versions are for fax/engraving/stamps (Guidelines §1.2). |
| `03_Symbol/1x`, `03_Symbol/4x` (other 3), `03_Symbol/PDF` | 4 + 3 + 4 | not needed. |
| `04_Pattern/SVG`, `/1x`, `/4x`, `/PDF`, `Tiles/*1x1*`, `Tiles/*_BLACK_/CMYK_/WHITE_2x2*`, `Tiles/*.pdf`, `Tiles/*.png` | full-sheet pattern files (3.2 MB CMYK SVG, 10 MB PNG) and other colourways | 2×2 block is the minimum unit; whole sheets would be cropped (forbidden). One geometry file suffices. |
| `05_Stationery`, `07_PowerPoint`, `08_Packaging` | print/office | not web. |
| `06_Social/**` (covers, posts, mail signature incl. `images/logo-*.png`, `pattern-*.png`) | derived composites | social, not site assets; signature PNGs are derivatives of the masters. |
| `ADIG_Canva_Upload_Pack/**` | duplicates of 02/03/04 + profile PNGs | duplicates. |
| `Al Deafah Hotels & Resorts Branding/**`, `AD Logos for Trademark…/**` | sub-brand identity | Brand Facts §1: sub-brands are **not** treated as existing; the site uses the group identity only. |
| `Al Deafah International Group Branding/**` (manuals, .ai-derived JPG/PNG, horse photos, business-card sources incl. `Avenir Next.ttc`) | source material | manuals already summarised in `01_Brand_Reference`; horse photographs are third-party-style imagery not committed; **Avenir Next.ttc is not bundled** (commercial, web licence unknown → `BRAND_GAPS.md`). |
| `01_Brand_Reference/*.md`, `.pdf` | docs | read, not copied. |

### 2.4 Brand facts verified against the folder

All palette, token, theme, geometry, type, pattern and minimum-size values in the brief match `ADIG_Brand_Facts.md`, `ADIG_Brand_Guidelines_AR.md` §2–§7 and `09_Website/tokens.css` exactly, including the four themes' panel/card/accent colours (§7.2) and the dark-mode border `#3A4350`. **One addition from the folder** the brief does not mention: Guidelines §4 define the pattern ink per scheme as `#8E732A` on white and `#D6AA42` on dark (that is what `tokens.css --pattern-ink` does) — see Q4. No conflicts found.

---

## 3. Bootstrap / third-party audit → replacement

| Current | Where | Replacement (vanilla + Tailwind v4) |
|---|---|---|
| Grid: `.container .row .col .col-12 .col-6 .col-md-* .col-lg-* .row-cols-* .g-3 .g-4 .g-lg-5 .align-items-center .m-2` | 8 grid blocks in index, 16 in about | Tailwind `grid grid-cols-… gap-4/8`, `.section` + `.wrap` component classes; logical spacing only |
| `.btn .btn-primary .btn-secondary .btn-ghost .btn-sm .btn-lg .btn-pill` (Bootstrap base + heavy overrides in styles.css) | 48 uses | `@layer components .btn` (+ `.btn--secondary`, `.btn--ghost`, `.btn--sm`, `.btn--lg`); radius 0, 1.5 px border, 200 ms |
| Modal (`.modal .fade .modal-dialog-centered .modal-content/-header/-body/-footer`, `data-bs-toggle="modal"`, `data-bs-dismiss`, `bootstrap.Modal.getInstance`) | contact modal on both pages; `main.js`, `contact-form.js` | native `<dialog id="contactModal">` + `js/contact-modal.js` (open via `[data-modal-open]`, close via `[data-modal-close]`, Esc, backdrop click, focus restore). Keep `id="contactModal"` and the submit-button selector from `config.json`. `contact-form.js` is **extended**: `closeModal()` gets a `dialog.close()` branch before the existing fallbacks (nothing else touched). New hidden `subject` input for the catering page. |
| Collapse (`.collapse .navbar-collapse .navbar-expand-xl`, `data-bs-toggle="collapse"`, `.show/.collapsing`) | mobile nav | `js/nav.js`: button toggles `aria-expanded` + `hidden` on `#primaryNav`; Esc closes; closes on link click |
| `.accordion-*` styles in styles.css | unused in HTML | deleted; the new FAQ uses `<details>`/`<summary>` with a 200 ms height transition |
| jQuery (`main.js`, `effects.js`) | both pages | ported to vanilla `js/main.js` / `js/effects.js` (same behaviour: lang toggle + `deafah-lang` key, header state, guest stepper, chips, fake booking/newsletter submits, `DeafahEffects.showToast` kept as the public API because `contact-form.js` calls it) |
| Font Awesome (`fa-*` ×38 incl. 2 injected by `phone-input.js`) | both pages | `assets/icons/sprite.svg` + `<svg><use href="assets/icons/sprite.svg#…">`; `phone-input.js` gets a 2-line edit to emit the sprite instead of `<i>` |
| Google Fonts Cairo | both | Almarai self-hosted (`@font-face`), Latin falls back to Arial |
| GSAP 3.12.5 CDN | both | `vendor/gsap/` 3.15.0 pinned (standard no-charge licence now covers SplitText, so it is included) |
| EmailJS SDK `@emailjs/browser@4` CDN | both | **Q5** — vendor locally as `vendor/emailjs/email.min.js` (it is an existing dependency, not a new one) |
| `liquid-glass.css` (blur, glass, blobs, shimmer, tilt), `.ambient-background`, inline `style="background-color: yellow"` blobs, chairman "liquid" SVG blobs | both | deleted entirely (glass/blur/glow are banned). The about page's chairman block is rebuilt as a `sticky-media` scene with the portrait + a Kufic field |
| Bootstrap `.toast`? | — | not Bootstrap; existing custom `#toast` kept, restyled |

Grep baselines to beat in Phase 8: `bootstrap|\.btn-|col-md|d-flex` → currently 60+ hits; `visualIdentityReferences` in site files → 0 already; physical direction properties in authored CSS → 8 (`left:/right:` in styles.css ×4, liquid-glass ×4).

---

## 4. File-by-file plan

### New (repo root)
`package.json` (`build:css`, `watch:css`, `build:icons`, `build:favicons`, `qa:grep`), `MIGRATION_PLAN.md` (this), `BRAND_GAPS.md`, `CONTRAST_REPORT.md`, `QA_REPORT.md`, `brand-src/` (2 PNG masters, not served), `tools/` (favicon/OG/poster generation in Python, checksum/overlay QA), `.gitignore` += `visualIdentityReferences/`, `node_modules/`.

### New (site root `frontend/`)
- `src/styles/site.css` → compiled `dist/site.css` (committed). `@theme` = brand tokens only; 8 theme×scheme token blocks on `html[data-theme][data-scheme]`; `@layer components`: `.btn .card .panel .section .eyebrow .wrap .kufic-field .chip .field`.
- `assets/brand/logo/*` (9 SVG), `assets/brand/pattern/kufic-2x2.svg`, `assets/brand/favicon/*` (generated), `assets/brand/og-image.png` (generated), `assets/fonts/Almarai-*`, `assets/icons/sprite.svg` (hand-drawn, Phase 7), `assets/3d/taj-park-poster.{webp,png}` (Phase 5), `imgs/hotel-pics/*-{640,1280,1920}.webp` (resized copies of the group's own photos; originals kept).
- `vendor/gsap/{gsap.min.js,ScrollTrigger.min.js,SplitText.min.js}`, `vendor/lenis/lenis.min.js`, `vendor/three/three.module.min.js` (+ `OrbitControls.js`), `vendor/emailjs/email.min.js` (Q5). Pinned: gsap 3.15.0, lenis 1.3.26, three 0.186.1, @emailjs/browser 5.0.3 (or keep v4 line — decide in Q5).
- `js/theme-boot.js` (inline pre-paint: reads the 3 existing keys + `deafah-palette` + `deafah-lang`, sets `data-scheme`, `data-theme`, `lang`, `dir` before CSS), `js/brand-logo.js`, `js/theme-badge.js`, `js/motion.js`, `js/canvas-kufic.js`, `js/taj-park-3d.js` (lazy, ES module), `js/nav.js`, `js/contact-modal.js`, `js/faq.js` (tiny), `js/i18n-digits.js` (Arabic-Indic digits for counters).
- `hotels/taj-park.html`, `catering.html`, `data/mock/taj-park.json`, `data/mock/catering.json`, `sitemap.xml`, `robots.txt`.

### Edited in place
- `index.html`, `about.html`: full markup rebuild (Tailwind utilities), same ids/content, new `<head>` (local CSS/JS only, favicons, OG), nav gains «تاج بارك» (under hotels) and «الإعاشة», Taj Park card's «عرض التفاصيل» → `hotels/taj-park.html`, hotel image paths fixed to real filenames/WebP.
- `js/auto-theme-manager.js`: **extended** — exposes `window.DeafahTheme = { getScheme, setScheme(light|dark|auto), getPalette, setPalette, subscribe }`, writes `data-scheme` (plus `data-theme` for the palette), keeps the three existing keys and their semantics, adds `deafah-palette`. The 6 h auto re-check and 06–18 window are untouched.
- `js/contact-form.js`: + `<dialog>` close branch, + optional `subject` param in the EmailJS payload (read from a hidden input if present). Nothing else.
- `js/phone-input.js`: 2 icon strings → sprite.
- `js/main.js`, `js/effects.js`, `js/animations.js`: rewritten without jQuery/glass (animations.js folds into `motion.js`).
- `config.json`: unchanged (selectors preserved by design).

### Deleted
`css/styles.css`, `css/liquid-glass.css`, `css/phone-input.css` (merged into `src/styles/site.css`), `js/chairman-canvas.js`, `js/chairman-hero.js` (replaced by data-scene recipes), the five already-deleted PNGs (deletion committed), Cairo/Bootstrap/FA/jQuery/CDN tags.

---

## 5. Logo → context mapping (Phase 2 lookup table, derived from §2.1)

| Context | Lockup | dir | scheme | File | Rendered size | Free zone |
|---|---|---|---|---|---|---|
| Header ≥ 640 px | horizontal | rtl | light | `logo-rtl-pos.svg` | width 200–240 px (h ≈ 59–70 px) | padding = 0.42 × symbol height (symbol = 61.8/172 of lockup height) |
| Header ≥ 640 px | horizontal | rtl | dark | `logo-rtl-neg.svg` | same | same |
| Header ≥ 640 px | horizontal | ltr | light / dark | `logo-ltr-pos.svg` / `logo-ltr-neg.svg` | same | same |
| Header < 640 px | symbol | any | any | `symbol-pos.svg` | 40 px | 17 px |
| Header condensed (after 80 px scroll) | horizontal stays ≥ 200 px wide; header 64 px tall | | | | | |
| Footer | stacked | any | any (footer panel is always the theme's dark colour → Q7) | `logo-stacked-neg.svg` | 160 px wide (≥ 120 min) | 0.42 × symbol h |
| Theme badge chip | none (colour dot + 40 px chip, no logo) | | | — | | |
| Card icon (services/amenities header) | symbol | any | any | `symbol-pos.svg` | 40 px | |
| Favicon / PWA icons | symbol | — | — | PNG 16/32/48/180/192/512 from `brand-src/symbol-pos@4x.png`; `mask-icon` = `symbol-black.svg` | | |
| OG image 1200×630 | stacked NEG on `#101820`, logo 320 px wide, centred, free zone kept | | | generated from `brand-src/logo-stacked-neg@4x.png` | | Q10 |
| Green/Red/Blue dark themes | the NEG files above (gradient gold symbol + white name) — per Guidelines §7.2 "NEG logo in all dark themes" | | | | | |

Swap on theme/scheme/lang change: `brand-logo.js` sets `src` + fixed `width/height` attributes per lockup, so no layout shift; `alt="مجموعة الضيافة العالمية"`.

---

## 6. Risks

1. **`data-theme` semantics change** (light/dark → palette). Mitigated by the key-compatible plan in 1.2; verified by a test with pre-seeded localStorage.
2. **Visual regression** on a complete markup rewrite with no tests: mitigated by per-page screenshot matrix (8 combos × 2 widths) in Phase 8 and by keeping all ids/anchors.
3. **Three.js payload** (`three.module.min.js` ≈ 700 KB raw / ≈ 170 KB compressed): within the 600 KB *transferred* budget only if the host compresses. GitHub Pages / Netlify / Vercel do; a bare Apache without gzip would not. Lazy-loaded, so the rest of the site is unaffected.
4. **OpenStreetMap footprint** for Taj Park may not exist → rectangular fallback flagged on the page.
5. **Avenir Next** not bundled → Arial; headline rhythm in English is slightly looser (gap logged).
6. **EmailJS from CDN** conflicts with the no-CDN rule (Q5).
7. **Case-sensitive image paths** are a latent production bug; fixed while rebuilding.
8. **Hotel count 14 vs 13** is content, not design; needs a decision (Q9).
9. **Hero "gradient veil"**: gradients are banned for UI; the brand's own exception is the 40 % black gradient under text on photographs (Guidelines §5). I will implement it exactly as that rule (black → transparent, bottom-up, ≤ 40 %) and log it.
10. **Lighthouse**: needs a local Chrome; if none is available I will report with the Lighthouse CLI's bundled Chromium or state that it was not run.

---

## 7. Open questions for Badr (answer inline; "ok" accepts the recommendation)

| # | Question | Recommendation |
|---|---|---|
| Q1 | Served folder is `frontend/` and tooling (`package.json`, `tools/`, `brand-src/`) may live at the repo root? Where is the site hosted (affects compression, see risk 3)? | yes / tell me the host |
| Q2 | Attribute plan: `data-scheme` = light/dark on the existing `deafah-theme` key; `data-theme` = palette on new `deafah-palette`. Keep the existing "auto re-check overrides a manual choice after 6 h" behaviour? | approve; keep the 6 h behaviour unchanged (it is what current users have) |
| Q3 | RTL header lockup: `Right_CMYK` (gradient) or `Right_SOLID GOLD` (what the designer's RGB set shipped)? | `Right_CMYK` / `Right_NEG_CMYK` |
| Q4 | Kufic pattern fill: (A) one geometry file, fill via `--pattern-ink` token `#8E732A` light / `#D6AA42` dark as the brand's own `tokens.css` does, or (B) the SOLID GOLD file's `#BC9639` unchanged everywhere? | A (brand web spec, better contrast control) |
| Q5 | Vendor EmailJS locally (`vendor/emailjs/`) to satisfy the no-CDN rule? Upgrade 4.x → 5.0.3 or keep the 4 line? | vendor; keep 4.x (no API change needed, zero risk) |
| Q6 | Almarai: serve the TTFs byte-for-byte (≈ 400 KB) or convert to woff2 (≈ 170 KB, lossless re-encoding, OFL allows it)? | woff2 + keep TTF copies in `brand-src/` |
| Q7 | Footer always on the theme's dark panel colour (NEG logo in all 8 combos, matches the brand homepage) or on `--surface` in light mode (positive stacked logo)? | always dark panel |
| Q8 | Use the approved 6 s logo animation MP4 anywhere (e.g. first-visit intro)? | no |
| Q9 | Hotel count: 14 (home) or 13 (about)? | tell me; I will not change content silently |
| Q10 | OG image: stacked NEG on `#101820`, 1200×630, logo 320 px wide centred, no text? | ok |
| Q11 | About page: the chairman section loses its blob/glass treatment and becomes a sticky-media scene (portrait + text steps). Acceptable? | yes |
| Q12 | Newsletter and booking widget stay as non-functional demos (toast only) as today? | yes, out of scope |

After approval I start Phase 1 with: `.gitignore` update → Tailwind CLI install → `src/styles/site.css` tokens → 8-combination token matrix → markup rebuild of `index.html` and `about.html` → Bootstrap removal → `CONTRAST_REPORT.md` → Phase 1 report.
