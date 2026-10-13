# Cafe selectable decor source pack v1

Scope is the 31 bitmap-bearing decor choices from the supplied catalog. Four choices are intentionally excluded: sill_none, ceiling_none, rug_none, neon_none. Their empty states need no image.

This directory supplies 13 new wall/floor material tiles plus four new counter material sets with independent top/front PNGs, for 17 new IDs and 21 PNGs. The existing oak countertop/front are explicitly reused as two alias entries. The separately authored 13 sill/ceiling/rug/neon sprites live in `../cafe-decor-props-v1`. The frozen `renderer-manifest.json` combines all 31 required IDs: 34 new PNGs and two existing oak alias PNGs. Four none states are explicitly excluded. Missing IDs and duplicate ID/state pairs are both zero.

All substantive art used built-in imagegen. `PROMPTS.json` contains the exact specifications, and `batch-1.json`/`batch-2.json` map immutable selected sources. `sources/` retains the full generated files. `package_materials.py` only copies files, analyzes coordinates/colors for measurements, selects rectangular crops and packs unchanged pixels. It never repaints, blends, mirrors, recolors or removes image backgrounds.

## Material tiles

Wallpaper and floor PNGs are opaque flat material candidates, not room images. Each includes an unchanged native-resolution 2x2 `*-repeat-proof.png`. `materials-manifest.json` records source dimensions, exact crop rectangle, native aspect, measured edge color difference, estimated motif period where applicable, and a nominal motif unit from the existing renderer.

Cropping first respects the approximate full motif repetition when it can be measured, then selects a low-difference boundary phase. This avoids minimizing RGB error by arbitrarily cutting a checker or brick halfway through a pattern. Some irregular textures retain their complete source instead. The source pixels remain unchanged.

Imagegen does not mathematically guarantee seamless tiling. These are source candidates with repeat proofs and quantitative edge metadata, not a claim that every seam is invisible. Brick dimensions, hand-authored floral repetition and wood grain vary slightly. Herringbone and marble retain larger edge differences and require particular attention during runtime material review. Do not turn the nominal motif unit into the full image's draw size: each tile contains multiple motifs. Choose one uniform pixels-per-world-unit scale for each material and verify pattern density in all rooms and shop icons. Do not stretch the source independently in x/y.

No moving shadows, daylight color, live stars, labels or gameplay objects belong to these material tiles. Dynamic effects remain renderer layers. Wallpaper wainscot color/structure still follows the selected decor mapping; no new room geometry is implied by a tile.

## Counter modules

Each new counter variant has separate top and front PNG states. The top includes a slim slab lip and shallow bevel, while the front is an independent raised cabinet panel. Generated fronts are wider than the legacy 190:138 panel shape. Preserve aspect using repeat/crop placement or reviewed uniform scaling; do not squeeze into the old dimensions. The front module's edge details and top slab's end caps may need appropriate cropping/repetition during integration. Source drawings contain no trays, stock, food or appliances.

`counter_oak` aliases the inspected existing `main-v1/cabinet-top.png` and `main-v1/cabinet-front.png`. This is material reuse, not a new generation or validated gameplay substitution.

## Status

Frozen 2026-10-13. `audit-report.json` verifies all 36 entries' source existence, exact RGBA crop equality, bounding boxes, dimensions, hashes and catalog coverage with zero structural errors. `SHA256SUMS.txt` records immutable selected sources/crops and manifests. `freeze_manifest.py` documents the metadata-only audit. Do not rerun generation or repack frozen sources as part of integration.

Prop-specific candidate limitations are preserved in the merged manifest: chandelier touches the original source's top/bottom, pendant cord touches the top, the blank neon text frame is slimmer than the nominal shape, and red/blue rug fringes are on left/right. There are no baked flames or neon text. These limitations do not invalidate the source-count checkpoint, but need explicit consideration at integration.

Asset generation and crop/source integrity are checked separately from runtime behavior. No code, repository file, commit or push was changed by this asset task. All placements, lighting transitions, repeat density, world/shop consistency and alpha blending remain pending the later integration phase. Full sources, exact crop rectangles and SHA-256 hashes are preserved for that audit.
