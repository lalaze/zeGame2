# Tiny Bean Cafe — decorative prop source candidates v1

Frozen source-art handoff, 2026-10-13. All 13 requested IDs have a real independent PNG candidate. This folder contains no game-code integration, repository change, commit or push. Candidate production does not certify runtime rendering or scene acceptance.

## Exact delivered IDs

- sill_cactus
- sill_tulips
- sill_bonsai
- ceiling_lights
- ceiling_vines
- ceiling_pendants
- ceiling_chandelier
- rug_red
- rug_blue
- rug_round
- neon_cafe
- neon_heart
- neon_cup

There are no missing PNGs. No tiles, counters, furniture or hanging-pot replacement were generated in this folder. ceiling_vines is the overhead vine trim.

## Files and provenance

- `manifest.json`: every selected PNG, exact ID/state, absolute file and immutable source paths, original imagegen output path, source size, source crop, crop size, alpha>128 bbox, native/opaque aspect, logical envelope, semantic anchor and SHA-256.
- `sprites/<id>.png`: 13 lossless crops for later review/integration.
- `sources/<id>-source.png`: 13 untouched first-generation outputs, copied byte-for-byte from imagegen. Source files remain present at their original paths as well.
- `sources/sill_cactus-correction-source.png`: one unused imagegen edit attempt; never selected or counted as a new asset.
- `PROMPTS.json`: exact 13 submitted initial prompts, using the parent's prepared prompts as baseline.
- `UNUSED-CORRECTION-PROMPT.json`: exact optional cactus edit prompt.
- `SOURCE-MAP.json`: all original imagegen output paths.
- `package_props.py`: reproducible measurement and crop packaging only.
- `cactus-alpha-qa.png`: separate alpha-composited inspection on a light solid background. This is a QA preview, not a game asset.
- `SHA256SUMS.txt`: freeze inventory hashes.

Generation used the built-in imagegen tool, one independent call per ID, in parallel. Reference images were inspected before generation: `/workspace/scratch/30a3201ff9cd/cafe-assets-v1/tiny-bean-furniture-sample-v1.png` and `/workspace/scratch/30a3201ff9cd/cafe-main-wall-v1/wall-source.png`. The sources guided the warm, detailed, pixel-clustered material style; no existing asset pixels were edited into the new sprites.

## Crop / anchor contract

`source_crop` is `[left, top, right-exclusive, bottom-exclusive]` in the immutable source. Crops are alpha>128 bounds plus 10 pixels on each available side, clamped only at original source edges. Alpha>128 is used only to measure bounds. All RGBA values inside each rectangular crop are byte-identical to the corresponding original source region, verified with full pixel comparison. There is no resizing, recoloring, masking, alpha cleanup, pixel deletion within the crop or algorithmic painting.

The full source retains all alpha. Tiny alpha=1/255 pixels outside the crop are measured and reported separately; no outside pixels with alpha>1 are excluded by this packaging. All selected assets have real zero-alpha regions. The original cactus has alpha up to 254/255 rather than 255, retained unchanged. Its apparent brown background in some direct PNG previews is hidden RGB at zero alpha; actual light-background alpha compositing verified no exterior brown halo. The unnecessary correction is retained unused for honest provenance.

`foot` is the sill pot's bottom contact, derived from the lowest 2% of opaque support span. Ceiling pieces have `top`; rugs and wall neon motifs have `center`. All points are crop-local source pixels. These are candidate authoring anchors, not a runtime integration guarantee. Preserve native aspect and apply uniform scaling. Existing logical envelope and collision footprint must remain unchanged; any later render overflow must be reviewed explicitly. World painter and shop thumbnail should share the same source.

## Visual QA and honest limitations

- All initial sources were visually inspected. Each fixture is unlit; the chandelier has five visible dark wicks and no flames. No exterior emitted glow was identified in the actual alpha.
- ceiling_lights has four bulbs. White glass highlights are painted reflections; light emission/flicker remains a runtime layer.
- ceiling_chandelier reaches the original canvas top and bottom. The top mounting element and lowest crystal tip lack transparent margin and may need later integration review. No missing edge pixels were reconstructed.
- ceiling_pendants cord reaches the original top edge, which can serve as its ceiling attachment point.
- sill_tulips has exactly three blooms, but three broad leaves instead of the prompt's two.
- rug_red and rug_blue have their fringes at left/right, not at the prompt's top/bottom. They were retained without rotation or stretching.
- Native content aspects differ from nominal envelopes. In particular neon_cafe is substantially slimmer than the requested 3:1 body; inspect runtime text fit and preserve its actual aspect.
- neon_cafe has a genuinely blank dark center with no letters, logo, symbol or glass tubes. Runtime cafe text remains separate.
- neon_heart and neon_cup have transparent interiors; cup has three steam curls and a right handle. Reflection highlights remain in the authored tube material; dynamic neon glow remains separate.
- ceiling_vines is independent dangling trim with real transparent gaps. Seamless joining at its endpoints is not certified.
- No aesthetic reroll cycle was performed. All assets are `candidate_pending_integration_review`.
