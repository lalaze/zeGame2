# Cozy cast v5 — native guest family

Built-in `image_gen` generated the four originals in `sources/`. The originals
remain unchanged, including their removable magenta background. `prompts.md`
records the generation specifications. `hashes.json` identifies the sources,
runtime sheets, manifest and production script. No v4 files were overwritten.

Primary visual reference: `public/art/generated/cozy-team-v7/hair-0-short-v1.png`.
Supporting reference: `public/art/generated/cafe-style-sample-v1/sample.png`.
The staff sheet and café sample were opened as image references before generation.

## Production

Python/Pillow extracts individual connected silhouettes, not assumed generator
grid rectangles. This matters where a braid tip overlaps the next row's crop.
Each body is authored into a 64×88 art-pixel frame (32×44 room pixels). Heads
are separate 48×48 components. There are twelve body families × twelve poses
and eight hairstyles × three directions. Left-facing art is mirrored in the
adapter; all published guest frames, including foregrounds, register density 2.

The production pass cleans pupils, adds highlights, mouth and blush, aligns necks,
and puts material channels on exact master-palette ramps. Palette recolouring is
an exact ramp substitution rather than RGB multiplication. Cream garments remain
cream; exposed skin, hair, garment and trousers follow the saved `Look` independently.
Accessories use the nearest existing master-palette accent; no palette was changed.

Standing bodies end at (16,42), with no subsequent 1.6× enlargement or leg stretch.
Seated bodies share the existing chair: floor (13,41), hip/cushion (13,32), matching
the staff's measured 31–32px seated hip band rather than the old nominal 27px anchor.
Normal hands reach the existing table surface, petting hands have separate contacts,
and only the upper body/reaching arm reappears above the table. Existing chair and
table paintings, seat positions and room art are not changed. Seating metadata marks
the new guests as chair-free so the scene draws its existing chair separately. No
furniture pixels are copied into, recoloured with, or resampled as part of a guest.

Guest 1 now resolves through its saved cast slot like every other guest; it is no
longer replaced with the historical sample painting. The standalone historical
sample files remain available and no appearance/save data is migrated.

## Rebuild

Requires Pillow. This workstation has it in `/usr/bin/python3`, not the Homebrew
Python. From the repository root:

```sh
for name in bodies-a bodies-b bodies-c heads; do
  /usr/bin/python3 "$HOME/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py" \
    --input "assets/generated/cozy-cast-v5/sources/$name.png" \
    --out "assets/generated/cozy-cast-v5/working/$name.png" \
    --key-color '#ff00ff' --tolerance 100 --spill-cleanup --force
done
/usr/bin/python3 scripts/build-cozy-cast-v5.py
node scripts/pixel-conform.mjs check public/art/generated/cozy-cast-v5/*.png
node scripts/cozy-cast-v5-offline.mjs
```

Every finished runtime sheet passes through `node scripts/pixel-conform.mjs conform`
at its exact final dimensions. Intermediate native paintings use `compiled-*`
filenames so a rebuild cannot accidentally use a previous native head sheet as its
high-resolution input.

## Evidence

`artifacts/art-grid/round-4/cast-after-offline.png` shows four staff roles and all
30 guests, standing and seated at the **same** integer scale (four display pixels
per room pixel). Unlike the before capture, seated figures are not miniaturized.
`seating-after-offline.png` composites all 30 identities with both chair directions,
the existing table, and the real foreground pass. The software canvas invokes the
actual TypeScript asset loader/resolver and world-grid conversion; it is not a
Phaser/browser screenshot. `offline-metrics.json` records contacts and dimensions.
`report.json` records build, test-baseline and palette results plus limitations.

The test protecting the old team-only early return was intentionally replaced:
both complete-body families now bypass the retired customer enlargement and sample
override. New tests cover manifest completeness, all identities, all 540 frames,
native backings, proportion bounds, mirrored contacts, exact palette recolouring,
and the unobscured eye highlights inside glasses.
