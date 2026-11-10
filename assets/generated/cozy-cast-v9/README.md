# Café guests v9 — pixel-art repaint with walk cycles

All 36 guests repainted in the approved "style B" (compact chibi, dot eyes, flat colour
blocks, crisp dark-brown outline), each from ONE Codex-generated sheet so every pose of a
guest shares colours and proportions. Style reference: `style-b.png` (chosen 2026-11-10 from
three directions; the comparison is in `../cozy-cast-v9-pilot/review/`).

## What a kit is

`kits/customer-N/take-T/sheet.png` is 4 rows by 7 columns:

| Row | Columns |
| --- | --- |
| front, back, right profile | standing, then a six-frame walk cycle |
| seated on the café chair, facing right | at the table, petting, petting lower, four coffee-cup frames |

The coffee-cup frames are not used by the game yet. Next to the sheet, `walk-front.gif`,
`walk-back.gif`, `walk-right.gif` and `seated.gif` are the animated GIFs Codex cut from the
same sheet (for review; the game frames are cut from `sheet.png` itself, which keeps full
transparency), and `kit.json` records the prompt, references and Codex thread.

## Regenerating

```sh
node scripts/art-gen/cast-batch.mjs --ids=8,26 --take=2   # new takes; --all for everyone
node scripts/build-cozy-cast-v9.mjs                        # compile the packs (newest take wins)
node scripts/art-gen/cast-check.mjs                        # seating contracts, per guest
npx vitest run src/render/cozy-cast-art.test.mjs
```

`selected.json` (`{ "8": 1 }`) pins a take when a newer one is worse. `prompts/kit-template.txt`
is the brief; `identities.json` holds each guest's description; `refs/` are the previous
sprites Codex was shown so it knew who each guest is. One kit takes Codex about five minutes.

## What the build writes

- `public/art/generated/cozy-cast-v9/customer-N.gif`: twelve poses in the v8 order.
- `public/art/generated/cozy-cast-v9/customer-N-walk.gif`: six-frame cycles, a row per direction.
- `public/art/generated/cozy-dining-v5/customer-N.gif`: the three seated poses with the chair.
- PNG masters under `assets/art-masters/`, rows in `assets/art-masters/conversion.json`.

Frames are 80x88 art pixels, snapped to the guest palette with on/off transparency. Standing
figures are 78 px tall with feet on y=84 and the head centred on x=40; seated figures keep the
same scale (shrunk only when they would not fit), chair legs on y=84, rear leg on x=18.

## Known rough edges

- Guest 26: the second petting frame is 3 px wider than its frame allows, so the chair shifts
  3 art pixels in that frame.
- Guests 11, 24 and 31: one front walk frame is 5 px shorter than the standing pose (a deeper
  dip than the others).
- `review/` has every frame of every guest and in-game phone screenshots, including the
  guests whose seating needed fixing (8, 10, 11).
