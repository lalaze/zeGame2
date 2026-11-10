# Café team v9 — pixel-art repaint with walk cycles

The owner, barista, servers and cook, repainted to match the v9 guests
(`../cozy-cast-v9`): 32 hairstyle families and the chef, each from ONE Codex-generated
sheet. Style reference: `style-b-staff.png`.

Unlike the guests, the team is recoloured at runtime: `src/render/team-pixel-art.ts` labels
every source pixel skin, hair, apron, trousers or "other" by colour tests and paints each in the
saved look's ramps. So these sheets are not final pixels but sources for that pipeline.

## What a kit is

`kits/<id>/take-T/sheet.png` (`<id>` is the hairstyle index or `chef`), 4 rows by 7 columns:

| Row | Columns |
| --- | --- |
| front, back, right profile | standing, then a six-frame walk cycle |
| seated on the wooden chair | hands on lap, reaching forward, reaching lower (three figures only) |

`sheet.json` records the prompt, references and Codex thread. Codex was shown the previous
family sheet and seated row of the same look (`refs/`, `../cozy-team-v8`,
`public/art/generated/cozy-team-v7`) so each hairstyle stays the one players saved.

## From sheet to source colours

`scripts/art-gen/team-kit.mjs` cuts the figures out and snaps every pixel to a short list of
source colours chosen well inside the pipeline's tests (`SOURCE_COLOURS`). Generated colours
wander around those limits; an unlabelled speck keeps its chestnut or sage whatever colour the
player picks. It also:

- removes single-pixel noise left by the snap;
- turns a skin patch painted only in the shadow tone into the base tone (the pipeline accepts
  an ear or hand only if it holds some full-brightness skin);
- turns a peach highlight inside the hair into hair, and an eyebrow into the darkest hair brown
  (lighter, it would be taken for a mouth);
- keeps the outline near black, the only darkness the pipeline reads as an eye.

It then runs the real labelling on every pose and warns when brown above the neck is not
labelled hair, skin is not labelled skin, or the apron is not labelled cloth.

Two changes in `team-pixel-art.ts` came with this pack: the apron is claimed by colour before
the chair's zone (seated, it drapes over the lap), and shade cuts compare the same rounded
brightness the histogram counted (a flat colour could otherwise fall below its own cut).

## Regenerating

```sh
node scripts/art-gen/team-batch.mjs --ids=12,chef --take=2    # new takes; --all for everyone
node scripts/art-gen/team-review.mjs --out=/tmp/staff-review  # every pose, recoloured, to look over
node scripts/build-team-v9.mjs                                # compile the pack (newest take wins)
npx vitest run src/render/cozy-team-art.test.ts src/render/team-pixel-art.test.ts
```

Then open `/scripts/team-art-fixture.html?verify=1&zoom=2` on the dev server: it paints 32
role and look combinations through the game's own loader and checks 768 frames.
`selected.json` (`{ "12": 1 }`) pins a take. One sheet takes Codex about three minutes.

## What the build writes

`public/art/generated/cozy-team-v9`: `hair-N-name-v2.png` (27 poses: nine standing, then the
three cycles), `seated-a..h-v2.png` (four hairstyles, three poses each), `chef-walk-v2.png`,
`chef-seated-v2.png` and `manifest.json`. All PNG: the pipeline needs exact colours.
