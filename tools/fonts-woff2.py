"""Convert the Almarai TTF masters (brand-src/fonts) to woff2 for the served folder.
Lossless re-encoding (fontTools + brotli); glyph set unchanged (no subsetting: Almarai is Arabic+Latin
only and the Latin glyphs are needed for the Arial-fallback mixed lines)."""
import sys, pathlib
from fontTools.ttLib import TTFont
src = pathlib.Path('brand-src/fonts'); dst = pathlib.Path('frontend/assets/fonts'); dst.mkdir(parents=True, exist_ok=True)
for ttf in sorted(src.glob('Almarai-*.ttf')):
    f = TTFont(str(ttf)); n = f['maxp'].numGlyphs
    f.flavor = 'woff2'; out = dst / (ttf.stem + '.woff2'); f.save(str(out))
    g = TTFont(str(out))
    print(f'{ttf.name}: {ttf.stat().st_size//1024} KB -> {out.name} {out.stat().st_size//1024} KB, glyphs {n} -> {g["maxp"].numGlyphs}')
