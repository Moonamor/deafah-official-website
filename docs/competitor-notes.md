# Layout research for Phase 6 (recorded 2026-10-15, from Badr's brief)

Sources reviewed by Badr: meridienmakkah.sa, Mövenpick Anwar Al Madinah, oryzo.ai. These notes are the layout contract for `hotels/taj-park.html` and `catering.html`. Nothing here changes the brand rules (radius 0, 1.5 px borders, tokens only, no glass/blur).

## Hotel page (`hotels/taj-park.html`) — section order

1. **Hero**: media (the `[data-scene="taj-park-3d"]` component with its poster) + "X minutes from the Haram" headline + two CTAs: Book (contact dialog) and View rooms (anchor).
2. **Availability bar**: dates, rooms, adults/children. No booking engine exists, so submit opens the existing contact dialog with the values prefilled into the message and a hidden subject.
3. **Facts strip**: distance to the Haram, floors (23, OSM), rooms, check-in/out — mock data with the `بيانات تجريبية` ribbon until replaced.
4. **Rooms** with filter tabs (All / Room / Suite / Family); cards show m², beds, view (Haram view as a tier) and a "Check availability" CTA. Uses the `layers` scene.
5. **Packages**: 3 cards ("الأكثر طلباً" badge on one, SAR price, nights, "ماذا يشمل" list, Book + Details) plus a "خصّص باقتك عبر واتساب" card.
6. **Dining carousel**.
7. **Amenities**: 6 icon features from the sprite.
8. **Location**: map link, distance to the Haram, airport, Haramain station — `sticky-media` scene.
9. **Gallery marquee** (direction-aware).
10. **Guest words**: name + country.
11. **FAQ** (`<details>`).
12. **Nearby group hotels** (from `hotels.json`).
13. **Floating WhatsApp + call buttons** (sprite icons).

## Oryzo pattern to adopt

- The 3D building persists through the top of the page (hero → facts → rooms) as a pinned background that reorients per section (camera keyframes per section), instead of one isolated scene.
- Large line-by-line headline reveals (SplitText lines, already in `motion.js`).
- Small self-contained interactive widgets rather than static blocks, e.g. a "distance to the Haram" walking-time slider.

## Catering page (`catering.html`) — section order

hero → packages as tiered cards → sample daily menu as the `horizontal` scene → capacity counters (`counter`) → quality/compliance text badges (text only, mock) → gallery marquee → quote CTA (contact dialog with hidden subject «إعاشة») → floating WhatsApp.

## Constraints carried over

- All mock data in `data/mock/*.json` with `"_notice": "TEST DATA — not real"` and a dismissible ribbon on the page.
- One contact handler only (the existing dialog); prefill through the hidden subject input and the message field.
- Kufic fields frame the page around the 3D scene, never under the building (Phase 5.1 decision).
