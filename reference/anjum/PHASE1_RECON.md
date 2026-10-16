# Phase 1 — target reconnaissance (no code changes)

## Decisions (Badr, Phase 1 approval, 2026-10-17)

| # | Decision |
|---|---|
| C1 | **Rejected.** The shipped header stays exactly as is (condenses at 80 px, 200 ms brand token). The Anjum header timing does not transfer; header rows are removed from the Phase 7 diff. |
| C2 | **Approved.** The pinned horizontal hotels scene is replaced by the centred carousel: 500 ms slide (easing per MOTION_SPEC row 11), swipe + scroll-snap, advancing in the reading direction (RTL). |
| C3 | **Approved.** The filter chips become real filters on the carousel (rating + walking time from `hotels.json`) with a 200 ms crossfade. Reported separately as a fix to a published defect. |
| C4 | Build with the 6 hotels in the data; fully data-driven, so more hotels are a data-only change. No placeholder hotels. |
| C6 | **Approved.** Lenis stops while any dialog is open and restarts on close. |
| Reveal | **Approved.** New sections reuse `.reveal` (24 px / 700 ms / `power3.out` / 80 ms stagger, max 6), SplitText headings (900 ms / 90 ms) and the 900 ms image mask. No new reveal timings. |
| Taj Park card | Must be a real photograph with the same 4:3 crop and treatment as the other cards; source named: `imgs/hotel-pics/Broushre (7).jpg` (WebP variants with clean names; the original is neither renamed nor moved). Never a render, screenshot or still of the 3D model. |
| RST | The photos are «مطعم التاج / Al Taj Restaurant» at Taj Park Hotel; the gallery is titled accordingly. WebP 640 / 1280 / 1920 via a Pillow script committed under `tools/`; width/height written into the gallery data; filters by category (entrance, hall, table setup, buffet); Arabic + English alt text per photo. |
| G26 | Demo site: the catering page is published now with the RST gallery + lightbox; every other mock item on it stays and is listed in the report. Taj Park stays hidden. |
| Social | A social-links block with no real accounts: `url: null` renders a non-navigating element (`aria-disabled="true"`, not a link); a filled `url` renders `<a target="_blank" rel="noopener">` — data-only change. No third-party feed, no consent gate. |


Branch `feature/anjum-patterns`. Companion to `MOTION_SPEC.md`. Everything below was read from the repo on 2026-10-17.

## 1. Repo map

| Area | Where | What it is |
|---|---|---|
| Tailwind entry | `frontend/src/styles/site.css` → `npm run build:css` → `frontend/dist/site.css` (committed) | `@import "tailwindcss"`; `@source` = `*.html`, `hotels/*.html`, `js/*.js`; §1 `@theme` with `--color-*: initial` (brand colours only), `--spacing: 4px`, `--radius-none: 0`, `--radius-chip: 2px`, `--ease-brand: cubic-bezier(0.22, 1, 0.36, 1)`; `@theme inline` maps utilities to the semantic tokens; §5 `@layer components`; unlayered §5b for scene CSS |
| 8 themes | `site.css` §2 | `html[data-theme="default|green|red|blue"][data-scheme="light|dark"]`; `:root` = default · light. Semantic tokens per combination: `--surface`, `--raised`, `--ink`, `--muted`, `--accent`, `--accent-ink` (text-safe), `--accent-soft` (decoration only), `--on-accent`, `--border`, `--panel`, `--on-panel`, `--panel-muted`, `--panel-accent`, `--panel-accent-ink`, `--pattern-ink`, `--pattern-opacity` (0.25 light / 0.40 dark), `--theme-dot` |
| Theme switching | `js/theme-boot.js` (inlined pre-paint in every `<head>`, QA-checked), `js/auto-theme-manager.js`, `js/theme-badge.js` | keys `deafah-theme` (light/dark), `deafah-theme-mode` (auto/manual), `deafah-theme-last-check`, `deafah-palette`; light 06:00–18:00 local, re-check every 6 h unless manual; API `window.DeafahTheme { getScheme, setScheme, getMode, getPalette, setPalette, subscribe }`; `html.theme-anim` 200 ms crossfade on switch |
| Language / direction | `js/main.js` | key `deafah-lang`; sets `lang`, `dir`, `data-lang`; bilingual markup `<span class="lang-ar">…</span><span class="lang-en">…</span>`; event `deafah:langchange` (motion rebuilds on it) |
| Motion | `js/motion.js` (+ vendored `gsap`, `ScrollTrigger`, `SplitText`, `lenis`) | one Lenis instance (`autoRaf: false`, driven by `gsap.ticker`, `lenis.on("scroll", ScrollTrigger.update)`); recipes by attribute `data-scene="hero-pin|layers|horizontal|counter|sticky-media"`; `DIR()` = −1 in RTL; reduced motion → no Lenis, static scenes, instant reveals; `DeafahMotion.rebuild()` |
| Widgets | `js/widgets.js` | `[data-marquee]`, `[data-tabs]/[data-tab]` (roving focus, `aria-selected`, filters `[data-type]` with `hidden` — instant), availability form, walk slider |
| Dialog | `js/contact-modal.js` | native `<dialog>`, Tab wrap, Esc, focus returns to opener, event `deafah:dialogopen` |
| Hotel cards | `js/hotels.js` + `data/hotels.json` | renders the roster from JSON; card fields below |
| Publication | `data/pages.json` | `site_url` + `published` flags (Taj Park and catering hidden) |
| Data | `frontend/data/` | `hotels.json` (6 hotels: zahrat-al-lavender, amjad-al-deafah, saraya-al-deafah, diyar-al-diyafah, taj-park, al-bostan-al-masi; fields `slug, name_ar, name_en, image, srcset, walk_minutes, area_ar, area_en, stars, price_from_sar, details_url`; `copy{}`), `pages.json`, `taj-park-*.json`, `mock/taj-park.json`, `mock/catering.json` |
| Icons | `assets/icons/sprite.svg` | 48 symbols, `<use href>` only |
| QA | `tools/` | `npm run qa` (greps, case check, contrast), `qa:served`, `shoot.mjs`, `qa-keyboard.mjs` |

**Current homepage (`index.html`), top → bottom:** fixed header (option B, condenses after 80 px, hides on scroll-down) →
`hero-pin` hero (one photo `taj-park-1280`, veil, Kufic canvas column, SplitText headline, 2 CTAs) → demo booking widget
(ribbon) → `#why` 4 highlights (`layers`) → counters (`counter`) → `#hotels` roster with filter chips (`horizontal`,
pinned ≥ 1024 px) → `#services` panel → footer. One `<h1>`; one `tel:` link.

### Existing scroll-reveal convention (to be reused by every new section — no new reveal timings)

| Recipe | Selector | Motion | Timing | Trigger |
|---|---|---|---|---|
| Entrance reveal | `.reveal` (CSS start state `opacity: 0; transform: translateY(24px)`, `.is-in` = final) | `gsap.fromTo(opacity 0, y 24 → opacity 1, y 0)`, `clearProps: transform` | **700 ms `power3.out`**, stagger 80 ms per element in the same batch, capped at 6 (max 480 ms) | IntersectionObserver `rootMargin 0 0 -10% 0`, `threshold 0.05`, once; elements added later are picked up by `rebuild()` |
| Headline lines | `[data-split="lines"]` | SplitText lines, `yPercent 110 → 0`, `opacity 0 → 1` | **900 ms `power3.out`**, stagger 90 ms | after `document.fonts.ready` |
| Layered cards | `data-scene="layers"` cards | `y 48 + (i % 4)·16 → 0` | scrubbed, `scrub 0.6`, start `top 95%` → end `top 45%` | ScrollTrigger |
| Image mask | images in `layers` | `clip-path: inset(0 0 100% 0) → inset(0 0 0% 0)` | **900 ms `power3.out`** | `top 90%`, once |
| Micro-interactions | buttons, chips, tabs, links, header, theme | colour / border / transform | **200 ms `var(--ease-brand)`** (literal, 29 uses — there is no duration token yet) | hover / focus / toggle |

Proposal: new sections use `.reveal` for their heading, intro and cards, and `[data-split="lines"]` for the section title.
Image-heavy grids (catering gallery, hotel portfolio) use the image mask. Nothing new is introduced.

## 2. RST photo inventory (`frontend/imgs/hotel-pics/RST/`, untracked, not modified)

| Measure | Value |
|---|---|
| Files | 22, all JPEG (`GV0A8074` … `GV0A8097`, two numbers missing: 8086, 8095) |
| Dimensions | 6000×4000 (18 files); 5869×3913, 5864×3909, 5804×3869, 5908×3939 (4 cropped) |
| Size | 3.8–5.5 MB each, 102.3 MB total |
| Origin | Canon EOS R6 Mark II, one session, 2026-04-20 14:09:38–14:09:45 (EXIF) |
| Narrower than 1600 px | **none** — all are full-bleed capable |
| Hotel | not in file names or EXIF. A sign in `GV0A8074` reads «مطعم التاج / Al Taj Restaurant» with the group logo line. **Inference, needs confirmation:** the restaurant of Taj Park Hotel |
| Haram / Kaaba imagery | none (checked on contact sheets) |

| Category (from the photos) | Files |
|---|---|
| Entrance / signage | 8074 |
| Hall — wide views | 8075, 8076, 8083, 8084, 8085, 8087, 8088, 8089, 8097 |
| Table settings (close) | 8077, 8078, 8079, 8080, 8081, 8082 |
| Buffet stations | 8090, 8091, 8092, 8093, 8094, 8096 |

The originals are not web-ready (≈ 4.6 MB each). Phase 5 proposal, for approval then: WebP derivatives at
640 / 1280 / 1920 px wide, quality ≈ 80, generated with **Pillow, already used by `tools/favicons.py`** (no new
dependency), written next to the originals as `RST/<name>-<w>.webp`; originals stay untouched.

**Suitability as catering photography (G26):** they are real, professional photos of a group restaurant — dining hall,
table settings and buffet counters. They show a dining venue, not a kitchen, food or meal service. They can replace the
hotel photos the catering gallery currently borrows, but whether they satisfy G26 ("kitchen/catering photography") is
your call.

## 3. Section mapping

| Reference section | Al Deafah equivalent | Data source | Images |
|---|---|---|---|
| Hero slideshow (4 slides, crossfade 1000 ms / 7000 ms, `sine.inOut`) | Group hero slideshow inside the existing `hero-pin` hero (keeps veil, Kufic column, headline, CTAs; slides crossfade inside the photo layer) | new `data/home.json` → `hero.slides[]` | hotel exteriors `imgs/hotel-pics/*-1920.webp` + Taj Park renders `assets/taj-park/*`; each slide checked for Haram views in Phase 2 |
| Feature blocks slider (4 image + text pairs, 300 ms) | Group highlights — today's `#why` 4 points become 4 image + text pairs on the same slider pattern | `home.json` → `highlights[]` (copy exists in `index.html`) | RST hall (dining), Taj Park lobby, hotel exteriors; any missing photo → `TODO_CONTENT` |
| Statement banner «اجعل إقامتك أفضل معنا» | Brand statement on a pattern panel (`.panel` + Kufic field, 40 %) | `home.json` → `statement` | none (pattern) |
| Overview tiles (4) | Quick links to **published** pages and anchors: من نحن · فنادقنا · الخدمات · تواصل معنا (Taj Park and catering appear only when `pages.json` publishes them) | `home.json` → `quicklinks[]` filtered by `pages.json` | one photo per tile from existing assets |
| Rooms filtered carousel (11 cards, 4 tabs) | Hotels portfolio — **6 hotels in `hotels.json`, not 14** — with filters derived from the data: rating (1★, 2★, 3★, pending) and walking time (< 5, 5–15, > 15 min). Replaces today's visual-only chips | `hotels.json` (existing) | existing `imgs/hotel-pics/*` |
| Offer card | none — no offers data exists | — | — |
| Destination teaser «المسجد الحرام» | Makkah teaser as a **text + pattern panel** (no photograph): distances, Haramain station, shuttle | `home.json` → `makkah` (`TODO_CONTENT` for facts) | none |
| Social wall (consent-gated Curator) | **Decision needed:** consent-gated feed (needs a provider and accounts) or plain social links (none exist in the repo today) | — | — |
| NEW catering gallery | Al Taj Restaurant gallery: grid + category filters (entrance / hall / tables / buffet — by-hotel filtering is impossible, it is one venue) + lightbox; slideshow mode only if you want it (the reference gallery has none beyond fancybox's slideshow button) | `home.json` → `gallery[]` (src, w, h, alt ar/en, hotel, category) | RST (WebP derivatives) |
| Footer | Existing footer, `.reveal` motion only | — | — |

Existing sections kept as they are: demo booking widget (G36), counters, services panel.

## 4. Timing overrides (brand 200 ms rule) — every row that changes a captured or configured value

| MOTION_SPEC row | Reference target | Our target | Why |
|---|---|---|---|
| 5 desktop dropdown hover | 500 / 500 / 350 ms | 200 ms | hover — but we have no dropdown; row applies only if one is added |
| M1 mobile menu open | instant | 200 ms | toggle |
| M2 submenu open | 237 ms | 200 ms | toggle (−16 %) |
| M3 submenu close | UNMEASURED | 200 ms | toggle |
| M4 mobile menu close | instant | 200 ms | toggle |
| 9 card / image hover `scale(1.05)` | 500 ms | 200 ms | hover |
| 10 overview tile overlays / icon | 500 / 700 / 800 ms | 200 ms | hover |
| 12 rooms filter (cards + tab) | instant / 500 ms | 200 ms opacity crossfade | tab switch |
| 13 card link arrow | 350 ms infinite loop | 200 ms, one shot | hover; a loop is unnecessary motion |
| 17 gallery filter (items + tab) | instant / 500 ms | 200 ms opacity crossfade | tab switch |

Kept on reference targets (choreography): hero 1000 / 7000 ms, feature slider 300 ms, carousel slide 500 ms, lightbox
open 500 ms / next 366 ms / close 500 ms, header state (see conflict C1).

## 5. Conflicts

| # | Conflict | Evidence | Proposal |
|---|---|---|---|
| C1 | Header: the reference compacts at 100 px with an instant switch + 700 ms padding; our approved header (option B) condenses at 80 px with 200 ms transforms and hides on scroll-down | `site.css` lines 369–371, 539–541; `main.js` line 25 | the prompt says header state follows the capture: condense at **100 px over 700 ms `ease`** (transform-only, CLS stays 0); keep hide-on-scroll-down and the logo swap. Needs your yes, because it changes an approved component |
| C2 | Two horizontal paradigms: our `#hotels` is a pinned horizontal scroll scene (≥ 1024 px); the reference is a centred click carousel | `index.html` line 198 `data-scene="horizontal"` | replace the pinned scene with the centred carousel (500 ms) + filter tabs, or keep a grid; one of them, not both |
| C3 | Filter chips do nothing today (visual only) — a Phase 6 defect already in production | `main.js` lines 78–83 | real filters on the new portfolio (ARIA tablist) |
| C4 | Hotel count: the brief says 14 hotels, the data has 6 | `data/hotels.json` | build for N hotels from the data; please confirm or provide the other 8 |
| C5 | No duration token: "200 ms" is a literal in 29 rules | `site.css` | add `--duration-micro: 200ms` to `@theme` and use it in new code (existing rules untouched) |
| C6 | Lenis keeps listening while a dialog is open (only `body { overflow: hidden }`) | no `lenis.stop()` in `js/` | the lightbox calls `lenis.stop()` / `start()` on open / close |
| C7 | `widgets.js` tabs hide cards with `hidden` (instant) | `widgets.js` `initTabs` | extend it with a 200 ms opacity crossfade (`prefers-reduced-motion` → instant) |
| C8 | Quick-link tiles must not link to unpublished pages | `data/pages.json` | build-time filter through the existing publication switch |
| C9 | Hero slideshow inside `hero-pin`: the pin scrubs the photo layer (`yPercent`, `scale 1.04`); the crossfade must run on the slides inside it, and the first slide must be the only eager / `fetchpriority=high` image | `motion.js` lines 85–91 | slides stacked in the photo layer; slideshow pauses while the hero is off-screen and on `visibilitychange` |
| C10 | Theme switches must not replay animations: `html.theme-anim` crossfades colours globally | `site.css` `.theme-anim` | slideshow / carousel state lives in JS, not in theme-dependent CSS; verify in Phase 3 |
| C11 | Hard-coded colours / smooth-scroll duplicates / glassmorphism palette | `npm run qa` greps clean; one Lenis instance; no `kmp`/glassmorphism references in code | none found |

## 6. Open questions

1. Which hotel owns «مطعم التاج» (Al Taj Restaurant)? I infer Taj Park Hotel from the name and the group sign.
2. Do the RST photos satisfy G26 for the hidden catering page, or are kitchen / food photos still required?
3. Social wall: consent-gated feed (which provider and accounts?) or plain social links (which accounts?).
4. Hotels: 6 in the data vs 14 in the brief — confirm 6, or send the other 8.
5. C1 header timing and C2 carousel vs pinned scene — approve the proposals or choose otherwise.
