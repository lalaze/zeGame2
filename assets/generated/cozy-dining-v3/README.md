# Matched dining station v3

Built-in image_gen redesigned the whole station: a thin walnut tabletop with a
linen inset, full-height olive-cushioned chairs, and 30 customers in three seated
actions each. A person and their chair are one intact authored painting. The
runtime never stretches legs or moves a head, pelvis, or separate occupied chair.
Empty seats use the same chair design as a separate furniture sprite.

`design-prompt.txt`, `prompt-0.txt` through `prompt-9.txt`, and `generation.json`
record the exact prompts and selected original outputs. The source sheets are in
`sources/`. Guest IDs, Looks and standing/walking artwork retain their meanings.

Run `node scripts/build-cozy-dining-v3.mjs` to compile all 90 units. Each identity
uses one uniform scale for all three actions, with a shared ground baseline.
The compiler extracts complete connected units, resamples to the native density-2
art grid and snaps alpha and colours to the existing master palette. It never
separates anatomy from furniture or changes their internal proportions.

Runtime sheets and their manifest live in `public/art/generated/cozy-dining-v3/`.
The complete design sheet supplies the matching table and empty chair through
`src/render/dining-table-manifest.json`. `SEATING_LAYOUT` shares the station's
seat spacing, tabletop and floor calibration with the Phaser scene and previews.
The linen inset receives tablecloth colour selections; walnut stays unchanged.

Validation: `npm test -- src/render/cozy-cast-art.test.mjs`, the navigation and
chair-access suites, `npm run build`, and game captures in `artifacts/dining-v3-*`.
