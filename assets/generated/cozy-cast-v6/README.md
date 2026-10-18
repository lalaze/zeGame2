# Whole-figure café guests v6

The 30 existing guest identities now use individually painted, complete figures.
Each has 12 authored poses: three front, three back, three right-facing walking,
one seated and two petting. Mirroring supplies the six left-facing poses, giving
540 published frames. Heads, collars, shoulders and bodies are one painting;
the runtime never positions a separate head or extends a neck or leg segment.

Built-in `image_gen` produced ten transparent 6×6 atlases. `prompt-0.txt` through
`prompt-9.txt` contain the exact generation prompts. Two additional edit prompts
corrected accessory consistency and removed accidentally included cats. The
selected source bytes are in `sources/`; generation provenance is recorded in
`generation.json`. Existing staff artwork supplied the proportion/style reference.
Guest IDs, saved Looks, the customer cycle and the staff customization system
keep their existing meanings.

`node scripts/build-cozy-cast-v6.mjs` finds transparent gutters, extracts all 360
complete figures, resamples them with the shared dominant-colour converter and
snaps colours/alpha to the existing master palette. Walking and seated poses use
the same whole-figure scale. No head, torso or leg is independently scaled or
repositioned. The seated hip matches the existing chair cushion; a 40×20 table
places its surface at the forearms, below the shoulders. Cups and vases share
that tabletop plane at y=-15 relative to the table's room anchor.

Runtime sheets live in `public/art/generated/cozy-cast-v6/`: 80×88 art pixels per
frame, at density 2 (40×44 room pixels). Standing floor contact is (20,42).
Seated contacts are floor (18,41), hip (18,32), mirrored to x=22 for the left view.
The wider transparent canvas accommodates ponytails and reaching hands. Chairs
remain separate; the foreground pass copies only the same figure's upper body
and reaching hand over the table. Neck metadata is descriptive, never a joint.

Validation:

- `npx vitest run src/render/cozy-cast-art.test.mjs src/render/cozy-team-art.test.ts src/render/fine-sprite-art.test.ts`
- `npm run build`
- `reference-character-qa.html?qa-cast=27&qa-clean` renders the real CaféScene,
  all 30 guests and four customized staff, with visible assertion results.

`artifacts/cast-v6/` contains actual browser captures and validation results.
The tests check intact atlas-to-runtime pixels, the blond profile's collar
silhouette, all 540 frames' palette/alpha/edges, mirrored images and contacts,
and foreground pixels matching the full figure.
