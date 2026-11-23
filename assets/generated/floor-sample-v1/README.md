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

cuts them into `build/furniture/<id>.webp` and `build/furniture/furniture.json`. The game's furniture
grid and rules stay as they are: floor pieces show at six spots (`FURNITURE_SPOTS` in
`src/render/floors/floors-layout.ts`, three downstairs and three on the seating floor), each tied to
a cell that is free under the game's rules; wall pieces hang on the ground floor's back wall where the
game's two free stretches of wall map. The decor build clears the fixed decor there and the potted
plants in the front corners.

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
