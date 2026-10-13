# Layered pixel pseudo-3D coverage

These are inherited coverage requirements, not a fresh visual acceptance. Reaudit every runtime path against the user reference.

# Inherited A coverage contract (historical evidence only)

The catalogs below are exhaustive ID lists from gameplay data, not an approximation based on one promotional screenshot. Listed coverage is required; it does not itself mean visual QA passed. Historical A screenshots and observations remain inside the separately retained A source archive, under docs/art-redesign. They do not validate this new pixel-depth implementation. Current evidence and limitations are recorded in PROGRESS.md.

## Verification status

The historical A export contained 963 assets with atlas/export correspondence. Its prior room/UI/interaction observations apply only to that archived implementation. They are not current pixel-depth verification. Current main-room source is still a work in progress. Selected generated furniture and default-owner assets have actual desktop/390 runtime captures; no whole-room visual acceptance has been granted. Other rooms and full catalog remain pending. See PROGRESS.md for current test counts and verification limits.

## Acceptance criteria

- Reference A: dark walnut timber, layered cream plaster, brass lamps, rich foliage, chalkboard, glass pastry case, red gingham, grounded chibi people and soft daytime rays.
- The actual game uses a 320-art-pixel world. Assess readability and craft at the real game size. Increasing canvas resolution or changing only the palette is insufficient.
- Retain IDs, collision footprints, logical anchors, simulation/economy and save migration. Check EN/ZH desktop and 390px CSS viewports. Mobile browser emulation is not physical-device certification.
- There are five playable areas. No separate street-exterior gameplay scene exists; exterior coverage means window views, street threshold, terrace garden and building overview.
- There is no gameplay furniture-wear mechanic. Authored grain, textile creases and patina are visual material details, not new damage states.

## Rooms, exterior and structural elements

| Area/family | Required redraw coverage | Authoritative sources | Visual evidence route |
|---|---|---|---|
| Main | Wall, plaster, cornice, wainscot, two windows, gingham curtains, sky/clouds/town/trees/reflections, open/closed sign, menu chalkboard and food, back-bar jars/books/basket/dome, service cupboards and carafe/cups, espresso machine, counter/gate/pass/bell/glass case, floor/runner/doormat, front cutaway and entrance pots | `game/layout.ts`, `render/room-art.ts`, `materials.ts` | clean `concept-main`; busy-main; all décor variants |
| Reading | Bookshelves/books, reading window, curtain, armchairs/lamp, floor, aisle, sign, rear doorway; locked crates and table footprints | `game/regions.ts`, `render/region-art.ts` | all-rooms prep; light 08/15/21; locked/open |
| Greenhouse | Glass roof/mullions/reflections, sky/treeline, hanging pots, greenery, bench, floor and thresholds; locked state | same | all-rooms prep; light 08/15/21 |
| Terrace exterior | Open sky, garden stone wall, treeline, festoon lamps, flower boxes, lemon trees, bench, patio and thresholds; locked state | same | all-rooms prep; light 08/15/21 |
| Kitchen | Locked preview; cook upgrades 0/1/2 and corresponding room heights; installed/reserved equipment; active/idle workstations; wall/floor/hood/pipes/lights; aisle and swing door | `game/kitchen.ts`, `render/kitchen-art.ts`, `layout.ts` | all-rooms and busy service; kitchen diagnostic variants |
| Doors and map | Side and rear openings, barred/locked passages, moving steel kitchen door, front boundaries, map seams, pan/camera framing | `AREA_GRID`, `AREA_LINKS`, `render/passages.ts`, `room-camera.ts` | main → kitchen → main → reading → greenhouse → terrace → return; map |
| Lighting | Morning/day/evening/night sky, moving beams, lamp glow, reflected glass, room grade; no seams or actor tint mismatch | `lighting.ts`, `phaser/canvas-lighting.ts` | diagnostic 08/15/21 plus live rendering |
| Dining | Red gingham tables, vase/flowers, left/right chairs; 2–8 main tables and four per extension; unbuilt-table sign; seated feet, lowered petting hand and plate depth | `TABLE`, `CHAIR_LEFT/RIGHT`, `layout.ts` | clean main and maximum-table all-rooms |

## Equipment and progression

- Upgrade IDs: barista, server, cook, machine, marketing, tables. Check both purchase icon and in-world consequence.
- Espresso machine finish: inspect levels 0, 5, 10, 15 and 20 against exact renderer thresholds; idle/brewing/steam states.
- Staff: owner plus up to three additional baristas, two servers, kitchen first cook plus two upgrades. Check every job slot and carrying/working pose.
- Kitchen equipment: cooler, dryStore, mixer, proofer, bench, sheeter, standMixer, kettle, deckOven, convection, fryer, pastryFridge, rack, handSink, dishPit. Additional fixtures: hood, bins, tools, supplies and door station.
- Recipe-driven absent/reserved/installed/active state, empty/stocked rack and pastry fridge, and each cook station must remain supported.

## Animation and custom appearance contract

- Five roles: owner, barista, server, cook, customer. Uniforms must remain identifiable.
- Look axes: 4 skin colors, 6 hair colors, 4 hairstyles, 8 shirts, 3 pants. There are 2,304 combinations per role; axis sampling covers every value, but is not a claim that every combination was visually reviewed.
- Each person: down/up/left/right × stand/stepA/stepB = 12 slots; sitLeft/sitRight = 2; sitPetLeft[0–1]/sitPetRight[0–1] = 4. Total 18 distinct pose slots plus `stand` alias.
- Runtime: owner/barista brew/hold/call, server empty and 1–3-plate trays/acknowledgement, cook carry/work at all stations, queue/order/wait/sit/exit, sipping/eating, VIP crown and happy/sad overlays.
- Keep feet and seated anchors consistent. Inspect cups, tray, food, chair, counter and lowered hand without detachment, clipping or depth pops.
- Cats each have 14 canvases: idle, swish, blink, happy, walk[0–1], sleep, groom[0–1], stretch, watch, lookUp, nuzzle[0–1]. All 12 breeds total 168 canvases.
- Cat behavior: patrol, sleep, groom, stretch, watch. Guest interaction: approach → nuzzle → response → leave. Left/right flip follows `residentCatFlipX`.
- Cat runtime coverage: visiting window cat, adopted residents, empty/active care, happy pet response, selection marker, heart, doorway transitions, three personalities, cozy/window/explore preferences. Verify seated petting on both chair facings and a doorway; an atlas alone cannot validate contact or depth.

## Dynamic recipes and ingredients

- Ingredients: beans, milk, flour, butter, eggs, sugar, tea, spice, cocoa, cream, fruit, matcha. Inspect pantry and recipe-builder paths, not only stock-menu sprites.
- Signature bases: coffee, tea, milk, fruit. Addons: milk, sugar, spice, cocoa, cream, fruit, matcha, under existing compatibility/dose rules.
- Cover each base, zero to three addons, 1/2 doses, immutable formula ID, rename preserving appearance, safe invalid ID, compact 18px order icon, 32px art and export-density art.
- Real service must display a custom drink on order/pass/tray and delivery, not only in its builder preview. The synthetic fixture has four valid formulas, with three enabled on-menu to respect the gameplay cap.

## UI, thought and transient art

| Family | Required coverage | Sources |
|---|---|---|
| Chrome | Brand/favicon/loader, café sign, currency plaque/exact value, review stars, regular journal/unread badge, settings, language, dialogs and toast | `index.html`, `style.css`, UI modules |
| Navigation | Map, door arrows, lock/expansion card, active/focus/disabled states | `ui/regions.ts`, `ui-art.ts`, `pixel-icons.ts` |
| Management | Four menu categories, 12 pantry icons, six upgrades, décor categories/slots/storage, owned cats/catalog, promotions and tabs | `ui/panel.ts` and related UI modules |
| Café styles | coffee, bakery, cats, takeaway, garden, community, own-mix; stage/checklist markers | `styles.ts`, `ui/cafe-styles.ts` |
| Preparation | Opening checklist, 55 recipes, shortages, formula controls, taste/research tiers and on/off menu | `prepare.ts`, signature/taste modules |
| Live service | Day/time, speeds, close shop, help brew, pantry dock, progress bars, queue/cup/plate hints and money floaters | `main.ts`, `play-flow.ts`, `cafe-scene.ts` |
| Effects | Steam, sparkles, hearts, sad drop, VIP crown, bell/call/acknowledgement, placement grid/shadow and valid/invalid ghost | `sprites.ts`, `cafe-scene.ts`, `service-props-art.ts` |
| Customer thoughts | arrive, queue, urgent, myTurn, findSeat, wait, served, enjoy, cozy, nextTime, leave, goodbye, takeaway | `thoughts.ts`, `thought-bubbles.ts`, `thought-text.ts` |
| Staff thoughts | Owner/barista idle/welcome/working, orderReady; server idle/pickup/deliver/return; cook idle/ready/carry/gather/mix/rise/prep/fold/boil/bake/fry/cool/chill | same |
| Taste thoughts | like/dislike × bold, milky, cocoa, sweet, tea, spiced, fruity, buttery, toasty, tangy; EN/ZH wrapping and collision | `ITEM_FLAVORS`, locales |
| Interruptions | Settlement/revenue/shortage, save lock, temporary save, offline notices and modal/arrange-cancel focus restoration | settlement/save-session/main |

## Reproduction and acceptance evidence

- `scripts/art-redesign-fixtures.ts`: seeded synthetic states, catalog ownership, legal placement and live runtime snapshots. Never reads a player save.
- `scripts/art-redesign-fixtures.test.ts`: production deserialize/restore, legal placements and deterministic generation.
- `scripts/art-redesign-qa.html` / `.ts`: exact origin guard for localhost/127.0.0.1 ports 5274 (A) and 5275 (baseline), real game iframe at 1100×820 and 390×844, EN/ZH, diagnostic atlas and report.
- `scripts/art-redesign-vite.config.ts`: separate `art-qa-dist`, leaving production configuration/dist alone.
- Build with `node scripts/subset-font.mjs && npx vite build --config scripts/art-redesign-vite.config.ts`; serve `art-qa-dist` using Python on the cloud computer. Command executor and browser localhost namespaces differ, but `/workspace/shared` is shared.
- The baseline is an untouched HEAD archive at the commit in `BASELINE-COMMIT.txt`, using the same synthetic fixture/harness. Never use port 5173 or its saves.
- Fixtures: starter; concept-main (two tables, owner/server, ginger and naturally simulated customers); all-rooms-prep; busy-main; busy-all-rooms; stockout; extra local/shorthair/longhair cat trios. Prior synthetic saves under `docs/play-flow/fixtures` supplement migration checks.
- Each furniture ID requires shop icon → storage → placed → selected → valid/invalid ghost → moved → stored → reload. Check floor and wall, reserved walkways, cat-space rejection and new-table eviction. No kitchen placements.
- Every dish requires menu artwork, native order icon, bare menu/pass/tray icon, appropriate rack/case/fridge use, EN/ZH name and price.
- Final evidence must cover both languages and widths, all five rooms/map, locked previews, prep/management/style/settings, busy multiple-staff service/custom drink/reload, furniture lifecycle, cat doorway/petting and old-save migration. Record partial or unverified paths honestly.

## Catalog tables

The following tables are generated from the gameplay catalogs. All rows remain required, including intentionally empty `*_none` décor selections.

### 35 equipped décor choices

Source: `src/game/decor.ts`. All required animation/state variants are specified above.

| ID | Slot | Visual QA |
|---|---|---|
| wall_cream | wallpaper | Historical atlas only; current art review pending |
| wall_mint | wallpaper | Historical atlas only; current art review pending |
| wall_rose | wallpaper | Historical atlas only; current art review pending |
| wall_dots | wallpaper | Historical atlas only; current art review pending |
| wall_brick | wallpaper | Historical atlas only; current art review pending |
| wall_walnut | wallpaper | Historical atlas only; current art review pending |
| wall_stars | wallpaper | Historical atlas only; current art review pending |
| floor_checker | floor | Historical atlas only; current art review pending |
| floor_planks | floor | Historical atlas only; current art review pending |
| floor_mint | floor | Historical atlas only; current art review pending |
| floor_terrazzo | floor | Historical atlas only; current art review pending |
| floor_herringbone | floor | Historical atlas only; current art review pending |
| floor_marble | floor | Historical atlas only; current art review pending |
| counter_oak | counter | Historical atlas only; current art review pending |
| counter_walnut | counter | Historical atlas only; current art review pending |
| counter_marble | counter | Historical atlas only; current art review pending |
| counter_pink | counter | Historical atlas only; current art review pending |
| counter_gold | counter | Historical atlas only; current art review pending |
| sill_none | sill | Historical atlas only; current art review pending |
| sill_cactus | sill | Historical atlas only; current art review pending |
| sill_tulips | sill | Historical atlas only; current art review pending |
| sill_bonsai | sill | Historical atlas only; current art review pending |
| ceiling_none | ceiling | Historical atlas only; current art review pending |
| ceiling_lights | ceiling | Historical atlas only; current art review pending |
| ceiling_vines | ceiling | Historical atlas only; current art review pending |
| ceiling_pendants | ceiling | Historical atlas only; current art review pending |
| ceiling_chandelier | ceiling | Historical atlas only; current art review pending |
| rug_none | rug | Historical atlas only; current art review pending |
| rug_red | rug | Historical atlas only; current art review pending |
| rug_blue | rug | Historical atlas only; current art review pending |
| rug_round | rug | Historical atlas only; current art review pending |
| neon_none | neon | Historical atlas only; current art review pending |
| neon_cafe | neon | Historical atlas only; current art review pending |
| neon_heart | neon | Historical atlas only; current art review pending |
| neon_cup | neon | Historical atlas only; current art review pending |

### 39 placeable furniture props

Source: `src/game/furniture.ts`. All required animation/state variants are specified above.

| ID | Category | Surface | Visual QA |
|---|---|---|---|
| clock | decoration | wall | Historical atlas only; current art review pending |
| mugrack | furniture | wall | Historical atlas only; current art review pending |
| plant_fern | decoration | floor | Historical atlas only; current art review pending |
| plant_snake | decoration | floor | Historical atlas only; current art review pending |
| art_landscape | decoration | wall | Historical atlas only; current art review pending |
| aframe | decoration | floor | Historical atlas only; current art review pending |
| plant_fig | decoration | floor | Historical atlas only; current art review pending |
| sconce | decoration | wall | Historical atlas only; current art review pending |
| garland | decoration | wall | Historical atlas only; current art review pending |
| lamp | decoration | floor | Historical atlas only; current art review pending |
| coatrack | furniture | floor | Historical atlas only; current art review pending |
| plant_monstera | decoration | floor | Historical atlas only; current art review pending |
| shelf | furniture | wall | Historical atlas only; current art review pending |
| bench | furniture | floor | Historical atlas only; current art review pending |
| art_cat | decoration | wall | Historical atlas only; current art review pending |
| catbed | furniture | floor | Historical atlas only; current art review pending |
| bookshelf | furniture | floor | Historical atlas only; current art review pending |
| armchair | furniture | floor | Historical atlas only; current art review pending |
| plant_lemon | decoration | floor | Historical atlas only; current art review pending |
| art_bean | decoration | wall | Historical atlas only; current art review pending |
| gramophone | furniture | floor | Historical atlas only; current art review pending |
| art_starry | decoration | wall | Historical atlas only; current art review pending |
| piano | furniture | floor | Historical atlas only; current art review pending |
| plant_lavender | decoration | floor | Historical atlas only; current art review pending |
| plant_succulent | decoration | floor | Historical atlas only; current art review pending |
| vase_daisies | decoration | floor | Historical atlas only; current art review pending |
| poster_coffee | decoration | wall | Historical atlas only; current art review pending |
| poster_bakery | decoration | wall | Historical atlas only; current art review pending |
| wreath_season | decoration | wall | Historical atlas only; current art review pending |
| hanging_ivy | decoration | wall | Historical atlas only; current art review pending |
| wall_pennants | decoration | wall | Historical atlas only; current art review pending |
| lantern | decoration | floor | Historical atlas only; current art review pending |
| bean_display | decoration | floor | Historical atlas only; current art review pending |
| sideboard | furniture | floor | Historical atlas only; current art review pending |
| sofa | furniture | floor | Historical atlas only; current art review pending |
| round_stool | furniture | floor | Historical atlas only; current art review pending |
| display_cabinet | furniture | floor | Historical atlas only; current art review pending |
| magazine_rack | furniture | floor | Historical atlas only; current art review pending |
| coffee_cart | furniture | floor | Historical atlas only; current art review pending |

### 55 stock menu dishes

Source: `src/game/data.ts`. All required animation/state variants are specified above.

| ID | Category | Visual QA |
|---|---|---|
| espresso | coffee | Historical atlas only; current art review pending |
| americano | coffee | Historical atlas only; current art review pending |
| latte | coffee | Historical atlas only; current art review pending |
| cappuccino | coffee | Historical atlas only; current art review pending |
| flatwhite | coffee | Historical atlas only; current art review pending |
| cortado | coffee | Historical atlas only; current art review pending |
| mocha | coffee | Historical atlas only; current art review pending |
| vienna | coffee | Historical atlas only; current art review pending |
| macchiato | coffee | Historical atlas only; current art review pending |
| coldbrew | coffee | Historical atlas only; current art review pending |
| dirty | coffee | Historical atlas only; current art review pending |
| pourover | coffee | Historical atlas only; current art review pending |
| creamcoffee | coffee | Historical atlas only; current art review pending |
| affogato | coffee | Historical atlas only; current art review pending |
| blacktea | tea | Historical atlas only; current art review pending |
| hotchoc | tea | Historical atlas only; current art review pending |
| lemontea | tea | Historical atlas only; current art review pending |
| chai | tea | Historical atlas only; current art review pending |
| fruittea | tea | Historical atlas only; current art review pending |
| hojicha | tea | Historical atlas only; current art review pending |
| matcha | tea | Historical atlas only; current art review pending |
| frappe | tea | Historical atlas only; current art review pending |
| smoothie | tea | Historical atlas only; current art review pending |
| milktea | tea | Historical atlas only; current art review pending |
| matchafloat | tea | Historical atlas only; current art review pending |
| roll | bread | Historical atlas only; current art review pending |
| bagel | bread | Historical atlas only; current art review pending |
| baguette | bread | Historical atlas only; current art review pending |
| cheesebun | bread | Historical atlas only; current art review pending |
| pretzel | bread | Historical atlas only; current art review pending |
| focaccia | bread | Historical atlas only; current art review pending |
| ciabatta | bread | Historical atlas only; current art review pending |
| raisinbread | bread | Historical atlas only; current art review pending |
| sourdough | bread | Historical atlas only; current art review pending |
| rye | bread | Historical atlas only; current art review pending |
| chocobread | bread | Historical atlas only; current art review pending |
| shokupan | bread | Historical atlas only; current art review pending |
| brioche | bread | Historical atlas only; current art review pending |
| fruitbrioche | bread | Historical atlas only; current art review pending |
| garlicbread | bread | Historical atlas only; current art review pending |
| donut | pastry | Historical atlas only; current art review pending |
| scone | pastry | Historical atlas only; current art review pending |
| cookie | pastry | Historical atlas only; current art review pending |
| croissant | pastry | Historical atlas only; current art review pending |
| painchoc | pastry | Historical atlas only; current art review pending |
| brownie | pastry | Historical atlas only; current art review pending |
| cinnamon | pastry | Historical atlas only; current art review pending |
| muffin | pastry | Historical atlas only; current art review pending |
| creampuff | pastry | Historical atlas only; current art review pending |
| melonpan | pastry | Historical atlas only; current art review pending |
| eggtart | pastry | Historical atlas only; current art review pending |
| cake | pastry | Historical atlas only; current art review pending |
| swissroll | pastry | Historical atlas only; current art review pending |
| cheesecake | pastry | Historical atlas only; current art review pending |
| macaron | pastry | Historical atlas only; current art review pending |

### 12 cat breeds

Source: `src/game/pets.ts`. All required animation/state variants are specified above.

| ID | Group | Visual QA |
|---|---|---|
| ginger | local | Historical atlas only; current art review pending |
| tuxedo | local | Historical atlas only; current art review pending |
| calico | local | Historical atlas only; current art review pending |
| tabby | local | Historical atlas only; current art review pending |
| black | local | Historical atlas only; current art review pending |
| white | local | Historical atlas only; current art review pending |
| british | shorthair | Historical atlas only; current art review pending |
| american | shorthair | Historical atlas only; current art review pending |
| siamese | shorthair | Historical atlas only; current art review pending |
| ragdoll | longhair | Historical atlas only; current art review pending |
| persian | longhair | Historical atlas only; current art review pending |
| mainecoon | longhair | Historical atlas only; current art review pending |

### 30 authored customer appearances

Source: `src/game/customer-cast.ts`, `CUSTOMER_CAST`.

| Cast ID | Label | Outfit | Accessory | Visual QA |
|---|---|---|---|---|
| 0 | 晨读常客 | cardigan | glasses | Historical atlas only; current art review pending |
| 1 | 海盐条纹 | stripe | none | Historical atlas only; current art review pending |
| 2 | 花店姑娘 | overalls | bow | Historical atlas only; current art review pending |
| 3 | 蜂蜜围巾 | scarf | none | Historical atlas only; current art review pending |
| 4 | 紫藤画家 | jacket | satchel | Historical atlas only; current art review pending |
| 5 | 草莓裙摆 | dress | headband | Historical atlas only; current art review pending |
| 6 | 薄荷骑手 | hoodie | none | Historical atlas only; current art review pending |
| 7 | 奶油书迷 | vest | glasses | Historical atlas only; current art review pending |
| 8 | 枫叶邮差 | duffle | satchel | Historical atlas only; current art review pending |
| 9 | 蓝莓水手 | sailor | bow | Historical atlas only; current art review pending |
| 10 | 苔绿园丁 | overalls | satchel | Historical atlas only; current art review pending |
| 11 | 杏黄毛衣 | stripe | glasses | Historical atlas only; current art review pending |
| 12 | 丁香发带 | dress | headband | Historical atlas only; current art review pending |
| 13 | 桃子开衫 | cardigan | bow | Historical atlas only; current art review pending |
| 14 | 湖绿旅人 | jacket | satchel | Historical atlas only; current art review pending |
| 15 | 燕麦绒帽 | hoodie | glasses | Historical atlas only; current art review pending |
| 16 | 砖红背心 | vest | none | Historical atlas only; current art review pending |
| 17 | 雨天风衣 | duffle | glasses | Historical atlas only; current art review pending |
| 18 | 青苹果领结 | sailor | bow | Historical atlas only; current art review pending |
| 19 | 向日葵裙 | dress | headband | Historical atlas only; current art review pending |
| 20 | 葡萄连帽衫 | hoodie | none | Historical atlas only; current art review pending |
| 21 | 玫瑰围巾 | scarf | glasses | Historical atlas only; current art review pending |
| 22 | 松石背带 | overalls | headband | Historical atlas only; current art review pending |
| 23 | 香草针织 | stripe | satchel | Historical atlas only; current art review pending |
| 24 | 肉桂短夹克 | jacket | none | Historical atlas only; current art review pending |
| 25 | 雾蓝发辫 | cardigan | bow | Historical atlas only; current art review pending |
| 26 | 橄榄学者 | vest | glasses | Historical atlas only; current art review pending |
| 27 | 金盏牛角扣 | duffle | none | Historical atlas only; current art review pending |
| 28 | 紫苏小领衫 | sailor | headband | Historical atlas only; current art review pending |
| 29 | 蜜桃旅行包 | scarf | satchel | Historical atlas only; current art review pending |

### 12 narrative regular identities

These are stable identities within the 30-appearance cast, not the entire customer catalog.

| Regular ID | Cast ID | Preferred drink | Visual QA |
|---|---|---|---|
| mina | 0 | espresso | Historical atlas only; current art review pending |
| theo | 17 | americano | Historical atlas only; current art review pending |
| iris | 10 | blacktea | Historical atlas only; current art review pending |
| nico | 4 | latte | Historical atlas only; current art review pending |
| june | 7 | cappuccino | Historical atlas only; current art review pending |
| alba | 13 | hotchoc | Historical atlas only; current art review pending |
| ren | 6 | coldbrew | Historical atlas only; current art review pending |
| tess | 2 | fruittea | Historical atlas only; current art review pending |
| sam | 24 | flatwhite | Historical atlas only; current art review pending |
| vivi | 21 | lemontea | Historical atlas only; current art review pending |
| otto | 8 | cortado | Historical atlas only; current art review pending |
| luz | 29 | hojicha | Historical atlas only; current art review pending |

## New pixel-depth authorship checkpoint (2026-10-13)
- pixel-floor-depth.ts: fine limestone planes, restrained grout, deterministic mineral marks. Main equipped classic floor only; other finish catalog stays historicalA pending review.
- pixel-joinery.ts: half-unit wood beams and recessed cabinet panels, brass pulls. Main back bar, service cupboard, default counter and crown beam integrated.
- pixel-window-village.ts: two building depths, layered foliage, day/night palette; independently behind existing glass/mullions/curtains.
- fine-sprite-art.ts: sidecar2x artwork for all CharacterFrames poses while original logical canvases stay unchanged. Hair, silhouette corners, face, garment folds and shoe surfaces reauthored; lazy generation, mirrored variants, logical crop conversion. Main scene integration done; overall live-room art review pending.
- room-art.ts: main espresso machine fine hardware, explicit multipane sunlight. Builtin dining table/chairs fine variants integrated through fine-dining-art.ts; actual-game visual review pending.
- pixel-room-shell.ts: exposed receding wall faces and background kitchen portal header; existing physical doorway painter remains unchanged.
- Cats, movable furnishing catalog, full menu/ingredients and other-room scenery remain historicalA-derived at this checkpoint, not accepted new reference-matched art.

- fine-dining-art.ts: native66×54 table and30×52 facing chairs; identical logical anchors through sidecars.
- fine-counter-props-art.ts: half-unit glass jars, wicker, cake dome and stacked porcelain in main rear worktop; extra sugar/saucer helpers are authored but not all installed.
- fine-plant-art.ts: fine leaves/stems/clay, used in main fixed entrance pots and counter vine. Movable plant catalog remains historical until separate review.

## Selected bitmap coverage, 2026-10-13 07:09 UTC

| Family | Connected now | Still required |
|---|---|---|
| Main furniture | Default walnut counter/back-bar bitmap panels, independent two-facing chairs/table/vase, entrance plant/vine, empty wide display | Espresso machine, service shelves/cupboard, window/curtain/lamp/book/jar assets and other finishes remain prior art |
| Main food | Generated croissant and strawberry cake driven by actual positive stock | Remaining53 menu icons,12 ingredients, recipe dosage icons and cup/plate status art |
| People | Default owner9 frames with left mirror; existing state/cup overlays | All30 distinct customer identities including12 regulars, other staff/custom-owner variants, full interaction poses |
| Cats | Existing full behavior preserved | All12 selected-style cats and state/motion frames |
| Movable catalog | Existing move/storage/render paths preserved |39 furniture35 decor generated coverage still outstanding |
| Areas | New main assets plus shared table renderer | Reading/greenhouse/terrace/kitchen backgrounds and area-specific furnishings; locked/open variants |
| UI | Existing pixel UI maintained | Consistent fine-pixel icon treatment and complete menu/ingredient/status review |

Next production batch: customer cast0/Mina only, identity-matched nine stand/walk poses, two seated poses, four seated-petting poses. No static standing substitute and no reassignment to all customers. New customer samples require common head/body scale, separate props, and explicit seated anchor review before integration. Subsequent main prop batch precedes broad room expansion.

## Selected bitmap coverage checkpoint, 2026-10-13 08:05 UTC
- Main: counter wood modules, table/vase/left-right chairs, two entrance plants/counter vine, empty display plus two real bakery items, machine/pickup/cupboard/cups/jars/basket integrated. Sky/weather/menu/window shell/lamp replacement currently being integrated; inspect later screenshots before marking accepted.
- People: all-zero default owner identity9source poses + left mirror, with matching editor/onboarding/status preview. Cast0/Mina15source poses + left walking mirror, matching regular portrait. Full animation source coverage for these two identities is not full visual validation: Mina pet hand/cat contact needs correction. Other29 customer appearances, customized owners, otherstaff and all12cats still use previous artwork.
- Original imagegen source sheets, crop scripts/manifests and superseded originals live under assets/generated/main-v1,main-v2,staff-v1,staff-v2,customer-0-v1,service-v1,wall-v1. Runtime public assets are separate.
- Extension-room environment/furniture, kitchen, complete39furniture/35decor catalogs,55menuitems/12ingredients/customrecipeicons and remainingUI are not accepted in the selected bitmap style. Existing functioning fallbacks remain until each family is replaced and verified.

## Current generated runtime coverage — 2026-10-13 09:08 UTC

- Main-room furniture/counter/plant/display modules:11PNG; service props6; wall frame/board/lamp3.
- Default all-zero owner:9PNG, all other saved Looks keep distinct fallback.
- Cast0/Mina:15PNG,29other fixed identities keep distinct fallback.
- Siamese:14PNG,11other breeds keep distinct fallback. All fourteen lossless source crops independently verified; actual ordinary adoption/service/refresh/pet/locate checked.
- Total before menu batch:58 runtime PNG. Main-menu espresso/latte/eggtart3additional PNG are currently being integrated, not yet counted as browser-verified. Croissant/cake will share their existing images between world and menu/order UI.
- Identity expansion architecture and all30cast ledger:IDENTITY-COVERAGE-PLAN.md. Main-room acceptance remains open; the exhaustive inherited catalogs above are requirements, not claims of new generated coverage.
