# MOTION_SPEC — anjumhotels.com/ar (live capture, 2026-10-16/17)

Measured, not inferred. Three passes against the live site (HTTP 200 on all 6 pages; desktop 1440×900, mobile 390×844;
locale ar-SA; consent = "Only essential cookies"):

| Pass | Tool | Output (relative to `reference/anjum/capture/`) |
|---|---|---|
| A — generic inventory | `capture_anjum.py` | `20261016-224154/capture.json` |
| B — targeted timing | `capture_targeted.py` | `targeted-20261017-001631/targeted.json` + 10 screenshots |
| C — mobile menu (explicit taps at 390 px) | `capture_menu.py` | `menu-20261017-003235/menu.json` + 5 screenshots |

Pass B reads the live library configuration (`$(el).data('flexslider').vars`, `$(el).slick('getSlick').options`,
`$.fancybox.defaults`) and samples computed `opacity`/`transform` every 10 ms after each trigger. Pass C also samples
position and size, because the menu animates layout properties. Each curve is fitted against standard easings (lowest
mean-square error wins; the error is quoted).

## Rules applied to this spec (Badr, Phase 0 approval)

1. **Config is the target.** When a library config value exists, it is the target; the measured value is supporting
   evidence. Phase 7 diffs compare against the **Target** column, not against raw measurements.
2. **Easing mapping.** jQuery `swing` → GSAP `sine.inOut`. Other easings stay as captured until Phase 1 decides their
   GSAP/CSS equivalents.
3. **Brand micro-interaction rule.** Hover, focus, toggles and tab switches use the brand 200 ms token — see
   **Target (brand)**. Section choreography (hero crossfade, carousel slide, lightbox open/close, header state) keeps the
   reference target.
4. **Curator.io feed:** N/A — not measured; the social-wall decision is pending in Phase 1.
5. **Haram/Kaaba imagery is non-transferable** — see the last section. None of it may appear in our build.
6. **Phase 1 decisions (Badr):** the header does not transfer — rows 3 and 4 are **excluded from the Phase 7 diff** and
   our shipped header (condense at 80 px, 200 ms) stays. Row 11 is implemented as a centred carousel with swipe +
   scroll-snap, advancing in the reading direction. Rows 12 and 17 use the 200 ms brand crossfade. Row 8: new sections
   follow our existing reveal convention (`.reveal` 700 ms `power3.out`, stagger 80 ms max 6; SplitText 900 ms / 90 ms;
   image mask 900 ms). Lenis stops while any dialog is open.

**Libraries loaded:** jQuery 1.12.4 · FlexSlider 2 (hero) · slick (feature, rooms, offer sliders) · fancybox 3.2.10
(gallery lightbox) · lazySizes · flatpickr · third parties: GTM/GA4, consentmanager, asksuite chat, GetButton WhatsApp,
Curator.io (after consent only). **Not present:** GSAP, ScrollTrigger, Lenis, AOS, IntersectionObserver (0), WAAPI
`element.animate` (0 calls).

Legend — *Measured*: frame-sampled (pass B/C). *Config*: read from the live library instance. *Declared*: CSS rule or
computed style (pass A), not frame-sampled. **UNMEASURED**: no live evidence. **N/A**: deliberately not measured.

## Effects

| # | Section | Trigger | Properties | Measured | Config / declared | **Target** | Target (brand) | Easing | Delay / stagger | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Hero slideshow (4 slides) | timer | `opacity` crossfade, outgoing 1→0 and incoming 0→1 simultaneously; no scale/translate (no Ken Burns); no controls | fade 972 ms desktop / 948 ms mobile; interval 6.4 s (6.43/6.40/6.43 s) | `animation: fade`, `animationSpeed` 1000, `slideshowSpeed` 7000, `pauseOnAction` true, `pauseOnHover` false | **fade 1000 ms, interval 7000 ms** | — | `swing` (fit 5e-5) → **GSAP `sine.inOut`** | — | B `home[].hero`, `home[].libraryConfig.flexslider`; `targeted-…/hero_desktop.png`, `evidence/home_desktop_01_after_intro.png` |
| 2 | Hero headline | load | none observed (no CSS animation, no WAAPI in the first 300 ms, no class change) | — | — | **none** (our existing reveal convention applies — Phase 1) | — | — | — | A `introAnimations` = [] |
| 3 | ~~Header → compact~~ **excluded (C1)** | scroll ≥ 100 px | `#site.scrolled`: bar `relative → fixed`, top 0, transparent → `#fff`, 61 px; logo `translateX(-100px) → 0`; switch is instant, only bar `padding` transitions | no opacity/transform interpolation | bar `padding` 700 ms `ease` (declared) | **instant state switch + padding 700 ms** | — | `ease` | — | B `home[].header.*`; `targeted-…/header_scrolled_desktop.png`, `evidence/home_desktop_section_04.png` |
| 4 | ~~Header → mid-gallery~~ **excluded (C1)** | scroll ≥ 500 px (desktop) / 400–600 px (mobile) | `.banner-container-2::before` keyframes `inright2` (RTL) `translate(250%,-50%) → translate(-50%,-50%)` | not sampled | 1000 ms `ease`, delay 300 ms (declared) | **1000 ms, delay 300 ms** | — | `ease` | 300 ms | A `cssMotion.animRules`; B thresholds |
| 5 | Desktop dropdown | hover (≥ 60em) | sub-menu `opacity 0→1` (`flyin`); sub-menu image `scale(1.05)`; item underline height | not sampled | 500 / 500 / 350 ms `ease` (declared) | 500 / 500 / 350 ms | **200 ms** (hover) | `ease` | — | A `cssMotion.animRules` |
| M1 | Mobile menu — open | tap «القائمة» (390 px) | panel `nav.nav-level-0` appears full width below the header (y 96, 390×698, `rgba(255,255,255,.95)`); toggle icon becomes ✕; body scroll locked (`overflow: hidden`) | **instant** (complete within one 22 ms sample; no opacity/transform/size interpolation) | `.nav-level-0` transition 300 ms declared but not observed | **instant** | **200 ms** (toggle) | — | — | C `M1_open`, `M1_state`; `menu-…/m0_closed.png`, `m1_open.png` |
| M2 | Mobile menu — submenu | tap a parent item | accordion: `ul.sub-menu` height 0 → 127 px; the item gets `.open`; following items are pushed down (y 170 → 297) | **237 ms** | `.sub-menu` transition 500 ms declared | **237 ms** (measured; no config exists) | **200 ms** (toggle) | best fit `ease` (0.126, weak — curve unresolved) | — | C `M2_submenu_open`, `M2_state`; `menu-…/m2_submenu_open.png` |
| M3 | Mobile menu — submenu close | tap the open parent | **UNMEASURED** — in capture the tap closed the whole menu (state after: menu closed, submenu closed) | UNMEASURED | — | UNMEASURED | **200 ms** (toggle) | — | — | C `M3_closedWith`, `M3_stateAfter`; `menu-…/m3_after_submenu_close.png` |
| M4 | Mobile menu — close | tap ✕ | panel disappears; icon returns; scroll lock released | **instant** (within one 24 ms sample) | — | **instant** | **200 ms** (toggle) | — | — | C `M4_close`, `M4_state`; `menu-…/m4_closed.png` |
| M5 | Mobile menu — Esc / a11y | Escape key | Esc does **not** close the menu; toggle has no `aria-expanded`/`aria-controls`; focus stays on `<body>` | — | — | (defect — not copied) | — | — | — | C `escapeTest`, `M1_state.ariaOnToggle`, `M1_state.focus` |
| 7 | Feature blocks slider (4 image+text pairs) | click arrow / swipe | images: slick `fade`; texts: `translateX` one slide (626 px desktop / 324 px mobile) synced by `asNavFor`; RTL; no autoplay | texts 294 ms | `fade: true`, `speed` 300, `cssEase: ease` | **300 ms** | — | `ease` (fit 4.6e-4) | — | B `home[].featureSlider`, `libraryConfig.slick[#galslide_*]`; `evidence/home_desktop_section_02.png` |
| 8 | Any section — reveal on scroll | scroll | none in the reference (no IntersectionObserver, no scroll-linked opacity/transform) | — | — | **our reveal convention: `.reveal` 24 px / 700 ms / `power3.out`, stagger 80 ms (max 6); SplitText 900 ms / 90 ms; image mask 900 ms** | — | — | — | A `scrollReveal`, `instrumentation.intersectionObservers` = [] |
| 9 | Card / image hover (feature, rooms, gallery teasers) | hover (desktop, ≥ 50em where scoped) | `img` `transform: scale(1.05)` | not sampled | 500 ms `ease` (declared + computed) | 500 ms | **200 ms** (hover) | `ease` | — | A `cssMotion` `.gallery-item-image:hover img`, `.room-slider-item-media:hover img` |
| 10 | Overview tiles (4) | hover (≥ 60em) | sibling overlays `::before` opacity 0.15 → 0.6, hovered tile 0.2; icon `.logo-box` opacity 0 → 0.9 | not sampled | overlay 500, icon 700, icon pseudo 800 ms `ease` (declared) | 500 / 700 / 800 ms | **200 ms** (hover) | `ease` | — | A `cssMotion` `.overview-media*`; `evidence/home_desktop_section_03.png` |
| 11 | Rooms carousel (11 cards) | click arrow / swipe | track `translateX` one card (1104 px desktop / 353 px mobile); outgoing card opacity 1 → 0.33, incoming 0.33 → 1; desktop `centerMode` (10 %), mobile `adaptiveHeight` | track 486 ms, opacity 474 ms | `speed` 500, `cssEase: ease`, `infinite: false`; CSS opacity 500 ms | **500 ms** | — | `ease` (fit 2e-4) | — | B `home[].rooms.nextClick`, `libraryConfig.slick[.room-slider]`; `evidence/home_desktop_section_04.png` |
| 12 | Rooms filter tabs (جميع الخيارات / الغرف / الأجنحة / الأجنحة الفاخرة) | click | cards re-filtered (11 → 4 / 3 / 5) with no transition; tab underline transitions | cards **instant** | tab `all` 500 ms `ease` (declared) | cards instant, tab 500 ms | **200 ms opacity crossfade** (cards and tab) | — | — | B `home[].rooms.filters` |
| 13 | Room card link arrow | hover | arrow `translate(0,-50%) → translate(20%,-50%)` loop (`moverightleft`) | not sampled | 350 ms infinite `ease` (declared) | 350 ms loop | **200 ms** (hover; one shot, not a loop — Phase 1 decision) | `ease` | — | A `cssMotion.keyframes` |
| 14 | Offer card (1 slide) | — | slick `fade` configured; one slide, so it never runs | — | `fade`, `speed` 300 | 300 ms (inactive) | — | `ease` | — | B `libraryConfig.slick[#offer-*]` |
| 15 | Destination teaser | scroll | none: no parallax, no zoom | — | — | **none** | — | — | — | A `sections[17].parallaxHints` false; `evidence/home_desktop_section_17.png` |
| 16 | Social wall | click «تحميل» | consent overlay over 4 placeholders; the click loads Curator.io (12–15 requests); 0 third-party requests before consent | — | — | consent gate only | — | — | — | B `home[].socialWall`; `evidence/home_desktop_section_19.png` |
| 16a | Social wall — Curator carousel | — | **N/A** (not measured; decision pending in Phase 1) | N/A | N/A | N/A | — | — | — | — |
| 17 | Gallery page filters (الكل / معالم مكة / الفندق / تناول الطعام / الغرف والأجنحة) | click | show/hide only («معالم مكة» → 29 of 57 visible) | items **instant** | tab 500 ms (declared) | items instant, tab 500 ms | **200 ms opacity crossfade** (items and tab) | — | — | B `gallery[].filterClick`, `gallery[].rendering` |
| 18 | Lightbox — open | click a gallery photo | backdrop `opacity 0 → 0.87` (`rgb(30,30,30)`); toolbar/infobar `opacity 0 → 1`; image zooms from its thumbnail on desktop, no zoom on mobile | backdrop 462 ms, toolbar 253 ms | `animationEffect: zoom`, `animationDuration` 500; CSS toolbar 250 ms | **500 ms (toolbar 250 ms)** | — | backdrop `ease` (7.7e-3), toolbar `ease` (5e-4) | toolbar starts with the backdrop | B `gallery[].lightbox.*`, `libraryConfig.fancyboxDefaults`; `targeted-…/lightbox_open_desktop.png` |
| 19 | Lightbox — next / previous | ArrowRight, arrows, swipe | `transitionEffect: fade`; counter `1 / 57 → 2 / 57`; caption from `data-caption` | 279 ms (outgoing slide only) | `transitionDuration` 366 | **366 ms** | — | `ease` (4.7e-2, weak) | — | B `gallery[].lightbox.arrowRight` |
| 20 | Lightbox — close | Esc | backdrop `opacity 0.87 → 0`; image zooms back to the thumbnail on desktop | 474 ms | `animationDuration` 500 | **500 ms** | — | `ease-in` (4.2e-4) | — | B `gallery[].lightbox.escape` |

## Owner-requested additions (Badr, UI/UX polish brief, 2026-10-17)

Not in the reference site; requested by the owner. They are **not** part of the Phase 7 reference diff (rows A1–A19 have no
reference measurement). Only `transform`, `opacity` and `clip-path` animate. Every row has a reduced-motion branch
(`prefers-reduced-motion` or `html.no-motion`): the end state is shown at once. Each scroll entrance plays **once**:
language / breakpoint rebuilds never replay it, and a theme switch never rebuilds anything.

| # | Element | Trigger | Properties | **Target** | Easing | Delay / stagger | Reduced motion | Where |
|---|---|---|---|---|---|---|---|---|
| A1 | Section headings `[data-split]` | enters view (IO, −12 % bottom margin) | SplitText lines `yPercent 110 → 0`, `opacity 0 → 1` | 900 ms | power3.out | 90 ms per line | static | `motion.js` buildCatalogue |
| A2 | Accent rule `.rule` | enters view | `scaleX 0 → 1` from the inline start (`transform-origin` per `dir`) | 600 ms | power3.out | — | static | `motion.js` initReveals |
| A3 | Cards / blocks `.reveal` | enters view | `opacity`, `y 24 → 0` | 700 ms | power3.out | 80 ms, capped at 6 | static | `motion.js` initReveals (unchanged) |
| A4 | Images in layer scenes | enters view (top 90 %) | `clip-path inset(0 0 100% 0) → inset(0)` + `scale 1.08 → 1` | 900 ms clip / 1200 ms scale | power3.out | — | static | `motion.js` buildLayers |
| A5 | Pattern strips (hero band, separators, Makkah / footer strips, desktop column) | enters view | `opacity 0 → 1` + 24 px along the strip's axis (horizontal from the inline start, vertical from below) | 900 ms | power3.out | 120 ms | static | `motion.js` buildCatalogue |
| A6 | Icons `.icon-box` | enters view | `scale .8 → 1`, `opacity 0 → 1` | 400 ms | power3.out | 60 ms per icon in the batch | static | `motion.js` buildCatalogue |
| A7 | Counters `[data-count-to]` | 50 % in view | count up, Arabic-Indic digits in Arabic | 1200 ms | power2.out | — | final value at once | `effects.js` |
| A8 | Hero CTAs | after the hero headline starts | `opacity 0 → 1`, `y 24 → 0` (the buttons, not the layer, so the pin timeline keeps the layer) | 600 ms | power3.out | 600 ms after the headline | static | `motion.js` buildHeroPin |
| A9 | Hero photo | hero pin scroll (≥ 1024 px only) | parallax `yPercent 0 → −8`, scrubbed (layer runs 10 % below the hero, so no edge shows) | scrub 0.8 | none | — | off (also off on phones) | `motion.js` buildHeroPin |
| A10 | Buttons `.btn` | hover / active / focus | hover `translateY(−2px)` + theme-tinted shadow; active `scale(.98)`; focus 2 px ring, 2 px offset | 200 ms | brand | — | instant | `site.css` |
| A11 | Links `.link` | hover / focus | underline grows from the inline start | 200 ms | brand | — | instant | `site.css` |
| A12 | Cards `.card` | hover | lift `−4px` + shadow; card image `scale 1.05` | 200 ms (image 600 ms) | brand | — | instant | `site.css` |
| A13 | Filter chips / tabs | select | filled state + check icon; live result count («٤ فنادق», `aria-live` polite); empty state with icon + reset | 200 ms | brand | — | instant | `site.css`, `carousel.js`, `gallery.js` |
| A14 | Hotel carousel neighbours | current card changes | neighbours `scale .94`, photo `opacity .55` (text keeps full contrast); progress dots `scale 1.5` on the current one | 500 ms (dots 200 ms) | reference `ease` (dots brand) | — | instant | `site.css`, `carousel.js` |
| A15 | Theme / language switch | click | pressed state (`aria-pressed`) + polite toast | toast 2.5 s | brand | — | toast without slide | `effects.js` |
| A16 | Form validation | field blur / submit | inline ok / error icon + message; success / error toasts | 200 ms | brand | — | instant | `contact-form.js` |
| A17 | Lazy images | load | fade in over a themed placeholder (frame background), size held by width / height | 400 ms | brand | — | no fade | `effects.js` |
| A18 | Scroll progress | scroll | accent bar under the header, `scaleX(progress)` from the inline start | per frame | none | — | still tracks (position feedback) | `effects.js` |
| A19 | Back to top | scroll > one viewport | `opacity`, `y 8 → 0`; click scrolls to top (Lenis when running) | 200 ms | brand | — | instant, native jump | `effects.js` |

## Structure observed (homepage, top → bottom)

hero slideshow + booking bar → feature blocks slider (image/text pairs) → statement «اجعل إقامتك أفضل معنا» + overview
tiles (4) → «الغرف والأجنحة» centred carousel with 4 filter tabs → offer card → destination teaser (photo + text panel) →
«#فندق_أنجم» consent-gated social wall → footer.

## Behaviours not to copy

- Lightbox: `role="dialog"` without `aria-modal`; focus not moved in (`focusInside: false`); on close focus returns to
  `<body>`, not to the photo; opening rewrites the URL hash (`#main-gal-1`).
- Mobile menu: Esc does not close it; the toggle has no `aria-expanded`/`aria-controls`; focus is not moved into the panel.
- Rooms filter «جميع الخيارات» did not restore the full set within 1.8 s after a category was selected (5 cards remained).
- Floating third-party widgets (WhatsApp, chat, "Best price here") cover content on both viewports.

## Non-transferable imagery (locked cultural-care rule)

Every image below shows Masjid al-Haram or the Kaaba. None may appear in the Al Deafah build, in any form (crop, blur,
background, thumbnail):

| Where in the reference | What it shows | Evidence |
|---|---|---|
| Destination teaser «المسجد الحرام» | Masjid al-Haram at night, minarets and the mataf | `evidence/home_desktop_section_17.png` |
| Overview tiles — first tile | the Kaaba door (kiswa) | `evidence/home_desktop_section_03.png` |
| Gallery page, filter «معالم مكة» and «الكل» | 29 of 57 photos (prayers in the Haram, the Kaaba, Hijr Ismail, minarets) | `evidence/gallery_desktop_section_02.png`, B `gallery[].filterClick` |
| Hero slide with the window view | the Haram visible through a suite window | `evidence/home_desktop_01_after_intro.png` |
| Social wall placeholders | Haram minarets and the towers around it | `evidence/home_desktop_section_19.png` |

Room cards named «مطل على الحرم» were not inspected photo by photo; none of the reference's room photos are reused anyway.
