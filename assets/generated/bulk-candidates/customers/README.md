# Fixed customers 1–29: complete bitmap source pack

Status: source QA and crop/metadata audit complete; runtime integration and visual validation pending the root checkpoint. No repository code, runtime assets or Library files were changed by this worker.

## Contents
- 29 identity-specific `cast-01` through `cast-29` directories
- 435 lossless RGBA frame crops, exactly 15 per identity
- Each directory contains `identity-contract.json`, `prompt.txt`, final `source.png`, and `renderer-manifest.json`
- Aggregate `renderer-manifest.json` indexes the frozen final per-cast manifests
- `audit-report.json` records passing identity metadata, pose coverage, scale, alpha, anchor-bound, frame uniqueness and byte-identical source crop checks
- `crop_frames.py` and `audit_frames.py` reproduce crops/metadata and integrity checks
- Discarded pre-repair sources are retained for provenance but must not be integrated

## Identity contract
The authoritative source is `docs/pixel-depth/BULK-ASSET-CATALOG.json` in zeGame2, with `CUSTOMER_HAIR`, `HAIR`, garments and accessories from `src/render/sprites.ts`. The old-A 30-person cast reference was visually cross-checked as an identity reference. Mina's existing sheet supplied the latest rendering style, not a universal identity.

Every ID retains its original Look, hairstyle, outfit and accessory metadata. Palette hex values are the source identity/prompt targets; the generated art has authored lighting and shading rather than a programmatically quantized exact-color palette. No programmatic recoloring or identity substitution was used.

Hairstyles: 0 short side-swept tousle; 1 tied high bun; 2 long straight hair; 3 knitted beanie with the source shirt-index-derived hat color; 4 tied braid; 5 separate spiky tousled tufts; 6 blunt bob with fringe; 7 swept-up quiff. Customer garments/accessories remain distinct, including worn satchels. No staff aprons or chairs/pets/food/cups are baked into the customer frames.

## Frame order and names
Source sheets are 3 columns by5 rows:
1. Down: stand, stepA/stride, stepB/passing-knee
2. Up: stand, stepA/stride, stepB/passing-knee
3. Right: stand, stepA/stride, stepB/passing-knee
4. Right seated: sit, sitPetA, sitPetB
5. Left seated: sit, sitPetA, sitPetB

Walking left uses runtime mirroring of right. Explicit left/right sitting frames are supplied. Crop filename: `customer-{id}-{direction}-{state}.png`.

## Geometry and alpha
Source coordinates were inspected in each generated sheet. Independent sprites were located using opaque connected components, then cropped with padding without changing RGBA pixels. Source component/crop positions are recorded per frame. Bounding boxes use alpha>128, not all-nonzero alpha. Each crop has genuine alpha0 and alpha255, and the audit confirms pixel-for-pixel equality with its final source rectangle.

Exactly one source-to-world scale is shared across all15 poses of an identity. It is calibrated from that identity's first standing frame to world height28, preserving the authored head scale across walking and sitting. Individual pose heights are never normalized. Crouching/leaning pose height differences are intentional.

Seated feet are estimated from the lowest8 opaque shoe rows. `seatContact` is a provisional rear-hip estimate from the inspected silhouette. Four petting fingertip contacts per identity were manually inspected in final source coordinates and saved in `manual-pet-contact-source.json`. All these anchors require runtime calibration; they are not validated collision geometry. Preserve the seated hip world position when changing poses, not the whole-body bounding-box center. Some reaching arms hang alongside the knee rather than projecting far in front, so use each frame's specific fingertip contact.

## Repairs completed with built-in imagegen
- Cast2: corrected right-facing seated idle
- Cast4: restored deep-brown source complexion
- Cast18: corrected all seated directions and reaching gestures
- Cast25: restored missing visible front-facing hair bow
- Cast27: corrected seated directions, with a second targeted edit to right seated idle
- Cast29: removed a generated cloudy halo/background while preserving character silhouettes

All final sheets were visually inspected after their last imagegen call. No remaining identified source direction, missing-accessory, clipping or background failures are held. This is source QA readiness, not a claim that the frames are already correct in-game.

## Runtime acceptance still required
Verify every fixed ID in-game; check head-size consistency, gait timing, planted-foot jitter, seated hip placement, chair/table occlusion, pet contact, edge alpha on café backgrounds, and visual identity/palette at actual display scale. Refine anchor metadata if the runtime geometry needs it. No integration was performed here.

Generated with the built-in imagegen tool. Full first-pass prompts are saved per identity; repair prompts are saved where present and summarized above. Python was used only for lossless authorized cropping, metadata and integrity checks.
