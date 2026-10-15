# Changelog — visual overhaul v2

Branch `overhaul/phase-1` → `main`. Eight phases, each reviewed and approved by Badr before the next.

## Foundation
- **Bootstrap → Tailwind CSS v4** (CLI build, committed `dist/site.css`, 9.5 KB gzip). jQuery, Font Awesome, Cairo and every CDN
  removed; GSAP, Lenis, Three.js and EmailJS are vendored. Logical (RTL-safe) CSS only.
- **Brand tokens and 8 themes:** 4 palettes (default, green, red, blue) × light/dark, chosen by a pre-paint script (no flash),
  stored in the existing theme keys plus `deafah-palette`; 200 ms crossfade on switch; radius 0, 1.5 px borders, 4/8/16/32/64 spacing.
- **Almarai self-hosted** (woff2, OFL) with a metric-matched Arial fallback.

## Brand
- **Logo system** (`js/brand-logo.js`): byte-identical copies of the brand files, chosen by scheme × direction × lockup,
  fixed mount boxes (0 layout shift), 200 px header lockup, symbol on phones, NEG stacked logo in the footer.
- **Theme switcher badge**, keyboard operable, at the logical bottom-start corner.
- **Kufic pattern** in whole 2×2 blocks only: drifting canvas column on desktop, static CSS-mask field on phones.
- **Icon set:** 48 symbols on the 1.5 px Kufic module, `currentColor`, logical arrow pair; review sheet at `dev/icons.html`.
- Favicons and OG image generated from the symbol and stacked masters.

## Motion
- Lenis smooth scroll driving ScrollTrigger; scene recipes by attribute: pinned hero, layered cards with image masks,
  horizontal hotel roster (desktop), sticky media, counters with Arabic-Indic digits, SplitText line reveals.
- Direction-aware (mirrors in RTL), rebuilt on language change, fully static under reduced motion.

## Taj Park 3D
- Procedural Three.js model from the OpenStreetMap footprint (way 1489087118) and the group's own photos: glass cylinder,
  two arcaded sandstone wings, glass podium with lit interiors, canopy, 41 neighbouring buildings, day/night lighting by scheme.
- Lazy loaded within one viewport; posters for reduced motion, save-data and no-WebGL; adaptive quality on slow devices;
  on phones it starts on the first interaction. GLB drop-in path (`data-model`) for a future modelled asset.

## Pages
- **Home and About** rebuilt on the new system; hotel roster from `data/hotels.json` (single source, live count).
- **New: `hotels/taj-park.html`** — the 3D building pinned behind hero → facts → rooms, availability request into the existing
  contact dialog, room tabs, packages, dining, amenities, walking-time widget, gallery, guest words, FAQ, nearby hotels,
  floating WhatsApp/call.
- **New: `catering.html` (الإعاشة)** — packages, a sample day's menu, capacity counters, compliance badges, gallery, quote request.
- Both new pages run on test data (`data/mock/`, ribbon on the page) and ship **unpublished** (`data/pages.json`): hidden from
  nav, footer and sitemap, `noindex`, reachable by direct URL.

## Delivery and QA
- Fingerprinted assets (`name.<hash>.ext`) with immutable caching; HTML and data `no-cache`; Netlify serves the committed HTML byte-for-byte.
- QA tooling in `tools/`: greps, case check, contrast report, screenshot matrix, CLS under real input, keyboard walkthrough,
  served-vs-committed hash check.
- Lighthouse mobile: Performance 95 / 97 / 95 / 99 and Accessibility 100 on home / about / Taj Park / catering
  (details in `QA_REPORT.md`).

## Open before production
Catering photography, real content for the two hidden pages, a WhatsApp-capable number (see `BRAND_GAPS.md`, status
**blocking**). Production origin: `https://deafah.netlify.app`, set once in `data/pages.json`, with canonical and OG URLs derived from it.
