# Street art v2 — storefronts and scenery

What rebuilds `public/art/street-art-v2`: the street the café sits on, its eight storefronts and
the scenery layers behind them. The user approved both images on 2026-11-09. They were
generated outside this repo, so there is no prompt or batch script here.

| File | What it is |
| --- | --- |
| `source/storefronts/01-cafe.png` … `08-vacant-blue.png` | The eight approved storefronts, one transparent PNG each (`README.txt` came with them) |
| `source/storefronts/storefront-atlas-clean.png`, `storefront-preview.png` | The same storefronts as delivered, on one sheet |
| `source/approved-street-scenery-v4.png` | The approved street scene. Clouds, town, hills, paving, curb, bench, lamp and the depth layers are cut from it |

## Rebuilding

```sh
uv run --with pillow python docs/street-art-v2/process-assets.py           # storefronts, scenery, anchors.json
uv run --with pillow python docs/street-background-depth/process-assets.py # depth-*.png layers
node scripts/convert-art-webp.mjs                                          # ship them as lossless WebP
npx vitest run src/render/street-art.test.ts
```

The scripts live next to their acceptance notes in `docs/`. They crop at fixed boxes in these
two images, so a new storefront or scene needs new boxes, not just a new file. The storefront
script also writes `docs/street-art-v2/provenance.json`, and the depth script writes
`docs/street-background-depth/assets.json`.

On 2026-11-22 both scripts were rerun in a scratch copy from these files: all 22 PNGs and
`anchors.json` came out byte-identical to the shipped masters.

These sources lived in `docs/street-art-v2/source/` until 2026-11-22. They moved here so the
images under `docs/` are only QA media. The art library still has a copy at the old path.
