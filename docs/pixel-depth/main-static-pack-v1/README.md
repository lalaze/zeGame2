# Main static runtime packing, v1

## Result

16 archived originals: 6,229,961 bytes → 502,523 bytes. Saved 5,727,438 bytes.
All shipping generated PNGs: 823 files, 25,662,684 → 19,935,246 bytes.
Decoded source RGBA estimate: 69,463,216 → 49,958,616 bytes. This excludes Canvas backings, textures, decoder overhead and all other page resources.

The two cabinet texture PNGs and five direct Phaser furniture/plant PNGs remain byte-identical at their original URLs. All 807 prior public PNGs outside this batch, including original-actor and signature runtime exports, remain hash-identical. All 71 src/game files checked against the pre-batch baseline are unchanged.

## Reproducibility and restoration

Run `node scripts/pack-runtime-catalog.cjs --main-static-only` to regenerate only this batch. Full, `--original-actors-only`, and `--signature-only` modes also preserve it; all four completed with 816 catalog images and 18,597,817 catalog PNG bytes. Repeated static-only then full exports reproduced all 843 checked PNG/metadata/archive files byte-for-byte.

The immutable originals and their SHA-256 values are in `assets/generated/original-main-static-v1/manifest.json`. `restore-mapping.json` lists all 16 removed public duplicates and exact archived restore sources. Each old public file was byte-compared with the archive and the pre-batch hash before removal. No original crop was destroyed. Source sheets and authoring manifests remain unchanged. Original furniture aliases for sconce/vine resolve through the exact hash-verified archive during full export.

## Geometry and evidence

Runtime metadata records originalSize, packed size, isotropic scale and productionContentSize. Layout/crops/apertures use original coordinates; only source sampling coordinates scale. Ceil padding is not stretched into the visible image (jars have a 97px canvas but 96.00000000000001px content). Window/board/lamp 10px insets, pickup 8px inset, aperture/sill, machine/cupboard feet, basket foreground and all menu/inventory envelopes retain their authored positions.

`comparison.png` is a 640×480 original/packed native RoomPainter pair using identical state and production architecture/projection. It is offline evidence, not browser or phone acceptance. `before.png` and `after.png` are individual views. The scene omits live actors and unrelated placed furnishings. The main-static-specific tests assert exact source transforms and identical destination/path geometry; reduction naturally changes fine pixels.

Native backend note: the unchanged 2,880 Canvas→Canvas floor scan strips triggered SIGKILL even in an isolated process. A diagnostic without floor projection completed at ~217MB RSS. The final evidence uses an offline-only immutable Image snapshot for the floor, verifies its decoded pixels exactly equal the production floor canvas, and asserts all 2,880 strip coordinates exactly match. Browser floor rendering is unchanged. The final image includes the actual production projection and room shell, not the diagnostic unprojected floor.

## Per-image export

| ID | Original | Packed | Scale | Bytes before → after |
| --- | --- | --- | --- | --- |
| vine | 388×453 | 83×96 | 0.211920529801325 | 285,432 → 15,535 |
| display | 1941×521 | 256×69 | 0.131890777949511 | 894,346 → 28,587 |
| espresso | 531×459 | 128×111 | 0.24105461393597 | 239,982 → 23,245 |
| latte | 682×540 | 128×102 | 0.187683284457478 | 363,155 → 23,385 |
| eggtart | 613×473 | 128×99 | 0.208809135399674 | 313,608 → 23,743 |
| croissant | 437×293 | 128×86 | 0.292906178489703 | 143,003 → 14,989 |
| cake | 336×327 | 128×125 | 0.380952380952381 | 136,327 → 23,744 |
| service-pickup | 1297×1118 | 192×166 | 0.148033924441018 | 1,604,074 → 48,597 |
| service-machine | 488×433 | 128×114 | 0.262295081967213 | 403,252 → 33,427 |
| service-cupboard | 536×389 | 192×140 | 0.358208955223881 | 371,134 → 51,449 |
| service-cups | 222×294 | 49×64 | 0.217687074829932 | 132,061 → 8,196 |
| service-jars | 351×304 | 97×84 | 0.273504273504274 | 190,389 → 17,192 |
| service-basket | 430×235 | 96×53 | 0.223255813953488 | 207,550 → 11,923 |
| wall-window | 633×514 | 256×208 | 0.404423380726698 | 430,696 → 67,194 |
| wall-board | 818×412 | 384×194 | 0.469437652811736 | 418,095 → 100,274 |
| wall-lamp | 206×294 | 68×96 | 0.326530612244898 | 96,857 → 11,043 |
