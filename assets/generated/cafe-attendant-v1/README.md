# Café attendant redesign

Generated with the built-in `image_gen` tool. The exact prompt is in [prompt.txt](prompt.txt).
The unmodified transparent output is shipped at `public/art/generated/cafe-attendant-v1/attendant.png` (1086 × 1448).

The cream cap, tidy short hair, small shoes and three-head proportions replace the older broad-haired figures for `server` and `barista`. Uniform caps cover employee hairstyle variants; saved appearance data is not rewritten. Skin, hair, apron and trousers retain their palette choices. Owners and cooks keep their existing silhouettes.

The atlas contains twelve complete poses: front / back / right × standing / opposite walking steps, then seated / two reaching poses. Left-facing poses mirror right-facing poses. Front and back use their authored opposite steps to keep the fringe and apron pin stable.

Bounds in `cozy-team-v7/manifest.json` were measured from alpha ≥ 100 with transparent row gutters; the first row ends at y=364, beyond an equal-quarter grid boundary. Contact anchors are source-local. All nine standing poses share one uniform scale and the existing world foot point (16, 42).

Validation: `npm run build`; focused character tests; `node scripts/attendant-art-qa.mjs` (optional `CAFE_QA_URL`). Browser QA checks 288 frames, palette coverage, unclipped silhouettes, unique gait frames, seating foregrounds, tray contact and mobile overflow, saving evidence to `artifacts/cafe-attendant-v1-*`.
