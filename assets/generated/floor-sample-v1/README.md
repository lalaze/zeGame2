# Floor sample v1: the café in the cross-section style

The cross-section art of the direction chosen on 2026-11-23 (`../art-direction-v1`). Since
2026-11-24 it is the game: the building of `src/render/floors/` is what the page draws, and the pixel
room it replaced opens with `?pixel` (`isFloorsView` in `src/render/floors/floors-view.ts`). The
game loads `build/` from this folder, on the dev server and in a build alike:
`scripts/ship-floors-art.mjs` copies its WebP and JSON (and the app icons) into a build at the same
address, and the service worker downloads all of it at install. It uses the high-angle dollhouse camera the user picked the same day: each floor is seen from the front and about 35 degrees down, so it
has room for the counter at the back, a queue in the middle and tables at the front.

The user looked through the review sheets on 2026-11-24, asked for nothing to be repainted and had it
shipped. Every piece is its first take unless a section below says otherwise.

## Where things are

Only what the floors view loads is in git: `build/` (WebP and JSON) and the prompts. The Codex takes
(`kits/`), the references they were drawn against (`refs/`) and the PNG strips the WebP are made
from (`build/*.png`) are in the art library at the same paths (`assets/ART-LIBRARY.md`, list with
checksums in its `moved-2026-11-23.json`). The build scripts read them from there, so rebuilding
works as before. The takes stayed in the library when the art shipped (378 MB of PNG).

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

The café's name (a plaque over the awning, with a tag saying whether it is open), today's menu (a board on
the street by the right-hand door) and the cup on the front wall's hanging sign are drawn by the game over
these pictures (`src/render/floors/floors-front.ts`; `BOARD` and `SHOP_SIGN` in `floors-layout.ts`). The
awning hides the top of the ground floor's back wall and the staff the part behind their heads, so the
string lights, the chandelier and the neon signs are drawn moved there (`GROUND_SHIFT`; their lamps in
`floors-sky-light.ts` follow). What guests and staff think is written over their heads in
`floors-thoughts.ts`. The opening flow's starter themes are stacked from `build/decor`
(`floors-theme-preview.ts`). `floors-words.test.ts` checks these.

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

An eleventh sheet, `extras-1`, holds the pictures the dialogs show in place of pixel art: a signature
drink for each base (`sig:<base>`, also the ledger's picture of any signature drink), the two
promotion platforms (`promo:flash`, `promo:orange`) and Mina's map with either route (`wish:quiet`,
`wish:milky`). The signature lab's ingredients and the room projects reuse the pantry icons and the
furniture pictures. (`kits/icons/perks` is an unused take: the chain perks are drawn from the map art.)

## Cats

The game's twelve cats (`CATS` in `src/game/pets.ts`), the gifts they leave and the terrace without
the two cats painted into its plate. Takes are in `kits/cats/<name>/take-1`, prompts in `prompts/cats/`:

| Take | What it is |
| --- | --- |
| `<breed>` | 4×2 on transparency: a 4-frame walk to the right, then sitting, sitting happy (being petted), curled up asleep and washing. `common.txt` + `<breed>.txt` for the ginger cat; the other eleven add `family.txt` and the ginger sheet as a third reference, so all twelve share a layout and a size |
| `gifts` | 3×2: the six gift kinds of `src/game/cat-gifts.ts` (`gifts.txt`) |
| `roof-clear` | The middle of the terrace (`kits/cats/roof-clear/input.png`, cut from `build/frame/attic.webp`) repainted without its cats, leaving the cushion empty (`roof-clear.txt`) |

    node scripts/art-gen/codex-image.mjs --out=assets/generated/floor-sample-v1/kits/cats/tabby/take-2/sheet.png \
      --prompt=assets/generated/floor-sample-v1/prompts/cats/common.txt,assets/generated/floor-sample-v1/prompts/cats/family.txt,assets/generated/floor-sample-v1/prompts/cats/tabby.txt \
      --ref=assets/generated/art-direction-v1/target-shot.png --ref=assets/generated/floor-sample-v1/kits/owner/take-1/sheet.png \
      --ref=assets/generated/floor-sample-v1/kits/cats/ginger/take-1/sheet.png
    uv run --with pillow --with numpy --with scipy python scripts/art-gen/floor-cats-build.py

The build (its `CATS` table names the take and size of each breed) drops stray specks, cuts every
sheet and writes `build/cats/<breed>.webp` (8 frames at one scale, the sitting cat about 96 px tall,
knee-high to the people), `<breed>-face.webp` (the pet panel's portrait), `gift-<kind>.webp`,
`roof-clear-<n>.webp` (two feathered patches the floors view lays over the terrace) and `cats.json`.
It also writes a contact sheet to the library's `review/cats/contact.png`.

`src/render/floors/floors-cats.ts` draws them: every adopted cat walks, takes the stairs, sits,
washes and naps at the places of `floors-cat-places.ts` that suit its personality and preferences
(the terrace wall and cushion, the ground floor's window seat and counter, the seating floors' sunny
patch and bookshelf, any cat bed the player has put out); with no cat adopted the visiting ginger sits
on the terrace wall. Care, petting, gifts and the cat moment stay the game's own. The pet panel shows
the portraits through `src/ui/cat-art.ts`. `floors-cats.test.ts` checks the art and the places.

## Food, tableware, bubbles and effects

What people order, carry and think is painted too (`kits/fx`, prompts in `prompts/fx/`: `common.txt`
followed by the sheet's own list). Four sheets of 4×2 separate objects, all take 1:

| Sheet | Holds |
| --- | --- |
| `bubbles` | Empty speech, thought and wide speech bubbles, heart, rain cloud, exclamation mark, cross, hourglass |
| `effects` | Sparkle, steam puff, coin, tip, service bell, crown, teardrop, loaf |
| `cues` | The five moment signs (menu card, wave, paw, camera, parcel), table tent, plate, tray |
| `tableware` | Takeaway cup, bakery bag, cup and saucer, dough and baked trays, cake stand, tray of cups, tip jar |

`kits/fx/case-empty/take-1/case.png` is the ground floor's cake display repainted with bare shelves
(`prompts/fx/case-empty.txt`, drawn from `kits/fx/case-empty/input.png`: the display cut from the
plate onto magenta, which `--inputs` writes).

    node scripts/art-gen/codex-image.mjs --out=assets/generated/floor-sample-v1/kits/fx/bubbles/take-2/sheet.png \
      --prompt=assets/generated/floor-sample-v1/prompts/fx/common.txt,assets/generated/floor-sample-v1/prompts/fx/bubbles.txt \
      --ref=assets/generated/art-direction-v1/target-shot.png --ref=assets/generated/floor-sample-v1/kits/angle-plate-1f/take-1/plate.png
    uv run --with pillow --with numpy python scripts/art-gen/floor-fx-build.py

The build (run it after the icons build, whose pictures it reads) writes `build/fx/fx.webp` and
`fx.json` (every prop and effect in one atlas, at the size it is drawn in the building),
`items.webp` and `items.json` (every menu picture and signature drink of `build/icons` at 72 px, for
tables, trays, bubbles and the display) and `case-empty.webp` (the repainted glass and shelves,
fitted over the plate's display by its wooden base).

`src/render/floors/floors-fx.ts` loads them beside the scene's own art and repaints the drawn
stand-ins of `textures.ts`, which stay as the fallback when a file is missing.
`src/render/floors/floors-props.ts` draws with them, from what the Sim says: the drink or pastry in
front of each served guest (the drink is picked up to sip), a number card while they wait, servers'
trays with the dishes on them, takeaway cups and bakery bags, finished orders, the pass, the bell and
the tip jar on the counter, the display filled from the day's bake plan or shelf stock, the batch
riding the food lift, order bubbles, sold-out crosses, waiting thoughts, impatience, VIP crowns,
cooks' batches, the moment's cue by kind, sale coins, tips, help given and celebrations.
`floors-fx.test.ts` checks that every menu item, signature base and dialog picture has its art and
that the atlases hold every frame the code names.

## Time of day and weather

The building follows the game's clock and the day's condition (`src/render/floors/floors-sky.ts`, called
from `floors-scene.ts`; what shows when is in `floors-sky-light.ts`). The clock is the pixel view's:
08:00 while the day is planned, 08:00 to 20:00 while open, held at closing time. So a day runs from
the day sky through golden hour (17:30) and sunset (19:00) to nightfall (20:00); deep night is only
seen with the preview hour. The conditions are `fair`, `rain`, `hot`, `crisp`, `market` and `quiet`
(`src/game/conditions.ts`); snow is painted too, but no condition brings it yet.

| Take (`kits/sky/<piece>/take-1/sheet.png`) | Becomes |
| --- | --- |
| `clear`, `dusk`, `night`, `overcast` | The day sky (`kits/frame/sky`) repainted house for house: without clouds (hot days), at sunset, at night, under rain clouds (`prompts/sky/common.txt` + the piece's own). The game cross-fades them; above each it continues the sky in the picture's top colour |
| `clouds` | Six clouds on magenta, 2 by 3 (`prompts/sky/sprite-common.txt` + `clouds.txt`) |
| `bits` | Twelve pieces on magenta, 4 by 3: moon, sun, star, raindrop, splash, two snowflakes, two leaves, two balloons, a bird (`sprite-common.txt` + `bits.txt`) |

    node scripts/art-gen/codex-image.mjs --out=assets/generated/floor-sample-v1/kits/sky/dusk/take-2/sheet.png \
      --prompt=assets/generated/floor-sample-v1/prompts/sky/common.txt,assets/generated/floor-sample-v1/prompts/sky/dusk.txt \
      --ref=assets/generated/art-direction-v1/target-shot.png --ref=assets/generated/floor-sample-v1/kits/frame/sky/take-1/sheet.png
    uv run --with pillow --with numpy python scripts/art-gen/floor-sky-build.py

The build (set a redone take in its `TAKES`) writes `build/sky/`: the skies at the day sky's size, the
clouds and pieces as one atlas (`sprites.webp`, `sprites.json`), and two things made from `build/frame`:
the light in each front wall's windows (`glow-wall-*`, from the wall's glass) and where night falls on
the top floor's picture (`shade-attic`: fully on its roof, less under it). `sky.json` lists them with
the skies' top colours. Run it again after `floor-frame-build.py` changes a wall or the attic.

At dusk and night the street, roof, pillars, beams and front walls are tinted with the pixel view's
own light (`render/lighting.ts`), the rooms only dim a little, and a glow is added at every lamp. The
lamps were found by eye on the plates and are listed in `floors-sky-light.ts` (`FLOOR_LAMPS`, the
ceiling decor's `CEILING_LAMPS`, the neon sign, `WALL_LAMPS` on the front walls, the street lamp),
with the rooms' own window glass (`ROOM_WINDOWS`), which darkens with the sky. If a plate, a ceiling
decor or a wall is repainted, check them against it. `floors-sky.test.ts` checks the manifest, the
atlas and which sky, lamps and weather show when.

On the dev server `?floors&hour=21&weather=rain` shows that hour (0 to 24) and weather (a condition, or
`snow`); in the page, `floorsSky.preview = { hour: 19, weather: 'crisp' }` changes it without a reload.
The tints need WebGL: on Phaser's canvas fallback the outside does not darken.

## The places of the branches

A branch (`src/game/locations.ts`) stands somewhere else: the backdrop behind the roof and the view
through the rooms' windows are the place's (`src/render/floors/floors-places.ts`, drawn by
`floors-sky.ts`; loaded for the place the café is in). The old town is the sky above. The roof hides all
of a backdrop but its sky and the outer fifths down to about two thirds of its height, so each place's
landmarks stand there (`prompts/places/common.txt`); the main one is on the left, as the page's buttons
cover the right. The takes are in `kits/places`, prompts in `prompts/places/`:

| Take | What it is |
| --- | --- |
| `<place>/take-1`, `take-2` | Two compositions of the sunny day (`common.txt` + `<place>-N.txt`), with the place's picture from the branch map as a reference (`refs/places`). The user chose the second of each on 2026-11-24 |
| `<place>/{clear,dusk,night,overcast}/take-1` | The chosen day in the other lights (`light-common.txt` + `light-<light>.txt`), with the old town's sky in that light as a reference |
| `window-1f`, `window-2f` | The rooms' two windows (`input.png`) with their glass in magenta (`window-glass.txt`) |

    uv run --with pillow --with numpy python scripts/art-gen/floor-places-build.py

writes `build/places/<place>/*.webp` and `places.json`: it moves a light back onto its day where Codex
shifted it, runs every sky's top out into the old town's, and cuts the windows' views from
`build/map/view-*.webp` (the city's from its backdrop). Run it again after `floor-sky-build.py` or
`floor-map-build.py`. `PLACE_WINDOWS` must match `places.json` (`floors-places.test.ts`).

## App icon and loading screen

`kits/app/icon-{a,b,c}/take-1/icon.png` are three candidate icons (`prompts/app/icon-common.txt` +
`icon-<x>.txt`: the cup under the awning, the café cut open, the shop window at dusk), and
`kits/app/loading/take-1/picture.png` the loading screen's picture (`prompts/app/loading.txt`). Both
take the ground-floor plate as their second reference.

    uv run --with pillow --with numpy python scripts/art-gen/floor-app-build.py --review

writes `build/app/`: `icon-192.png` and `icon-512.png` (rounded), `icon-maskable-192.png` and
`icon-maskable-512.png` (the full square, subject inside the safe middle), `apple-touch-icon.png`,
`favicon.png`, `loading.webp`, a `manifest.webmanifest` and `app.json`. `--review` also writes the
candidates' contact sheet to the library's `review/sky/icon-candidates.png`.

**The icon in use is `icon-d` (the owner with a cup), which the user picked "for now" on 2026-11-24.**
They turned down the first three candidates (`icon-a` to `icon-c`); a second round (`icon-d` to
`icon-i`, the owner and the cat ones with their sprite sheet as a third reference and
`prompts/app/icon-common-character.txt`) is in the library's `review/sky/icon-candidates-round2.png`.
To change it, set `ICON` in the build script and rebuild.

The installed app shows them since 2026-11-24: `public/` holds copies of the six icon files and the
manifest (`src/ui/floors-identity.test.ts` checks they are the same bytes, so copy them again after a
rebuild), `index.html` names them and puts the paper loading screen on from its first paint with a
small inline script, and `installFloorsIdentity` (`src/ui/floors-identity.ts`) sets the brand icon once
the page's script has loaded. With `?pixel` the page keeps its pixel loader. The old `icon-192.png`,
`icon-512.png` and manifest are in the art library under `public/`; `public/icon.svg` stays for the
pixel view. Android picks up a new manifest icon within a day or two of opening the app; on iOS the
home-screen icon only changes when the app is removed and added again.

## The street, the branch map and the chain

In the floors view the street (`src/ui/streets.ts`), the branch map (`src/ui/branch-map.ts`) and the
chain's pictures (`src/ui/chain-ui.ts`) keep their layout and behaviour and show painted pictures in
place of the pixel packs `public/art/street-art-v2`, `public/art/street-scene` and the code-drawn map.
`src/render/floors/floors-street.ts` fills the screens' art hooks (`setStreetArt`, `setStreetIcons`,
`setBranchArt`, `setChainArt`) from `build/street/street.json` and `build/map/map.json`, and
`src/ui/floors-street.css` (scoped to `body.floors-view`) corrects what the pixel pieces' CSS assumed.

The street's takes are in `kits/street/<sheet>/take-1/sheet.png`, prompts in `prompts/street/`:

| Take | Becomes |
| --- | --- |
| `shops-1` … `shops-4` | Two buildings each on transparency (`shop-common.txt` + `shops-N.txt`): the five businesses' storefronts, the two empty shops, and a builders' scaffold (built, not shown yet) |
| `props` | 4×2: lamp, bench, tree, hedge, ladder, trestle, hoarding, and the meadow mound a far village stands on |
| `sky` | 2×2: two clouds, the far village and the hamlet |
| `badges` | 4×2: the estate agent's board, and the badges of the lot notes and street tabs (goods ready, lock, flag, fitting out, coin, key, blueprint) |
| `hills`, `ground` | A strip of far hills on transparency and the cobbled paving; the build mirrors each into a tile that repeats without a seam |

The player's café is not painted again: the build stacks the building's own front walls (`build/frame`)
over its rooms, one picture per number of seating floors (`cafe-0`, `cafe-1`, `cafe-2`), and the street
shows the one that matches the player's building. Walkers are the side walk of four painted guests
(`build/cast-NN.webp`, frames 0 to 3). Every storefront is fitted into the box of its pixel piece
(`public/art/street-art-v2/anchors.json`); where the game writes its name and where guests walk in
are read off each take (`SIGN_DOOR` in the build script) and must be set again for a new take.

    node scripts/art-gen/codex-image.mjs --out=assets/generated/floor-sample-v1/kits/street/shops-1/take-2/sheet.png \
      --prompt=assets/generated/floor-sample-v1/prompts/street/shop-common.txt,assets/generated/floor-sample-v1/prompts/street/shops-1.txt \
      --ref=assets/generated/art-direction-v1/target-shot.png --ref=assets/generated/floor-sample-v1/refs/street/cafe-front.png \
      --ref=assets/generated/floor-sample-v1/refs/street/pixel-shops-1.png
    uv run --with pillow --with numpy python scripts/art-gen/floor-street-build.py

writes `build/street/*.webp` and `build/street/street.json` (`--refs` writes the references into
`refs/street` instead: the café's front and the pixel pieces enlarged).

The map's takes are in `kits/map/<sheet>/take-1/sheet.png`, prompts in `prompts/map/`: `map` (the
region, cropped to the drawn map's 8:5 so the pins keep their places), `views` (2×2 on white: the view
from the windows of the seaside, the mountain woods, the city and the flower fields; the old town's is
cut from `build/frame/sky.webp`), `regions` (3×2 on white: the inside of the five street businesses,
shown in a lot's details), `places` (the little café of each place and the map pin) and `perks` (the
six chain perks).

    uv run --with pillow --with numpy python scripts/art-gen/floor-map-build.py

writes `build/map/*.webp` and `build/map/map.json` (`--refs` writes `refs/map`; the drawn map and
views among its references were saved from the running game). `src/render/floors/floors-street.test.ts`
checks that every storefront, state, scenery piece, walker, place, perk and business the screens can
ask for has its picture.

## Staff looks and portraits

The owner, baristas, servers and cooks wear the look the game gives them (`Look` in
`src/game/state.ts`): the owner the one the player designs, partners their own. Each of the 32
hairstyles (`TEAM_HAIRSTYLES`) is one sheet in the layout of the other characters,
`kits/staff/NN-name/take-1/sheet.png`, drawn from `prompts/staff/common.txt` + `prompts/staff/NN-name.txt`
against the owner's sheet. They are painted in key colours: hair violet, apron green, trousers blue,
skin light peach, shirt white.

    node scripts/art-gen/codex-image.mjs --out=assets/generated/floor-sample-v1/kits/staff/16-afro/take-2/sheet.png \
      --prompt=assets/generated/floor-sample-v1/prompts/staff/common.txt,assets/generated/floor-sample-v1/prompts/staff/16-afro.txt \
      --ref=assets/generated/art-direction-v1/target-shot.png --ref=assets/generated/floor-sample-v1/kits/owner/take-1/sheet.png
    uv run --with pillow --with numpy --with scipy python scripts/art-gen/floor-staff-build.py

The build cuts every sheet into a strip (`build/staff/<name>.webp`, the shirt turned cream) and
writes a mask next to it (`<name>-mask.webp`: how much of each pixel is hair, apron, trousers and
skin), one picture of all the front poses (`fronts.webp`, for portraits) and `staff.json`. A redo
is a new take, named in the script's `TAKES`. It prints how many key-coloured pixels the masks
miss; a few hundred along outlines is normal.

The two cooks keep their sheets and work poses. `kits/staff/cook-*/take-1/{sheet,work}.png` repaint
them with violet hair (`prompts/staff/cook-common.txt`, against `kits/cook-*/take-1`); their skin
is found by its colour, patch by patch, so the bread and dough they carry stay as painted. Only
their skin and hair follow the look.

`src/render/floors/staff-paint.ts` repaints a strip for a look in the game's own colours (what the
game calls the shirt is the apron), keeping the painted shading; `floors-looks.ts` loads the strips
and gives the scene one texture per look. The page's portraits go through `src/ui/portrait-art.ts`,
which the floors view fills (`floors-portraits.ts`): partners, the owner in the opening flow and
its hairstyle buttons, and guests (frame 4 of their `cast-NN` strip) in the regulars journal, taste
notes and service help. Checked by `src/render/floors/floors-looks.test.ts`,
`floors-portraits.test.ts` and `src/ui/portrait-art.test.ts`.

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
