# BRAND_GAPS.md — values not defined by the brand sources, and folder rules the brief did not carry

Every item is either `[مقترح / PROPOSED]` (my temporary decision, awaiting Badr) or `[folder-sourced]` (defined in `visualIdentityReferences/`, absent from the brief). Nothing here changes a locked value.

| # | Item | Status | Value in use | Where |
|---|---|---|---|---|
| G1 | Latin typeface | GAP (known) | Avenir Next is commercial, web licence unknown → **not bundled**; `"Avenir Next", Arial` falls back to Arial on the live site | `site.css` `--font-latin` |
| G2 | Pattern ink per scheme | **[folder-sourced, not in brief]** | Guidelines §4 / `09_Website/tokens.css`: `#8E732A` on light surfaces, `#D6AA42` on dark; opacity 25 % surfaces / 40 % dark panels. The 2×2 tile is loaded unchanged and recoloured through `currentColor` only (approved Q4). | `site.css` `--pattern-ink`, `js/kufic-field.js` |
| G3 | Light mode of Green / Red / Blue | [مقترح] | text & button accent = the theme's dark colour (`#13322B` / `#C10016` / `#0E4174`); the light accents are surfaces, rules, badges, button fills with `#101820` text | `site.css` §2, `CONTRAST_REPORT.md` |
| G4 | Dark borders for Green / Red / Blue | [مقترح] | Default dark keeps the specified `#3A4350`; the other three use a Deafah Grey (or Beige for red) tint via `color-mix(... 35–45 %, transparent)` — tints ≥ 20 % are allowed by Manual p.14 | `site.css` §2 |
| G5 | Muted text on red | [مقترح] | Deafah Grey on `#C10016` = 2.9:1 → white at 88 % (`color-mix`) | `site.css` red blocks |
| G6 | Text accents on red/blue dark panels | [مقترح] | `#E1B87F` on red = 3.5:1 and `#008BC4` on dark blue = 2.7:1 → text accents are white there; beige/blue remain for buttons (with `#101820` text) and, for beige only, headings ≥ 24 px | `site.css`, `CONTRAST_REPORT.md` |
| G7 | Gold accent on raised surfaces | [مقترح] | `#8E732A` on `#F5F2EE` = 4.06:1 → inside `.card`/`.raised` the eyebrow, links and stat numbers use ink; the gold stays on rules and borders | `site.css` components |
| G8 | Header logo size vs. brand sample | [مقترح] | the brand homepage sample used a 44 px nav logo (≈ 150 px wide), below the approved 200 px minimum → header renders the horizontal lockup at 220 px (≈ 64 px tall) and switches to the 40 px symbol below 640 px | `index.html`, `js/brand-logo.js` |
| G9 | Footer surface | approved Q7 | always the theme's dark panel → NEG stacked logo in all 8 combinations, 160 px wide | `index.html` footer |
| G10 | Photo veil | [folder-sourced] | the only gradient in the UI is the brand's 40 % black gradient under text on photographs (Guidelines §5) | `.veil` |
| G11 | Motion scale | [مقترح] (Phase 4) | micro 200 ms (brand) · reveal 600–900 ms `power3.out` · scrubbed scenes `scrub: 0.6–1` | `js/animations.js` now, `js/motion.js` in Phase 4 |
| G12 | Hotel roster count | approved Q9 | the six cards present in `index.html` before the overhaul; `data/hotels.json` is the single source; Home and About show the live count | `frontend/data/hotels.json` |
| G13 | Favicon / OG composition | approved Q10 | PNG icons resampled from `Symbol_CMYK@4x`; Apple touch icon on `#101820` with the 0.42 free zone; OG 1200×630 = stacked NEG on `#101820`, logo 320 px wide, free zone 83 px required / 185 px available | `tools/favicons.py` |
| G14 | Almarai delivery | approved Q6 | woff2 re-encoding of the OFL TTFs (290 glyphs → 290, no subsetting since the family is already Arabic + Latin only); `font-display: swap` | `tools/fonts-woff2.py` |
| G15 | Icon style | [مقترح] (Phase 7 set started) | 24 px grid, 1.5 px stroke, square caps/joins, orthogonal Kufic-like geometry, `currentColor` | `assets/icons/sprite.svg` |
| G16 | Solid-gold logo files | IGNORE (approved Q3) | gradient is the official screen colourway; SOLID GOLD files are for foil/signage/packaging (Guidelines §1.2) | — |
| G17 | Demo ribbon | approved Q12 | `بيانات تجريبية` dismissible ribbon on the booking widget and newsletter (and on all Phase 6 mock data) | `.demo-ribbon` |
| G18 | Header height and condensed state | [مقترح] (Phase 2) | the header is as tall as the logo box plus its free zone: horizontal lockup 226×64 box + 27 px on every side = 118 px; after 80 px of scroll the header condenses to the 40 px symbol + 17 px = 74 px (the symbol alone is a permitted small-space use). The brand homepage sample's 44 px nav logo would break the 200 px minimum, so it was not followed. | `js/brand-logo.js`, `site.css` header |
| G19 | Logo mount boxes | decision (Phase 2) | every logo mount is a fixed box sized to the widest variant of its lockup (LTR 606.5 units vs RTL 587.2), so theme, scheme and direction swaps never move layout; measured CLS 0 for scheme and palette switches | `js/brand-logo.js` |
