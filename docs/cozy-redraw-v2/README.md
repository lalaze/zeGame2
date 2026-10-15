# Cozy artwork unification — 2026-10-15

All identified older production artwork now uses the current rounded, warm pixel-art style. The approved `cafe-style-sample-v1/sample.png`, `cozy-cafe-v1` furnishings and current cozy cast/team are the style references. Existing updated humans and seating retain their artwork and identity.

## Delivered packs

All new bitmap artwork was created with the **built-in image_gen tool**. Sharp was used only to crop and pack generated RGBA, with nearest-neighbor sampling. Source sheets, complete prompts and registration data are retained:

| Pack | Coverage | Saved assets and prompts |
| --- | --- | --- |
| Menu | 55 dishes, 12 ingredients | [cozy-menu-v2](../../public/art/generated/cozy-menu-v2/) — `generation.json`, `manifest.json` |
| Signature drinks | 14 compositing layers, four registered cup interiors | [cozy-signature-v2](../../public/art/generated/cozy-signature-v2/) — `generation.json`, `manifest.json` |
| Furnishings | 39 furniture/decor items, 13 finish-slot props | [cozy-furniture-v2](../../public/art/generated/cozy-furniture-v2/) — `prompts.json`, `manifest.json` |
| Cats | 12 breeds/coats × 14 poses = 168 frames | [cozy-cats-v2](../../public/art/generated/cozy-cats-v2/) — `generation.json`, `manifest.json` |
| World | 17 kitchen pieces, three extension backgrounds, six environment pieces, seven tableware/effects, materials, counter finishes and main-room service props | [cozy-world-v2](../../public/art/generated/cozy-world-v2/); [source sheets, complete prompts, crops and hashes](../../assets/generated/cozy-world-v2/) |
| Small service props | Grinder, milk pitcher, empty transparent cake dome, numbered-card holder | [cozy-service-v2](../../public/art/generated/cozy-service-v2/) — `generation.json`, `manifest.json` |

The five counter finishes include reuse of the already-current cozy oak cabinet. Historical PNGs are retained for archive tests and renderer fallback; production mappings select the new packs.

## Integration and verification

- Scene, shop icons, cats and art gallery share the current adapters. The gallery now exports the fine sprite backing rather than the old low-resolution proxy; bounded 120px export frames avoid excessive atlas allocations. It exports **980 frames and five room backgrounds**. The 1536×10496 atlas has no frames outside its bounds.
- Kitchen equipment preserves installation gates, collision footprints and cook routes. Food, stock, numbered cards, clock hands, lights and cooking feedback remain live. The rack, bench tools and steam are registered to actual artwork bounds.
- Cat silhouettes, scales, feet and mirrored head-contact metadata are measured for all 168 frames. Real scene pet interaction succeeded, selected the correct cat and did not consume care.
- Desktop Chrome screenshots inspected for all five rooms; 390×844 viewport has `scrollWidth=390` and no horizontal overflow. See [screenshots](images/).
- Actual gallery ZIP download passed `unzip -t`. The game and final gallery reported no uncaught runtime exceptions. The intermediate gallery cat-unwrapping and low-resolution export issues found during QA were corrected and rechecked.
- `npm run build`: passed. `@types/node`, already present in the lockfile, is now an explicit development dependency so the project's test files typecheck.
- Focused renderer/loading/cat tests: **77 passed**. Historical packing checks were separated from current replacement mappings, with 19 additional coverage checks.
- Full suite: **2346 passed, 114 failed, 41 skipped**. An isolated checkout of HEAD `619363d` reproduced the same 114 failed tests and four failed suite entries. Final failure titles match exactly, with **no additional failures**; see [comparison](test-comparison.json). These existing failures were not suppressed.

No gameplay prices, progression, routes, customer identities or save formats were changed. Browser verification used an isolated temporary café, not a user's saved game.

Local preview: [game](http://100.96.195.115:5173/) · [art gallery and downloads](http://100.96.195.115:5173/sprite-preview.html).
