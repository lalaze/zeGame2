# Extension rooms and thought lettering — round 3

## Changes

1. **Reading doorway and circulation.** The upper runner now begins at the floor,
   not the ceiling. A recessed view into the glasshouse has oak jambs, a header,
   glazing ribs, plants and a tiled threshold. The recess paints behind actors;
   only its frame paints in the foreground. Its sky follows the existing clock.
   Unlocked extensions receive bound, sparsely patterned runners with a seamless
   cross junction, using the main rug's palette/binding language.
2. **Light.** Half-room-pixel golden pane footprints replace diffuse rectangles.
   They retain the extension sun's travelling slant, strength, reach and night
   suppression. Floor actors receive native contact shades; built-in reading
   furniture and generated kitchen equipment receive contact shadows too.
   Extension lamp textures use continuous radial falloff at density two and keep
   their existing positions, colors, strengths and night activation. The built-in
   reading lamp's light follows its new shade. Extension furnishings omit their
   old concentric baked glow; main/shop behavior is unchanged. Warm night grading
   retains the glasshouse/patio's stronger sky exposure and leaves locked grades
   unchanged.
3. **Floors.** Warm aged clay tiles in the glasshouse, staggered flagstones on the
   patio and quiet kitchen ceramics replace the loud checker/speckle. Half-pixel
   grout, lit bevels and sparse worn edges use master-palette pigments. Reading
   herringbone is retained.
4. **Scale.** The two built-in reading armchairs and floor lamp were calls to the
   placeable-furniture painter, not actual placed pieces. They now have dedicated
   density-two upholstery/brass artwork at the same centers and feet. Chair
   silhouettes are about 24×27 room pixels; the lamp is about 10×35. No furniture
   definition, shop thumbnail, placement footprint, tap target or anchor changes.
5. **Room identity.** Red cloth pigment is remapped to cream/burgundy, sage and
   blue/cream for reading/glasshouse/patio tables. Alpha, source envelopes, chairs,
   seated poses, anchors and crops are unchanged. Ensemble, atlas and legacy
   generated-table fallback paths retain their original geometry. Main red
   gingham is returned unchanged. Variants are cached by source and room.
6. **Kitchen.** Uninstalled wall equipment gets small continuous floor-tape
   footprints instead of vertical dashed boxes; capped plumbing/electrical
   hookups remain. Rubber mats have beveled binding and recessed rib texture.
   STORE/PREP use shared pixel sign masks, with font-readiness layer signatures.
   All equipment gates, cook routes and the unfitted locked shell are unchanged.
7. **Thoughts.** Wrapping and rendering use the same shared glyph advances as
   signs: bitmap Latin, native Pixel ZH, binary-threshold platform CJK fallback.
   Text is baked at density two, centered by actual ink, and shown at exactly
   half backing size. Font revision participates in the texture key. The existing
   placement/collision planner, locales and 3.6-second display state are retained.

## Files changed in this round

- `src/render/extension-surfaces.ts` (new)
- `src/render/extension-table-art.ts` (new)
- `src/render/extension-surfaces.test.ts` (new)
- `src/render/region-art.ts`
- `src/render/passages.ts`
- `src/render/kitchen-art.ts`
- `src/render/cozy-world-art.ts`
- `src/render/furniture-art.ts`
- `src/render/lighting.ts`
- `src/render/phaser/cafe-scene.ts`
- `src/render/thought-text.ts`
- `src/render/thought-text.test.ts`
- `scripts/extension-room-qa.mjs` (new)
- `scripts/art-grid-offline-fonts.swift` (optional extra QA glyphs)
- `docs/art-grid/extension-room-redraw.md` (this report)
- Generated evidence under `artifacts/art-grid/round-3/`.

Existing uncommitted work is retained. No commit, stash, historical-asset deletion,
runtime PNG edit, simulation/economy/save/HUD/character change or new animation.
Main-room surface painters and approved artwork are not redrawn.

## Verification and limitations

Exact command outcomes and baseline comparison are in
`artifacts/art-grid/round-3/report.json`; complete logs are alongside it.
No existing test contract is changed. New tests cover palette/grid, calm fields,
doorway framing and actor separation, chair upholstery/contact, travelling light,
night suppression, continuous lamp falloff, table alpha/material preservation,
shared thought measurement/wrapping and integer binary glyph painting. Existing
thought timing/placement tests remain in the focused run.

`node scripts/extension-room-qa.mjs` produces native day/night painter composites,
a reserved-equipment kitchen and both thought locales. The offline canvas uses
real source assets and production painters, CoreText scratch masks fed through
the actual sign thresholding code, and additive lamp pools at runtime anchors.
Composites are palette-snapped for PNG conformity checks. They are not browser
captures: Phaser actor sorting, camera projection, live customers/cooks, touch
interaction and final WebGL blending still need the external Chrome pass. No
Chrome or local server was launched in this sandbox.
