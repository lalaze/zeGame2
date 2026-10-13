# Full generation checkpoint — 2026-10-13

This directory is an isolated authoring collection. No file here is registered in runtime loaders, adapters or service-worker precache. Integration is intentionally deferred until the requested code push is verified.

## Contents and exact scope

- 896 new cropped PNGs and 195 necessary original generation images.
- Images total **444,001,144 bytes**: sources **235,962,055**, crops **208,039,089**. Largest image **2,661,843 bytes**.
- Menu: 50 remaining items and 12 ingredients; five existing menu bitmap identities reused.
- Fixed customers: 29 remaining identities × 15 poses, preserving individual metadata.
- Cats: 11 remaining breeds × 14 actions.
- Furniture: 36 new assets and 3 aliases cover 39 placeable IDs.
- Decor: 34 new component PNGs plus existing oak modules cover 31 non-empty selections; four `none` choices require no bitmap.
- Environment: 22 modules for the five room areas. Kitchen: 18 static bodies with explicit existing dynamic-overlay reuse.
- UI: 36 assets and two upgrade aliases, including signature-drink component candidates.
- Custom staff/owner: 99 material-coded frame candidates across 11 physical families, representing 15 role/style recipes. **Zero runtime Looks are certified**. Six incorrect server back poses are quarantined in `parameter/failed-frames/`; 23 other poses require extra boundary review. The six failures are included in the file count, not usable coverage.

## Reproducibility

`FREEZE-MANIFEST.json` records every selected image SHA-256 and byte size. Portable manifests retain exact lossless source rectangles, alpha bounds and anchors. Each normalized JSON has an untouched `.original.json` companion for original authoring provenance. Source images shared by valid and failed frames remain intact.

Duplicate packed sheets/repeat proofs and superseded failed source images are omitted. Their historical metadata may remain in original JSON or `omittedRegenerableProofMetadata`; they are not input dependencies. Six residual historical paths reported by the freeze manifest refer to excluded QA/unused corrections, not selected source rectangles. Selected source/crop dependencies are separately audited after relocation. No generated pixels were repainted, masked, resized or re-encoded in this staging step.

## Still requires implementation and verification

Read `KNOWN-GAPS.json` and per-domain README/manifest notes. Material decoding and custom identity coverage have not passed. Signature drinks require liquid-body clipping/fill and correctly registered rim/dose layers. Several kitchen bodies need aspect-preserving layout and dynamic-door/attachment calibration. Actor gait, seat and pet contact anchors; texture seams; hanging-light bounds; tiny menu readability and alpha fringes all need actual game checks.

Successful source/crop integrity is not visual acceptance, mobile performance verification or completion of all-scene replacement. Existing validated runtime code and assets remain the playable checkpoint.
