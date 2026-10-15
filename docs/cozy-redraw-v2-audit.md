# Cozy redraw v2 audit — 2026-10-15

This audit describes the runtime at commit `619363d`, before the v2 redraw. It follows actual resolvers and source declarations rather than treating every archived PNG as active art.

## Current reference

`public/art/generated/cafe-style-sample-v1/sample.png` establishes warm, rounded pixel clusters, substantial oak furniture, chestnut outlines, cream/red gingham, moss green and amber upper-left light. The current people are already in that family: `reference-character-art.ts` resolves owner, barista, server and cook through `cozy-team-v7`, and all customer appearances through `cozy-cast-v4`, with approved sample overrides and `cozy-seating-v3` furniture/poses. `cozy-cafe-v1` supplies the main oak cabinets/window and alternate table/chair sprites. `reference-main-v1/espresso.png` is the newer machine. The older `docs/cozy-character-integration.md` describes intermediate partial coverage and no longer describes the complete character resolver.

## Active work remaining before this redraw

| Domain | Active source / integration | Coverage to redraw |
| --- | --- | --- |
| Cats | `generated-cat-art.ts`, `catalog-v1/cats`, `CafeScene.residentFrames` | 12 identities × 14 poses, including raised nuzzle contacts. Both scene and `PetPanel.updatePortraits` already use the generated adapter after loading. The legacy `catFrames` is a fallback, not the final loaded portrait. |
| Kitchen | `kitchen-art.ts`: `paintKitchen`, cooler, dryStore, handSink, mixer, proofer, hood, kettle, deckOven, convection, fryer, `paintBench`, `paintBins`, `paintRack`, `paintPastryFridge`, `paintDishPit` | All room architecture and appliance bodies remain the earlier procedural pixel family. Preserve live doors, contents, water, steam, heat, fans, dough and station states. |
| Extensions | `region-art.ts`: `paintRegion`, `libraryShelf`, `gardenBox`; `passages.ts` | Reading shelves/window, greenhouse glass/benches/hangers, terrace parapet/pergola/planters/lights, and connecting door frames. Preserve open/locked rooms, animated lighting, routes and variable room height. |
| Placeable furniture | `generated-furniture-art.ts`, `catalog-v1/furniture` | 39 IDs, shared by shop thumbnails, placed world sprites and placement ghosts. Include clock and light attachment metadata. |
| Decoration/materials | `generated-decor-art.ts`, `catalog-v1/decor` | 36 source IDs across wall/floor tiles, counter halves, sills, ceilings, rugs and neon. Keep source tile geometry and dynamic light/text. Default oak already uses the newer cozy cabinet route. |
| Menu and ingredients | `generated-food-art.ts`, `generated-ingredient-art.ts`, `catalog-v1/menu`, `catalog-v1/main-static`, `catalog-v1/ingredients` | 55 static menu identities in total (50 catalog menu + espresso, latte, eggtart, croissant and cake) and 12 ingredients. Shared icon/artwork adapters cover menu, orders, kitchen stock and reports. |
| Signature drinks | `generated-signature-art.ts`, `catalog-v1/signature` | 14 independently composited cup/liquid/topping layers; preserve the dynamic recipe composition and exact layer registration. |
| Main room remnants | `room-art.ts`, `fine-counter-props-art.ts`, `service-props-art.ts`, main-static PNGs | Old wall board/lamp, pickup hutch, cups/jars/basket, vine and entry plant; procedural grinder, milk pitcher, dome, sack, bakery case, table vase/tent. Keep stock, menu text and table numbers live. The removed service cupboard must not be restored. |
| Environment and tableware | `generated-main-environment-art.ts`, `generated-tableware-art.ts` | Six beam/post/threshold/scenery assets; seven cups/plates/tray/effect assets. Keep shallow plate/tray support geometry rather than forcing a frontal bowl into a shallow footprint. |

Only the main-room canvas currently paints at density 2; extension/kitchen background layers paint at density 1. New imagery alone does not remove that sampling difference. Sprite adapters already publish higher-density backing canvases through `fineSpriteArt`.

## Historical material outside the active redraw scope

`assets/generated/bulk-candidates` contains original candidate/source evidence. Kitchen and extension candidates there are not automatically loaded or rendered. `public/art/room-*.png`, `tiny-bean-art.png/json/zip` are exports, not live room textures. `cozy-owner-v5`, `cozy-owner-v6` and `reference-characters-v1` have superseded character implementations; the current main resolver does not import the older owner modules. The `catalog-v1` old human manifests are still loaded by the earlier generic adapter, but the ready reference-character resolver wins for actual characters. Do not spend the redraw on those unused human PNGs or overwrite historical evidence.

## Integration requirements

Replace identities at shared adapters, so scene, thumbnail, ghost and export consumers stay consistent. Use versioned generated sources and record prompts, original dimensions, measured bounds and attachment points. Keep complete animation packs atomic and preserve common physical scale across poses. Keep foot, hip, worktop, clock-dial, lamp-wick and pet-head contacts explicit. Add fixtures that exercise all five rooms, unlock states, both seat orientations, cat walking/grooming/nuzzle, all furniture/decor choices and representative menu/signature layers. Source existence and nonempty crops alone do not prove scene-scale visual acceptance.

The contact and aspect warnings in `docs/pixel-depth/REMAINING-ROOM-LAYERS.md` remain useful constraints, especially bench body versus mixer clearance, cooler doors, opaque interiors, hanging hooks and pergola proportions.

## Cat slice delivered

`public/art/generated/cozy-cats-v2` now contains all twelve newly generated fourteen-pose atlases, prompts, source hashes and calibrated metadata. `src/render/cozy-cat-assets.ts` provides the compatible shared adapter. The five focused contract tests pass. Actual Chrome checked all 168 baked frames and 12 shared UI portraits without empty frames, clipped opaque edges or invalid mirrored contacts; the full pose sheet was visually inspected. See the asset folder README and `artifacts/cozy-cats-v2-browser-report.json` for the evidence and focused-check limits. The old cat PNGs remain archived; normal loaded runtime selection is handled by the overall scene integration.
