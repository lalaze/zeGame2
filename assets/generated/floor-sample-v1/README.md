# Floor sample v1: the café in the cross-section style

The cross-section art of the direction chosen on 2026-11-23 (`../art-direction-v1`), drawn by the
game's trial floors view: open the game with `?floors` (`src/render/floors/`, dev server only, as it
loads this folder). It uses the high-angle dollhouse camera the user picked the same day: each floor is seen from the front and about 35 degrees down, so it
has room for the counter at the back, a queue in the middle and tables at the front.

Everything here is a candidate: nothing is shipped or picked take by take yet.

## Where things are

Only what the floors view loads is in git: `build/` (WebP and JSON) and the prompts. The Codex takes
(`kits/`), the references they were drawn against (`refs/`) and the PNG strips the WebP are made
from (`build/*.png`) are in the art library at the same paths (`assets/ART-LIBRARY.md`, list with
checksums in its `moved-2026-11-23.json`). The build scripts read them from there, so rebuilding
works as before. Once art from here ships, its chosen takes come back into git with it.

## What is here

| Path | What it is |
| --- | --- |
| `refs/angle-ground.png`, `refs/angle-building.png` | The high-angle concepts: the ground floor and the whole building |
| `refs/mock-bottom.png` | The side-view floor mock the first character sheets were drawn against |
| `kits/angle-plate-{roof,2f,1f,basement}` | Empty floors: the ground floor is the concept with its people removed, the others are painted to match its camera and scale (`prompts/angle-*.txt`). The basement's `take-2` adds the food lift (`prompts/angle-plate-basement-lift.txt`) and is the one in use |
| `kits/<character>/take-1/sheet.png` | 4×2: walk to the right (4 frames), front, happy, side, back (`prompts/sheet-common.txt` + `prompts/<character>.txt`) |
| `kits/cook-*/take-1/work.png` | 4×2: the baker at the oven with his peel (back view) or the cook kneading, then a walk carrying a tray (`prompts/work-common.txt` + `prompts/work-<cook>.txt`) |
| `kits/cast-NN/take-1/{sheet,moves}.png` | The game's 36 guests (`CUSTOMER_CAST`, by appearance), drawn from their descriptions in `../cozy-cast-v9/prompts/customer-N.txt` (`prompts/cast/cast-NN.txt`), with the same two sheets as the guests below |
| `kits/guest-*/take-1/moves.png` | 4×3: walk towards us, walk away, and four seated poses with a cup (`prompts/moves.txt`, drawn from the guest's `sheet.png`) |
| `build/` | What the pages load: the floors cut through the middle of each slab, the layers drawn in front of people (`counter-front`, `table-front`), one strip of equal frames per sheet (PNG, and the WebP the game loads), and `sheets.json`, the frame size of every strip |

These takes are candidates: nothing here is chosen for the game yet. The side-view plates this
sample started with are in the art library.

## Decor

The ground floor (`1f`) and the seating floors (`2f`) are drawn as layers, so every decor slot of
the game (`src/game/decor.ts`) changes on its own and any combination works. The takes are in
`kits/decor-1f` and `kits/decor-2f` (prompts in `prompts/decor/`):

| Take | Becomes |
| --- | --- |
| `shell` | The empty room every layer sits on |
| `wall_*`, `floor_*` | Repaints of the empty room; cut out with the wall and floor masks all of them agree on |
| `fixtures` | Magenta repaint of the finished plate keeping what never changes; keyed and aligned back. The ground floor's table tops and back counter come from the plate itself |
| `counter_*` | Magenta repaints keeping only the counter, restyled |
| `curtain` | Magenta repaint keeping only the curtains; recoloured for each curtain |
| `ceiling_*`, `rug_*`, `neon_*`, `sill_*` | One thing added to the empty room or the plate; the layer is what changed |
| `centerpieces` | A sheet of three table objects, stood on every table |

Tablecloths are drawn by the build script. Counter, rug and neon are downstairs only; curtains and
the sill upstairs only (the ground floor has no window); the ceiling decor is the same on both.

    uv run --with pillow --with numpy python scripts/art-gen/floor-decor-build.py

writes `build/decor/<floor>/*.webp` and `build/decor/decor.json`; `src/render/floors/floors-decor.test.ts`
checks that every decor item has its layers.

## Furniture

The 42 pieces players buy and place (`FURNITURE` in `src/game/furniture.ts`) are drawn in six sheets
(`kits/furniture/{floor,wall}-N`, prompts in `prompts/furniture/`). Floor sheets start with a copy of
the ground floor's café chair, which sets the scale of everything else on that sheet.

    uv run --with pillow --with numpy python scripts/art-gen/floor-furniture-build.py

cuts them into `build/furniture/<id>.webp` and `build/furniture/furniture.json`. The building has spots
of its own for them (`src/game/building-spots.ts`: what may stand where; `FURNITURE_SPOTS` in
`src/render/floors/floors-layout.ts`: where each is on its plate), one piece each, on every storey but
the basement: 6 on the floor and 4 on the wall with two tables, 12 and 7 from three, 18 and 10 from six.
A piece at one is saved with its `spot` (save v27) and takes no cell of the pixel room's grid, so tables
never push it out and the Sim walks through it; the pixel room (`?pixel`) does not draw it. Pieces still
on the grid move in when the floors view opens (`settleInBuilding`): to where the building showed them
before, else the first free spot, the cosiest first; those left over go to storage. Pieces are drawn no
wider than their spot. If a plate, the awning, the folded doors or the seats move, check the spots
against them (`floors-layout.test.ts`, `building-spots.test.ts`). The decor build clears the fixed decor
on the ground floor's back wall and the potted plants in the front corners.

## The building's frame and outer walls

The floors stand in one building (`scripts/art-gen/floor-frame-build.py`, takes in `kits/frame/<piece>`,
prompts in `prompts/frame/`; chosen 2026-11-23 from the mockups in the library's
`mock/building-frame`, version B with the front entrance F1 and an outer-wall switch):

- `attic`: the top floor under a pitched tiled roof with a chimney and a round gable window. The take
  repaints the roof plate with magenta above it (`kits/frame/attic/input.png`); the build keeps the
  plate below the parapet, so the floor's seats and routes do not move (`FLOOR_ART.roof.above`).
- `pillar` (repeating) down both sides from the eaves to the street, a `beam` over every join.
- `street` under the ground floor, which stands at street level; with a basement the street is cut
  open (`soil`: its paving and the earth) over and around it. `sky` behind the roof.
- The ground floor's open front: `awning`, folded `door-left`/`door-right`, and the `step` guests come
  in by (`DOOR` in `src/render/floors/floors-layout.ts`). Its old side door is covered by
  `side-window` (window, window seat and plant), painted on magenta over the plate in its starting
  decor; take 2 is used, take 1 left the door showing past its plant.
- `wall-attic`, `wall-seating`, `wall-ground`: the front walls shown when the player turns the outer
  walls on (the button under the money, `src/ui/floors-ui.ts`); the basement then sinks into the earth.

    uv run --with pillow --with numpy python scripts/art-gen/floor-frame-build.py

writes `build/frame/*.webp` and `build/frame/frame.json`; `FRAME` and `FLOOR_ART.roof` in
`floors-layout.ts` must match it (`floors-layout.test.ts` checks).

## Ledger pictures

In the floors view the ledger shows this pack's art instead of its pixel icons (`src/ui/icon-art.ts`,
set up by `floorsIconArt` in `src/render/floors/floors-game.ts`): furniture tiles show
`build/furniture/<id>.webp`, and decor tiles a thumbnail of each option standing in its floor,

    uv run --with pillow python scripts/art-gen/floor-thumbs-build.py

which composites `build/decor` with the starting choice in every other slot and crops around the
slot (3:2, 240 px wide) into `build/thumbs/<option>.webp` and `build/thumbs/thumbs.json`.

The menu, pantry and upgrade icons (74: every menu item, ingredient and upgrade) are painted for this
style in ten sheets (`kits/icons/<sheet>`, prompts in `prompts/icons/`: `common.txt`, or
`common-pair.txt` for the two-object `upgrades` sheet, followed by the sheet's own list):

    node scripts/art-gen/codex-image.mjs --out=assets/generated/floor-sample-v1/kits/icons/drinks-1/take-1/sheet.png \
      --prompt=assets/generated/floor-sample-v1/prompts/icons/common.txt,assets/generated/floor-sample-v1/prompts/icons/drinks-1.txt \
      --ref=assets/generated/art-direction-v1/target-shot.png --ref=assets/generated/floor-sample-v1/kits/angle-plate-1f/take-1/plate.png
    uv run --with pillow --with numpy python scripts/art-gen/floor-icons-build.py

The build cuts each sheet in the order `SHEETS` lists the icon keys (and the take it uses) into
`build/icons/<kind>-<id>.webp` (160 px squares) and `build/icons/icons.json`.

## Regenerate and build

    node scripts/art-gen/codex-image.mjs --out=assets/generated/floor-sample-v1/kits/guest-beret/take-2/moves.png \
      --prompt=assets/generated/floor-sample-v1/prompts/moves.txt \
      --ref=assets/generated/art-direction-v1/target-shot.png --ref=assets/generated/floor-sample-v1/kits/guest-beret/take-1/sheet.png
    node scripts/art-gen/soft-frames.mjs assets/generated/floor-sample-v1/kits/owner/take-1/sheet.png --out=assets/generated/floor-sample-v1/build/owner --height=250
    node scripts/art-gen/soft-frames.mjs assets/generated/floor-sample-v1/kits/guest-beret/take-1/moves.png --out=assets/generated/floor-sample-v1/build/guest-beret-moves --cols=4 --rows=3 --ref=0,1,2,3 --height=246
    node scripts/art-gen/soft-frames.mjs assets/generated/floor-sample-v1/kits/cook-chef/take-1/work.png --out=assets/generated/floor-sample-v1/build/cook-chef-work --scale=0.658
    node scripts/art-gen/floor-sample-plates.mjs
    node scripts/art-gen/floor-sample-sheets.mjs

The game itself draws with this art when opened with `?floors` (`src/render/floors/`, driven by the
real Sim). Both load it from `assets/`, which only the dev server serves.

Then `npm run dev` and open `/?floors`.
