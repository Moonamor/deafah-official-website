# QA report — visual overhaul v2 (Phase 8)

Branch `overhaul/phase-1`, preview `https://overhaul-phase-1--deafah.netlify.app`, measured 2026-10-15.
Public pages: `index.html`, `about.html`, `catering.html`, `hotels/taj-park.html` (the last two ship **unpublished**, see
*Publication* below). Dev review pages (`dev/3d.html`, `dev/icons.html`) are excluded from the matrix and are `noindex`.
Evidence: `docs/screenshots/phase-8/`.

## Summary

| Area | Result |
|---|---|
| Visual matrix | 128 full-page captures (4 pages × 4 palettes × light/dark × 390/1440 × ar/en): 0 horizontal overflow, console empty on 126; the 2 remaining entries were a three.js shader-compiler warning, removed afterwards (console re-checked empty) |
| CLS under real input | 0 on every page at 390 and 1440 (8 runs × 13 steps: scheme, palette ×4, badge, language, scroll) |
| CLS during load (slow 4G, 4× CPU, 412/1440 px) | ≤ 0.0016 on home, about, Taj Park; 0.024 on catering at 412 px (packages render after the mock data arrives); all under the 0.1 "good" threshold |
| Reduced motion | 8/8 runs: every reveal visible, no pins, no split text, no running animations, Lenis off, 3D on its poster, console empty |
| Keyboard only | 18/18 checks in Arabic and 18/18 in English |
| Contrast | 104 text/UI pairs across the 8 themes, 0 failures (`CONTRAST_REPORT.md`) |
| Greps | all clean (list below) |
| Served = committed | sha256 equal for all 10 checked files |
| Lighthouse mobile | every target met (table below) |
| Cross-browser | 42/42 checks on Chrome 155, Firefox 132, WebKit 18.2 at 1440 and 390 |

## 1. Visual matrix

`node tools/shoot.mjs --matrix <dir> --lang ar|en --pages index.html,about.html,catering.html,hotels/taj-park.html`
with `SHOOT_GPU=1`. Results in `matrix/matrix.json`; 32 representative captures (default-light and blue-dark, every page,
both widths and languages) are committed, the full set stays out of git (≈ 110 MB).

- Logo files per state, all 64 desktop captures: ar-light `logo-rtl-pos.svg`, ar-dark `logo-rtl-neg.svg`, en-light `logo-ltr-pos.svg`,
  en-dark `logo-ltr-neg.svg`, footer `logo-stacked-neg.svg` everywhere.
- Home renders 6 hotel cards in every capture.
- Found and fixed during the matrix: the catering page overflowed by 4 px in English at 390 px (a quality chip with a long label);
  chips now wrap.
- Known capture artefact (since Phase 6): full-page captures show scrubbed scenes at progress 0, so the hero pin spacer and the
  layered card section appear as empty bands. Viewport captures at those scroll positions render normally.

## 2. CLS

Interaction (`--cls`, real CDP input, `hadRecentInput` semantics): total 0 for every page at 390 and 1440 —
`cls-*.json`. Load (`--net slow4g --cpu 4`, buffered layout-shift observer on the preview) — `load-cls.txt`:

| Page | 412 px | 1440 px |
|---|---|---|
| Home | 0.0002 | 0.0016 (nav text on font swap) |
| About | 0 | 0.0016 |
| Catering | 0.024 | 0 |
| Taj Park | 0 | 0.0016 |

Fixed in this phase: home 0.115 (the hero pin spacer was inserted after first paint; CSS now reserves the 60 vh and hands it
to the spacer), catering 0.464 (the hero intro was filled from JSON; it is now in the HTML), and the Arial → Almarai swap
(metric-matched local fallback, BRAND_GAPS G31).

## 3. Reduced motion

`prefers-reduced-motion: reduce`, full scroll pass, every page at 390 and 1440 (`reduced.txt`, captures in `reduced-motion/`):
`no-motion` class set, 0 of 19 / 35 / 9 / 3 reveals hidden (home / about / catering / Taj Park), 0 pin spacers, 0 split lines,
0 running CSS animations, 0 active GSAP tweens, Lenis not attached, horizontal scene off, marquee static, 3D state
`poster / reduced-motion`, console empty.

## 4. Keyboard

`node tools/qa-keyboard.mjs --lang ar|en` (real key events). Results in `keyboard-ar.txt`, `keyboard-en.txt`.

- Tab order starts skip link → logo → nav; focused elements show a visible ring.
- Theme badge: reachable, Enter opens and moves focus into the panel, arrows move between swatches, Enter applies, Esc closes and returns focus.
- 390 px menu: Enter opens and focus moves to the first link; Esc closes and returns focus to the button.
- FAQ: summary reachable, Enter opens, Space closes.
- Contact dialog: opens from the keyboard, focus moves inside, Tab stays inside for 40 presses, Esc closes and focus returns to the opener.
- Phone input: Enter opens the country list, typing filters, ArrowDown + Enter selects (Egypt → `EG +20`).

Fixed in this phase: Tab could leave the open dialog to the browser UI (now wraps), and opening the phone menu from the
keyboard left focus behind the nav (now moves to its first link).

## 5. Contrast

`npm run qa:contrast` → `CONTRAST_REPORT.md`: 104 pairs (ink, muted, accent, on-accent, panel, borders) for the 8
palette × scheme combinations, 104 pass. Lighthouse found one live failure the pair list did not model — the gold eyebrow on
`bg-raised` sections (4.05:1); the recorded decision G7 (accent text on raised surfaces uses ink) now covers that utility.

## 6. Greps (`npm run qa`)

PASS: no `visualIdentityReferences` reference · no Bootstrap classes/assets · no CDN · no jQuery / Font Awesome / icon fonts ·
no physical-direction CSS · no hard-coded hex outside the token file · no emoji, dingbats or generated flag emoji · every
`arrow-start`/`arrow-end` sits in an `.icon--flip` svg · no inline SVG drawings (sprite `<use>` only) · no glass/blur/glow ·
no radius above 2 px · hotel cards are photographs (Taj Park = `taj-park-640` photo) · publication switch honoured · inline
pre-paint script equals `js/theme-boot.js` on all 6 pages · 637 references exist with matching case · 0 contrast failures.

`npm run qa:served`: index, about, catering, hotels/taj-park, dev/3d, dev/icons, sitemap.xml, robots.txt, data/hotels.json,
data/pages.json — served sha256 = committed sha256.

## 7. Lighthouse (mobile: simulated slow 4G, 4× CPU; Lighthouse 12.8.2; preview URLs)

Targets: Performance ≥ 85 home and catering, ≥ 75 Taj Park; Accessibility ≥ 95.

| Page | Performance | Accessibility | Best Practices | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| Home | 91 → **95** | 94 → **100** | 100 → **100** | 100 → **100** | 2.9 s → 2.8 s | 60 ms → 10 ms | 0.115 → 0 |
| About | 99 → **97** | 98 → **100** | 100 → **100** | 100 → **100** | 2.0 s → 2.2 s | 0 ms → 60 ms | 0.001 → 0 |
| Taj Park (3D) | 68 → **95** | 93 → **100** | 100 → **100** | 66 → **66** | 2.8 s → 2.9 s | 1,410 ms → 0 ms | 0.041 → 0 |
| Catering | 78 → **99** | 98 → **100** | 100 → **100** | 66 → **66** | 2.2 s → 2.1 s | 0 ms → 0 ms | 0.464 → 0 |

SEO 66 on Taj Park and catering is the intended `noindex` of unpublished pages (the only failing SEO audit is
`is-crawlable`). About's 99 → 97 is run-to-run variance (no about-specific regression; its TBT moved 0 → 60 ms).

Fixes applied (top three per page):

- **Home:** hero pin distance reserved in CSS (CLS 0.115 → 0); accessibility — stars get `role="img"`, SplitText no longer
  puts `aria-label` on spans, the language button's name contains its visible text, footer headings h4 → h3; hero image `srcset`.
- **About:** chairman photo as WebP 480/806 with `srcset` (363 KB PNG → 31 KB); language-button name; heading order.
- **Taj Park:** 3D starts on first interaction on phones/touch (TBT 1,410 → 0 ms); LCP poster eager + `fetchpriority=high`;
  accessibility — gold-on-raised contrast, star role, language-button name; gallery images sized.
- **Catering:** hero intro in the HTML (CLS 0.464 → 0); gallery images sized; heading order and language-button name.

Shared: metric-matched Almarai fallback; fingerprinting no longer splits dotted file names.

Remaining advisories (not fixed, no target impact): "properly size images" on the hotel cards (the roster has 640/1280 sizes
only; a 960 px derivative would save ≈ 150 KB on phones), DOM size 2.2–2.9 k elements (bilingual markup ships both languages).

## 8. Cross-browser smoke (preview, Playwright)

`docs/screenshots/phase-8/cross-browser/smoke.mjs` — Chrome 155 (installed), Firefox 132 and WebKit 18.2 (Playwright builds),
each at 1440 and at 390 (mobile emulation with touch for Chrome and WebKit). 7 checks each: theme badge (palette + scheme),
contact dialog (open, Esc), horizontal hotel scene (pins and moves at 1440, grid at 390), console clean on home, 3D live or
poster with a reason, reduced motion keeps the poster, no page errors on Taj Park. **42/42 pass.** Screenshots in `cross-browser/`.

Not covered: real Safari on iOS/macOS (no Apple device in this environment). WebKit 18.2 is the Safari engine but not Safari
itself; check the theme badge, the dialog and the 3D scene on an iPhone before launch.

## 9. Publication

`data/pages.json`: `hotels/taj-park.html` and `catering.html` are `published: false`. Verified: no rendered link to either page
on any public page (16 links wrapped in `<template>`), both carry `noindex`, the sitemap lists 2 pages, and the home Taj Park
«عرض التفاصيل» opens the contact dialog with the hotel name as subject. Both pages stay reachable by direct URL.

## 10. Payload

| Asset | Raw | gzip |
|---|---|---|
| `dist/site.css` | 42.1 KB | 9.5 KB |
| `assets/icons/sprite.svg` (48 symbols) | 7.5 KB | 2.3 KB |
| `vendor/three.min.js` (Taj Park only, lazy) | 668.5 KB | 169.4 KB (gzip -9) |
| Classic scripts, home / about | 276.5 KB | 97.1 KB |
| Classic scripts, catering / Taj Park | 280.8 / 296.3 KB | 99.1 / 104.6 KB |

## 11. Cleanup

Moved out of the served tree to `archive/` (reversible, not deleted): the 6 original Bootstrap-era JPG hotel photos
(2.1 MB, replaced by WebP), 3 unused WebP sizes and the unused `symbol-white.svg` brand copy. Removed unused CSS: `.hp-hero`,
`.hp-hero__stage`, `.lenis-on`, `.raised`, `.on-panel`. The Bootstrap/jQuery/Font Awesome files themselves were deleted in Phase 1.
Unused sprite symbols stay by design: kitchen, chef, tray, calendar, arrow-start, auto, language, info, mail.

## 12. Open before production

See `BRAND_GAPS.md` (status **blocking**): G26 catering photography, G33 production domain, G34 real content for the
two hidden pages, G35 a WhatsApp-capable number. Also to decide/verify: G36 demo booking widget and newsletter, G37 EmailJS
template prints `{{subject}}`, and a real-device Safari check.
