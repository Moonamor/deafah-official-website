# MOTION_SPEC — anjumhotels.com/ar (live capture, 2026-10-16/17)

Measured, not inferred. Two passes, both against the live site (HTTP 200 on all 6 pages, desktop 1440×900 and
mobile 390×844, locale ar-SA, consent = "Only essential cookies"):

| Pass | Tool | Output (relative to `reference/anjum/capture/`) |
|---|---|---|
| A — generic inventory | `capture_anjum.py` | `20261016-224154/capture.json` (sections, CSS motion rules, computed transitions, scroll diff, class mutations, hover deltas) |
| B — targeted timing | `capture_targeted.py` | `targeted-20261017-001631/targeted.json` + 10 screenshots |

Pass B exists because pass A's generic slider probe latched onto the page wrapper `#site` and its lightbox probe clicked
the hero, so neither timed the real components. Pass B reads the live library configuration (`$(el).data('flexslider').vars`,
`$(el).slick('getSlick').options`, `$.fancybox.defaults`) and samples computed `opacity`/`transform` every 10 ms after each
trigger, then fits the curve against standard easings (lowest mean-square error wins; the error is quoted).

**Libraries loaded:** jQuery 1.12.4 · FlexSlider 2 (hero) · slick (feature, rooms, offer sliders) · fancybox 3.2.10
(gallery lightbox) · lazySizes · flatpickr (booking dates) · third parties: GTM/GA4, consentmanager, asksuite chat,
GetButton WhatsApp widget, Curator.io (only after consent). **Not present:** GSAP, ScrollTrigger, Lenis, AOS,
IntersectionObserver (0 instances), WAAPI `element.animate` (0 calls).

Legend — *Measured*: frame-sampled in pass B. *Config*: read from the live library instance. *Declared*: CSS rule / computed
style from pass A, not frame-sampled. **UNMEASURED**: no live evidence; no value is given.

## Effects

| # | Section | Trigger | Properties | Duration | Easing | Delay / stagger | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Hero slideshow (4 slides) | timer | `opacity` crossfade: outgoing 1 → 0, incoming 0 → 1, simultaneous. No scale, no translate (no Ken Burns). | **972 ms** measured (desktop), 948 ms (mobile); config `animationSpeed` 1000 ms | `swing` (jQuery) — fit error 5e-5 desktop; mobile best fit `ease` (2.7e-4) | interval **6.4 s** measured (6.43 / 6.40 / 6.43 s over 4 changes); config `slideshowSpeed` 7000 ms. No controls (`controlNav`/`directionNav` false), `pauseOnAction` true, `pauseOnHover` false | B `home[].hero`, `home[].libraryConfig.flexslider`; `targeted-…/hero_desktop.png`, `evidence/home_desktop_01_after_intro.png` |
| 2 | Hero headline | load | none observed (no CSS animation, no WAAPI in the first 300 ms, no class change on the title) | — | — | — | A `introAnimations` = [] |
| 3 | Header — compact state | scroll ≥ 100 px | `#site` gains `.scrolled`; nav bar switches `position: relative → fixed`, `top 0`, background transparent → `#fff`, height 61 px; logo `translateX(-100px) → 0`. State switch is instant (sampled: no opacity/transform interpolation); only the bar's `padding` transitions | padding **700 ms** (declared) | `ease` | — | B `home[].header.thresholds/atTop/scrolled/onCross`; `targeted-…/header_scrolled_desktop.png`, `evidence/home_desktop_section_04.png` |
| 4 | Header — mid-gallery state | scroll ≥ 500 px (desktop), ≥ 400–600 px (mobile) | `#site.scrolled-midgallery`; `.banner-container-2::before` keyframes `inright2` (RTL): `translate(250%,-50%) → translate(-50%,-50%)` | 1000 ms (declared) | `ease` | 300 ms delay (declared) | A `cssMotion.animRules` `[dir=rtl] .scrolled-midgallery …::before`; B thresholds |
| 5 | Desktop dropdown menu | hover (≥ 60em) | sub-menu `opacity 0 → 1` (keyframes `flyin`); sub-menu image `scale(1.05)`; item underline `height` | 500 ms / 500 ms / 350 ms (declared) | `ease` | — | A `cssMotion.animRules` `.main-menu-item:hover .sub-menu`, `.sub-menu-image` |
| 6 | Mobile menu | tap menu button | **UNMEASURED** — neither pass opened it. Declared only: `.nav-level-0` transition 300 ms, sub-menu 500 ms, menu icon 500 ms | UNMEASURED | UNMEASURED | — | A `cssMotion.animRules` (max-width 59.999em) |
| 7 | Feature blocks slider (image + text pair, 4 items) | click arrow / swipe | images: slick `fade: true` (opacity); texts: `translateX` one slide (626 px desktop / 324 px mobile), synced by `asNavFor`; RTL | texts **294 ms** measured; config `speed` 300 ms (both sliders) | `ease` (fit 4.6e-4; config `cssEase: ease`) | no autoplay | B `home[].featureSlider`, `libraryConfig.slick[#galslide_*]`; `evidence/home_desktop_section_02.png` |
| 8 | Feature / any section — reveal on scroll | scroll | none: no IntersectionObserver, no opacity/transform change while scrolling except lazy-load class swaps | — | — | — | A `scrollReveal.elementsChangedByScroll` (4 entries, all hero/widget), `instrumentation.intersectionObservers` = [] |
| 9 | Image hover (feature, rooms, gallery teasers, menu images) | hover (desktop, ≥ 50em where scoped) | `img` `transform: scale(1.05)` | 500 ms (declared + computed) | `ease` | — | A `cssMotion` `.gallery-item-image:hover img`, `.room-slider-item-media:hover img`; `computedMotion` |
| 10 | Overview tiles (4 tiles) | hover (≥ 60em) | sibling tiles' overlay `::before` opacity 0.15 → 0.6, hovered tile 0.2; icon `.logo-box` opacity 0 → 0.9 | overlay 500 ms, icon 700 ms, icon pseudo 800 ms (declared) | `ease` | — | A `cssMotion` `.overview-media*`, `computedMotion`; `evidence/home_desktop_section_03.png` |
| 11 | Rooms carousel (11 cards) | click arrow / swipe | track `translateX` one card (1104 px desktop / 353 px mobile); outgoing card `opacity 1 → 0.33`, incoming `0.33 → 1`. Desktop `centerMode` (padding 10 %), mobile not centred + `adaptiveHeight` | track **486 ms**, opacity **474 ms** measured; config `speed` 500 ms; CSS opacity 500 ms | `ease` (fit 2e-4; config `cssEase: ease`) | `infinite: false`, no autoplay, RTL | B `home[].rooms.nextClick`, `libraryConfig.slick[.room-slider]`; `evidence/home_desktop_section_04.png`, `targeted-…/rooms_after_filters_desktop.png` |
| 12 | Rooms filter tabs (جميع الخيارات / الغرف / الأجنحة / الأجنحة الفاخرة) | click | slides re-filtered instantly (count 11 → 4 rooms, → 3 suites, → 5 luxury suites); no transform/opacity interpolation on the track or cards; active tab underline transitions | cards: **0 ms (instant)** measured; tab: 500 ms (declared `all`) | tab `ease` | — | B `home[].rooms.filters` |
| 13 | Room card link arrow | hover | arrow `translate(0,-50%) → translate(20%,-50%)` loop (`moverightleft`) | 350 ms, infinite (declared) | `ease` | — | A `cssMotion.keyframes moverightleft` |
| 14 | Offer card (1 slide) | — | slick `fade` configured, single slide so never runs | config 300 ms | `ease` | — | B `libraryConfig.slick[#offer-*]` |
| 15 | Destination teaser (المسجد الحرام) | scroll | none: no parallax, no zoom, no scroll-linked change | — | — | — | A `sections[17].parallaxHints` false, `scrollReveal` no entries; `evidence/home_desktop_section_17.png` |
| 16 | Social wall (#فندق_أنجم) | click «تحميل» | consent overlay over 4 placeholder tiles; the click loads Curator.io (12–15 requests) into a 4-up carousel with arrows. Before the click: **0** third-party requests | feed motion **UNMEASURED** (Curator renders after consent; its carousel transition was not sampled) | UNMEASURED | — | B `home[].socialWall` (`requestsBeforeConsent` = [], `requestsAfterClick`); `evidence/home_desktop_section_19.png` |
| 17 | Gallery page filters (الكل / معالم مكة / الفندق / تناول الطعام / الغرف والأجنحة) | click | show/hide only (e.g. «معالم مكة» → 29 of 57 visible); no opacity/scale interpolation on items | **0 ms (instant)** measured; tab 500 ms (declared) | — | — | B `gallery[].filterClick`, `gallery[].rendering.filters` |
| 18 | Lightbox — open | click a gallery photo | backdrop `opacity 0 → 0.87` (`rgb(30,30,30)`); toolbar/infobar `opacity 0 → 1`; image zooms from its thumbnail on desktop (`animationEffect: zoom`), no zoom on mobile | backdrop **462 ms**, toolbar **253 ms** measured; config `animationDuration` 500 ms; CSS toolbar 250 ms | backdrop `ease` (7.7e-3), toolbar `ease` (5e-4) | toolbar starts with the backdrop | B `gallery[].lightbox.bg_opacity/toolbar_opacity`, `libraryConfig.fancyboxDefaults`; `targeted-…/lightbox_open_desktop.png` |
| 19 | Lightbox — next / previous | ArrowRight, arrows, swipe | `transitionEffect: fade`: previous image `opacity 1 → 0` while the next fades in; counter `1 / 57 → 2 / 57` | **279 ms** measured; config `transitionDuration` **366 ms** (measured is 24 % shorter — see note) | `ease` (4.7e-2, weak fit) | — | B `gallery[].lightbox.arrowRight` |
| 20 | Lightbox — close | Esc | backdrop `opacity 0.87 → 0`, image zooms back to the thumbnail on desktop | **474 ms** measured; config 500 ms | `ease-in` (4.2e-4) | — | B `gallery[].lightbox.escape` |

**Note on row 19.** Only the outgoing slide was sampled (its selector is stable); the incoming slide's fade was not
isolated, so the 279 ms reading may be the outgoing half only. Measured 279 ms and configured 366 ms differ by more than
±10 %. Decision requested in Phase 1: use the configured 366 ms, or re-measure the incoming slide first.

**Note on row 1.** The interval between visible slide changes is 6.4 s on both viewports although the instance is
configured for 7000 ms; the measured value is what visitors see. 6.4 s and 7.0 s are within ±10 % of each other at 6.7 s.

## Structure observed (homepage, top → bottom)

hero slideshow + booking bar → feature blocks slider (image/text pairs) → statement "اجعل إقامتك أفضل معنا" + overview
tiles (4) → "الغرف والأجنحة" centred carousel with 4 filter tabs → offer card → destination teaser (photo + text panel) →
"#فندق_أنجم" consent-gated social wall → footer. Sections pass A could not split (one 4 131 px block on desktop) are
identified from the screenshots.

## Behaviours not to copy (seen during capture)

- Lightbox: `role="dialog"` but no `aria-modal`; focus is not moved into it (`focusInside: false`); on close focus returns
  to `<body>`, not to the photo. Opening rewrites the URL hash (`#main-gal-1`).
- Gallery captions and most gallery photos show Masjid al-Haram / Kaaba; the overview tiles include a Kaaba-door photo;
  the destination teaser is a Haram photo. None of this imagery may be reused (locked cultural-care rule).
- Rooms filter «جميع الخيارات» did not restore the full set within 1.8 s after a category had been selected (5 cards
  remained) — a probable reference defect.
- Third-party floating widgets (WhatsApp, chat, "Best price here") overlap content on both viewports.
