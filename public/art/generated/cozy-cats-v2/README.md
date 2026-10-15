# Cozy cats v2

Twelve independently generated transparent PNG atlases, each with fourteen newly drawn poses. Built-in `image_gen` produced every atlas on 2026-10-15 using the approved café style image and the first ginger cat atlas as family references. Complete prompts and original output paths are in `generation.json`; runtime sources live beside this file and do not depend on those original paths.

Breeds: ginger, tuxedo, calico, tabby, black, white, British Shorthair, American Shorthair, Siamese, Ragdoll, Persian and Maine Coon. Shorthaired, slender Siamese, round British, fluffy Ragdoll/Persian and tufted Maine Coon silhouettes are separately authored. No code recoloring is used.

Pose order: idle, tail swish, blink, happy, walk A/B, sleep, groom A/B, stretch, watch, look up, nuzzle A/B. Walking faces left; seated poses face right, retaining the production `residentCatFlipX` contract. The final two cells of each original 4×4 atlas are empty.

`manifest.json` records original PNG sizes/SHA256, measured connected silhouettes, independent crop rectangles, ground anchors and calibrated forehead contacts. Crops follow actual sprites rather than rigid grid boundaries so long tails and fur are not cut at cell edges. The original source PNGs and their alpha are unchanged. Every breed uses one scale across all fourteen poses. Forehead estimates were checked against the actual baked pixels; the higher tails of walking Ragdoll and Persian required a lower forehead estimate.

`src/render/cozy-cat-assets.ts` loads all twelve atlases atomically, bakes 4× art inside the existing 24×18 logical envelope and publishes a `GeneratedCatAdapter`. Foot `(12,17)` and draw offset `(-3,0)` preserve the scene's existing floor convention. Contact points mirror around the same foot. `setGeneratedCatAdapter` lets existing pet catalog/detail portraits use the same frames as the world. Source atlases are not retained after baking.

Validation completed:

- Focused Vitest contract suite: 5 passed, including complete breeds/states, source crop contacts and clipping rejection.
- Actual installed Chrome: 168 nonempty frames, no opaque edge pixels, distinct walk/nuzzle frames, stable shared resolver, 12 generated UI portraits, all forehead anchors inside rendered silhouettes and exact mirrored x contacts.
- Visually inspected the complete runtime-resolution sheet in `artifacts/cozy-cats-v2-all-poses.png`. Machine-readable checks are in `artifacts/cozy-cats-v2-browser-report.json`.
- Production scene integration and the final full-project check are owned by the overall redraw verification. This focused check does not independently establish in-scene pet-hand alignment.

To remeasure source metadata with an available Sharp installation:

```sh
SHARP_MODULE=/path/to/sharp node scripts/cozy-cats-v2-manifest.mjs
```

For the browser fixture, run `scripts/cozy-cats-v2-browser-check.js` with `agent-browser eval --stdin` on an isolated local Vite page. It replaces that temporary page's DOM with the inspection sheet and never changes the user's saved café.
