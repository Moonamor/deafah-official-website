"""Favicons + OG image from the copied 4x PNG masters (brand-src/). Pure resampling/compositing: no recolour, no effects.
Free zone = 0.42 x symbol height on every side (Brand Facts 2.4)."""
from PIL import Image
import pathlib
OUT = pathlib.Path('frontend/assets/brand/favicon'); OUT.mkdir(parents=True, exist_ok=True)
sym = Image.open('brand-src/symbol-pos@4x.png').convert('RGBA')
# trim transparent margins so the symbol fills the icon box consistently
bbox = sym.getbbox(); sym = sym.crop(bbox)
def icon(size, pad_ratio):
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    inner = int(round(size * (1 - 2 * pad_ratio)))
    s = sym.copy(); s.thumbnail((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(s, ((size - s.width) // 2, (size - s.height) // 2))
    return canvas
# favicon sizes: small margin (the free zone does not apply inside an icon tile, the tile IS the logo's box)
for sz in (16, 32, 48, 192, 512):
    icon(sz, 0.04).save(OUT / f'icon-{sz}.png', optimize=True)
# Apple touch icon: opaque Deafah Black ground + free zone 0.42 x symbol height
apple = Image.new('RGBA', (180, 180), (16, 24, 32, 255))
s = sym.copy(); h = int(round(180 / (1 + 2 * 0.42))); s.thumbnail((h, h), Image.LANCZOS)
apple.alpha_composite(s, ((180 - s.width) // 2, (180 - s.height) // 2)); apple.convert('RGB').save(OUT / 'apple-touch-icon.png', optimize=True)
icon(48, 0.04).save(OUT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
# OG 1200x630: stacked NEG on #101820, logo 320 px wide centred (approved Q10)
og = Image.new('RGB', (1200, 630), (16, 24, 32))
logo = Image.open('brand-src/logo-stacked-neg@4x.png').convert('RGBA'); logo = logo.crop(logo.getbbox())
w = 320; hh = int(round(logo.height * w / logo.width)); logo = logo.resize((w, hh), Image.LANCZOS)
og.paste(logo, ((1200 - w) // 2, (630 - hh) // 2), logo); og.save('frontend/assets/brand/og-image.png', optimize=True)
# Free-zone check for OG: symbol height ~ 0.75 of stacked logo height; margin available vs required
sym_h = hh * (88.3 / 116.0); print('OG symbol h', round(sym_h), 'required free zone', round(0.42 * sym_h), 'available top/bottom', (630 - hh) // 2)
for p in sorted(OUT.iterdir()): print(p.name, p.stat().st_size // 1024, 'KB')
print('og-image.png', pathlib.Path('frontend/assets/brand/og-image.png').stat().st_size // 1024, 'KB')
