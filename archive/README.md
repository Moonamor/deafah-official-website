# Archive (not served)

Files moved out of `frontend/` during the Phase 8 cleanup because nothing references them. They are kept here
instead of deleted so the move is reversible; delete this folder when you no longer need them.

- `bootstrap-era/imgs/hotel-pics/` — the original JPG hotel photos from the Bootstrap site (Amjad, bustan, taj,
  diar, lav, saraya). The site serves WebP derivatives of them (`frontend/imgs/hotel-pics/*-{640,1280,1920}.webp`).
- `unused-derivatives/` — WebP sizes no page requests (amjad-1920, bustan-1920, taj-park-street-corner-1600) and
  the brand copy `symbol-white.svg`, which no context in the logo lookup table uses.
