# Al Deafah International Group — website

Static, Arabic-first (RTL) site for مجموعة الضيافة العالمية. Plain HTML + Tailwind CSS v4 (CLI build), vanilla JS,
GSAP + ScrollTrigger + SplitText and Lenis for motion, Three.js for the Taj Park model. No framework, no CDN at runtime.

Everything that is served lives in `frontend/`. Build output (`frontend/dist/site.css`, `frontend/vendor/three.min.js`,
fingerprinted copies, `sitemap.xml`, `robots.txt`) is **committed**, so the committed HTML is exactly what Netlify serves.

## Requirements

- Node 24 (`.nvmrc`), npm
- Python 3 for the local static server (any static server works)
- Google Chrome for the QA tools in `tools/` (path from `CHROME`, default `C:\Program Files\Google\Chrome\Application\chrome.exe`)

## Run locally

```sh
npm ci
npm run build                          # css → three → meta (sitemap, publication switch) → fingerprint
python -m http.server 8787 -d frontend # http://127.0.0.1:8787/
```

While editing styles: `npm run watch:css`, then `npm run build` before committing (fingerprinting must run last).

## Build steps

| Script | What it does |
|---|---|
| `build:css` | Tailwind v4 CLI: `frontend/src/styles/site.css` → `frontend/dist/site.css` (minified) |
| `build:three` | esbuild bundle of Three.js core + GLTFLoader → `frontend/vendor/three.min.js` |
| `build:meta` | applies `frontend/data/pages.json` (see *Publishing a page*), writes `sitemap.xml` and `robots.txt` |
| `build:fingerprint` | renames every referenced asset to `name.<sha256:8>.ext`, rewrites HTML/CSS/JS/JSON, writes `dist/asset-manifest.json`, prunes stale copies; idempotent |
| `build:icons-sheet` | regenerates the icon contact sheet `frontend/dev/icons.html` from `assets/icons/sprite.svg` (run `build` afterwards) |
| `build` | all of the above except the icon sheet, in order |

## Publishing a page

`frontend/data/pages.json` holds one `"published"` flag per page. While a page is unpublished, the build wraps every
link to it in `<template data-unpublished>` (not rendered, not crawled), adds `noindex`, leaves it out of the sitemap,
and — for a hotel page — removes the card's `details_url`, so «عرض التفاصيل» opens the contact dialog instead.
To publish: set `"published": true`, run `npm run build`, commit. Today `hotels/taj-park.html` and `catering.html`
are unpublished until real content replaces `frontend/data/mock/` (see `BRAND_GAPS.md`, items marked *blocking*).

## QA

| Command | Checks |
|---|---|
| `npm run qa` | `qa:grep` (no Bootstrap / CDN / icon fonts / emoji / physical-direction CSS / hard-coded hex / brand-folder references / inline SVG drawings; arrows carry `.icon--flip`; hotel cards are photographs; publication switch honoured; inline pre-paint script = `js/theme-boot.js`), `qa:case` (every referenced path exists with the same case), `qa:contrast` (writes `CONTRAST_REPORT.md`) |
| `npm run qa:served [url]` | served bytes = committed bytes (sha256) for the pages, sitemap, robots and data files on the preview |
| `node tools/shoot.mjs --matrix <dir> --lang ar\|en --pages a.html,b.html` | full-page captures for 4 palettes × light/dark × 390/1440, console messages, document width (overflow) |
| `node tools/shoot.mjs --url <url> --cls` | CLS under real input: scheme / palette / language toggles, badge, scroll |
| `node tools/qa-keyboard.mjs --lang ar\|en` | keyboard-only walkthrough: tab order, theme badge, phone menu, FAQ, contact dialog (focus kept inside), phone input |

On Windows, launch the Chrome-based tools from PowerShell (Chrome started from Git Bash may never open its DevTools
port). `SHOOT_GPU=1` keeps GPU compositing for captures over the WebGL canvas; `--net slow4g --cpu 4` emulates a slow phone.

## Deploy

Netlify site `deafah`, configured entirely by `netlify.toml` (build `npm run build`, publish `frontend`, Node 24,
post-processing off so HTML is served byte-for-byte). `frontend/_headers` sets the cache policy: HTML, data, sitemap
and the manifest are `no-cache`; fingerprinted folders (`dist/`, `js/`, `vendor/`, `assets/`, `imgs/`) are
`max-age=31536000, immutable`.

1. Work on a branch and push it: Netlify builds a branch deploy at `https://<branch>--deafah.netlify.app`.
2. Run `npm run qa:served https://<branch>--deafah.netlify.app` against that deploy.
3. Open a PR to `main`; merging deploys production.

## Repository map

- `frontend/` — the site (pages, `js/`, `src/styles/site.css`, `data/`, `assets/`, `imgs/`, `vendor/`, `dev/` review pages, noindex)
- `tools/` — build and QA scripts
- `brand-src/` — raster/font masters used to generate favicons, OG image and woff2 (not served)
- `docs/` — competitor notes, 3D model spec, screenshots per phase
- `archive/` — files moved out of `frontend/` in the Phase 8 cleanup (not served)
- `BRAND_GAPS.md`, `CONTRAST_REPORT.md`, `QA_REPORT.md`, `CHANGELOG.md`, `MIGRATION_PLAN.md` — decisions, audits and history
- `visualIdentityReferences/` — the brand folder; read-only, git-ignored, never referenced by the site
