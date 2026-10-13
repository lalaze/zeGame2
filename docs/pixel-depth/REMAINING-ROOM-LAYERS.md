# Remaining room layers: source-audited plan, not runtime acceptance

2026-10-13 12:48 UTC. Main café remains the implementation priority. This document records read-only inspection of `region-art.ts`, `kitchen-art.ts`, `passages.ts`, `game/kitchen.ts`, the environment and kitchen candidate manifests, and their actual PNGs.

## Coordinate and state contract

All coordinates below are room-local. Origins: reading `(320,0)`, greenhouse `(320,-H)`, terrace `(0,-H)`, kitchen `(-320,0)`, where `H=sceneHeight()`. Preserve variable room height and the existing layering: room art, wall furniture, passage floor, depth-sorted actors/furniture, front boundaries, then live lighting. Generated modules must not bake inventories, room unlocks, door animation or actor contacts.

## Smallest next slice: reading

| Asset | Existing logical placement | Uniform-fit constraint |
|---|---|---|
| reading-library-shelf | Two old envelopes `(14,13,73,65)` and `(230,13,73,65)`; lower contacts `(50.5,78)` / `(266.5,78)` | Visible source516×535 fits62.7×65. Keep bottom contact; do not stretch to73×65. |
| reading-window-ochre | Old outer frame `(104,20,112,53)`, live glazing `(113,24,94,41)`, sill near `(160,73)` | Source visible1725×690 at108wide is43.2high. Re-measure full transparent apertures; manifest QA rectangles are samples, not masks. |
| reading-book-stack | Old `(181,58,14,6)`, lower contact `(188,64)` | Candidate14×8 reference yields12×8 contained. Preserve chosen sill contact. |
| blank-region-sign | Board centerx70, y7–20 | Keep BOOK NOOK text live. |

North passage overlaps the window middle: runnerx145–175, postsx139–144 and176–181 throughy84; closed gatex144–176,y24–80. These passage layers must remain independent. Keep live sky/tree view/reflections, beam startingx113–207,y80, and all existing routes. Main beam/post modules may be shared only with their validated native-fit conventions: a post at80high is17.2wide, not6wide.

## Greenhouse constraints

- Glass bays are currently53px pitch across320px and80px tall. A candidate at80high is44.1wide; at53wide it is96.3high. Recompose reviewed bay spacing or correct asset before replacement.
- Empty benches: `(6,62,96,18)` and `(217,62,96,18)`, lower contacts `(54,80)` / `(265,80)`. Uniform18high gives82wide. Live planted stock remains separate.
- Eight hanging planters: x14+40i, suspensiony1, planter top20+3(i mod3). Manifest bottom foot is not hanging hook; measure a top attachment.
- Preserve sky/tree backdrop `(0,0,320,80)`, reflections, sunbeam startsx20–54/128–162/236–270,y80, south passage and west door. Do not invent a new weather system; current code has daylight/cloud behavior.

## Terrace constraints

- Parapet legacy `(0,62,320,18)`: candidate at18high repeats44.2wide, not64. Coping legacyy59,height5: source at5high is35.3wide, not64×8.
- Pergola posts legacyx9/305,width6,height89. Whole candidate at89high is30.4wide; at6wide it is17.5high. This is a real silhouette incompatibility, not a scaling toggle.
- Beam legacyheight7 across320; source at7high is45.3wide. Use native modules with seam review.
- Festoon candidate contains three lamps and lit cores. Existing nine lamp/glow anchors follow a different curve. Requires individual lamp anchors and an off-state decision before replacing night lighting.
- Flower boxes atx39/251,bottom77: width31 gives12.9high. Vines are larger single sprigs, not automatically interchangeable with all old tiny sprig placements.
- Preserve right passage, existing sky, live lighting and floor interaction.

## Kitchen: contact-first integration required

Candidate IDs exist for18 bodies, but source existence is not runtime fit. Keep floor appliances as separately depth-sorted sprites.

Back units supporty84 unless specified: coolerx6/w34; dryStorex44/w36; mixerx104/w24; prooferx132/w24; kettlex160/w26; deckOvenx190/w56; convectionx250/w28; fryerx282/w26. Hand sink is wall-mounted aroundx84/y34, basin contactabout(92,59), not floor-foot anchored.

Critical deviations:

1. **Bench semantic height error:** manifest104×42 uses `BENCH_RISE`, including stand-mixer clearance. Actual bench body is approximately `(87,107,106,27)`, foot134, worktopy108–120. Width-fitting the generated body produces43.8high and raises the worktopabout15px. Calibrate source worktop/appliance mounts separately.
2. **Hand sink:** source lower-plumbing anchor `(155,422)` differs from wallMount `(161,219)`. Do not use the lower point as basin support.
3. **Cooler:** source hinges oppose the old artwork; opaque closed doors cannot simply receive old gap overlays. Validate a separate opening/cover/occlusion solution.
4. **Hood:** old coverageapproximately `(157,5,154,23)`. Candidate at154wide is32.6high; at23high only108.6wide. Hot-line coverage remains unresolved.
5. **Opaque interiors:** many empty cabinets are opaque, not transparent. Composite stock into calibrated interior regions with rim/door occlusion. Stock behind the full cabinet would disappear.

Other live attachments: mixer hook/pivot/bowl, proofer shelf contacts and steam, kettle opening/water/bubbles, oven chamber clips/heat/stock, convection fan, fryer vats, sheeter rollers/dough, stand-mixer beater, rack shelves, pastry-fridge glass, dish-pit sink/spray and bins labels. Hookup shows only when uninstalled.

Floor contacts: benchcenter140/foot134; sheeterold `(91,100,22,11)`; standMixerold `(169,94,14,16)`; rackx270/w22/foot118; pastryFridgex294/w20/foot118; binsx14/w40/foot=kitchenFloorY(172); dishPitx232/w64/foot=kitchenFloorY(168), plus separate old scrap bin extendingtox304.

Not supplied as dedicated kitchen candidates: wall/floor surfaces, task lights, mats, drain, ticket rail, locked-room timber/dust cover and separate scrap bin. Keep functional fallbacks while replacement scope is explicit. Source overlay coordinates are estimates, not validated runtime masks. Eight recorded aspect failures plus the bench semantic mismatch must be resolved before claiming kitchen coverage.
