# Taj Park Hotel — 3D model delivery spec (GLB upgrade path)

The site renders a procedural model of the hotel (`frontend/js/taj-park-3d.js`). A real model can replace it with one attribute change on the component:

```html
<section data-scene="taj-park-3d" data-model="/assets/3d/taj-park.glb" …>
```

When `data-model` is present the loader uses GLTFLoader; the ground, plaza, context buildings, lights, sky, fog, camera path and scheme switching stay exactly the same. The procedural kit is the fallback if the file fails to load.

## Units, origin, axes

| item | value |
|---|---|
| format | glTF 2.0 binary (`.glb`), single file, embedded buffers and textures |
| units | metres (1 glTF unit = 1 m) |
| origin | the hotel footprint centre as stored in `data/taj-park-footprint.json` (`centre.lat/lon`); ground level y = 0 |
| axes | glTF/three convention: +Y up, +X east, −Z north (so north of the centre is negative Z) |
| footprint alignment | the OSM footprint (`footprint` ring in that file, lon/lat) must coincide with the model's ground outline; the cylinder centre is at about x = +45.5 m, z = −4.0 m, radius ≈ 9.5 m |
| height | 95 m to the top of the wing parapet (OSM `height`), 23 floors at 4.0 m; cylinder parapet ≈ 101 m; crown ring to ≈ 105 m |
| triangle budget | ≤ 150 k triangles total; ≤ 2 MB file; textures ≤ 2048 px, 2 at most |
| no logo | the symbol and wordmark are never part of the model (brand rule); signage can be a plain emissive box |

## Node naming (the site toggles these by scheme)

| node name (prefix match) | role | runtime behaviour |
|---|---|---|
| `glass_*` | curtain wall and window glazing | receives the scheme environment map; night emissive 0 |
| `stone_*` | sandstone piers, spandrels, parapets | colour kept; night emissive 0 |
| `led_*` | LED strip meshes along pier/spandrel edges | night: emissive `#FFFFFF` intensity 1; day: emissive 0, material colour = stone |
| `lit_*` | lit interior panels, restaurant band, podium glass interiors | night: emissive `#E1B87F` (brand Beige) intensity 0.8; day: 0 |
| `gold_*` | entrance signage and canopy accents | emissive `#BC9639` night 0.9 / day 0 |
| `crown_*` | pergola fins and rings | treated as `stone_*` |
| `roof_*` | plant rooms, parapets | treated as `stone_*` |

Materials: PBR metallic-roughness. Base colours should match the brand tokens so the model stays within the identity: stone `#E1B87F` (Beige) or `#B6ADA5` (Grey), glass `#0E4174` → `#101820`, LED white, interiors `#E1B87F`, gold `#BC9639`. Avoid baked lighting; the site lights the model.

## Camera reference

The scroll path starts at the street-corner view (north-east of the cylinder, 6 m above ground, looking up at the cylinder) and rises to a ¾ aerial. Keep the model's north façade facing −Z so the path reads correctly.

## Checklist before delivery

- [ ] `.glb` opens in the three.js editor with +Y up and the ground at y = 0
- [ ] Outline overlays the OSM footprint (export a top view at 1 px = 0.5 m and compare)
- [ ] Node names use the prefixes above
- [ ] No logo geometry or texture
- [ ] File ≤ 2 MB; the 3D section budget is 800 KB transferred, so a model above ~600 KB must be Draco-compressed (tell us, we add the decoder)
