# Siamese integration integrity audit

Audited 2026-10-13, 09:08 UTC. Independent, read-only inspection of the
Siamese assets and renderer/UI integration. This report is the only repository
file written by this audit. No production code, image, manifest, or test was
changed; no Git commit or push was made.

## Findings first

- **No confirmed runtime blocker or regression found** in the inspected
  Siamese identity, mirroring, raised response contact, character-source
  release, or pet-portrait caching paths.
- **14/14 runtime PNGs pass exact source-crop RGBA comparison**, covering
  3,306,122 pixels, including RGB values underneath zero alpha. Each runtime
  PNG is also byte-identical to the originally delivered independent crop.
- **4/4 repository-archived source sheets are byte-identical to the delivered
  originals.** No resizing, recoloring, alpha thresholding, or pixel rewriting
  has occurred between those source rectangles and the runtime PNGs.
- **Portable public and runtime manifests pass.** Their size, bbox, foot,
  head-contact, source-sheet identity, and scale fields agree. All public PNG
  filenames are relative basenames, and every file exists.
- **Recovery portability caveat, not a runtime blocker:** the archived
  `assets/generated/cat-siamese-v1/renderer-manifest.json` retains its original
  absolute scratch-directory `file` values. Its contents become exactly equal
  to the public manifest after replacing those values with their basenames.
  Recovery should use those basenames with the archived `source` and
  `source_crop` fields. The source archive contains the crop script and all
  required sheets, so the original scratch directory is not needed.
- **156 focused tests passed, 1 optional raster-evidence test skipped**,
  across 12 test files. This is not a fresh aggregate-suite or browser pass.

## Pixel and metadata verification

The independent checker opened each source sheet and runtime PNG with Pillow,
converted both to RGBA, validated the recorded rectangular crop against the
source dimensions, and compared all bytes with `source.crop(box).tobytes()`.
Right/bottom crop coordinates are exclusive. Original delivered crop PNG
bytes and archived sheet bytes were separately compared without re-encoding.

The `bbox` values below were recomputed from **alpha > 128**. That threshold
defines only QA bounds; it does not alter the PNG or supply a renderer crop.
Every PNG has alpha extrema **0–254** and contains **all 255 alpha values
0–254**. Across the set, 1,922,129 pixels have alpha between 1 and 254. Both
those values and hidden RGB are preserved exactly.

| State | PNG size | Alpha > 128 bbox (x, y, w, h) | Foot (x, y) | Head contact (x, y) |
| --- | --- | --- | --- | --- |
| idle | 396×418 | 10, 10, 376, 398 | 149, 399 | 113, 87 |
| lookUp | 379×478 | 10, 10, 359, 458 | 136, 459 | 127, 75 |
| walkA | 580×347 | 10, 10, 560, 327 | 268, 326 | 106, 83 |
| walkB | 576×350 | 10, 10, 556, 330 | 291, 329 | 104, 79 |
| swish | 449×457 | 10, 10, 429, 437 | 163, 436 | 139, 76 |
| blink | 421×457 | 10, 10, 401, 437 | 163, 436 | 140, 76 |
| happy | 426×457 | 10, 10, 406, 437 | 165, 436 | 140, 76 |
| sleep | 470×274 | 10, 10, 450, 254 | 235, 254 | 148, 69 |
| groomA | 443×448 | 10, 10, 423, 428 | 183, 426 | 146, 75 |
| groomB | 412×442 | 10, 10, 392, 422 | 150, 424 | 139, 80 |
| stretch | 643×476 | 10, 10, 623, 456 | 306, 452 | 224, 258 |
| watch | 434×487 | 10, 10, 414, 467 | 160, 468 | 157, 83 |
| nuzzleA | 606×795 | 10, 10, 586, 775 | 213, 772 | 181, 111 |
| nuzzleB | 574×794 | 10, 10, 554, 774 | 166, 771 | 202, 120 |

Foot/head values agree with the delivered metadata and remain inside their QA
bounds. Source-sheet inspection supports their intended support-midpoint and
forehead roles. They remain manually authored estimates, not mathematically
derived anatomical truth; a support midpoint can fall in the transparent gap
between paws. No opaque-pixel requirement was incorrectly applied to those
midpoints.

All four sheets were visually inspected locally for identity and pose context.
The runtime nuzzle frames come from `nuzzle-raised-source.png`, not the retired
bottom-row figures in `interaction-source.png`.

## Renderer and integration review

### Complete identity and alpha-preserving bake

`src/render/generated-cat-art.ts:76–144` validates one complete 14-frame set
before publishing it. Missing/duplicate frames, wrong breed/sheet, mismatched
physical image dimensions, invalid contacts, per-sheet scale drift, unloaded
images, and clipping scales reject the set. A later canvas failure falls back
for the whole breed. Only `siamese` resolves to generated frames; the other
eleven cat identities retain the exact fallback objects.

The bake uses the entire PNG rectangle, not `bbox`, with nearest-neighbor
sampling. This prevents QA threshold bounds from discarding the retained alpha
fringe. Each action has a 24×18 logical canvas and independent 96×72 backing.
Uniform per-sheet scales are 0.03275, 0.02948, 0.02721, and 0.0188 for core,
behaviors, interaction, and raised-nuzzle sheets respectively. All complete
source rectangles fit inside that shared canvas at the default scale; no
individual pose is normalized to a common silhouette height.

The runtime bake necessarily samples the large PNGs down to the game's art
density. The lossless claim concerns the delivered/runtime PNG assets and
their archived provenance, not equality between a source PNG and its scaled
screen rendering.

### Feet, mirror, and response contact

The common canvas foot is (12, 17), with draw offset (-3, 0). Combined with
the existing Scene placement, this retains the world foot at
`painted + (0, 1)` in either mirror direction. Contacts are mirrored exactly
once around the 24-wide logical envelope. Walking retains its authored
head-left-specific `residentCatFlipX` convention.

`CafeScene` loads, bakes, publishes, and then releases the source pack in that
order. Resident frame selection uses the shared adapter. Actual Scene tests
exercise generated look-up response contacts for both seats, both Mina pet
frames, and normal/reduced motion. Authored hand and generated forehead
coordinates agree to the renderer's half-pixel positioning tolerance without
mutating simulation state. The existing fallback contact, cancellation,
approach/retreat, and wrist-layer tests also pass.

Nuzzle is a pre-response phase; its natural head tilt is retained while Scene
anticipates the later look-up contact. This audit does not reinterpret that
phase as an exact hand-contact pose. Browser verification of those transitions
and their appearance remains a separate visual acceptance step.

### Source release and reusable canvases

`src/render/generated-character-sources.ts:28–43` releases only a ready,
currently published adapter's exact character-source IDs. It leaves baked
canvas textures, furniture, other character packs, and the adapter intact.
Cleanup is idempotent; old/unpublished/incomplete adapters cannot release a
replacement pack. A texture-destruction error retains that source's registry
ownership, permitting retry. Scene catches cleanup failure rather than
blocking an otherwise working renderer.

Tests poison the original images after release and confirm all 14 independent
logical/fine canvases, contacts, generated resolution, and UI serialization
continue working. Resolution is cached rather than re-baking on each draw.
Scene texture tests additionally verify re-registration after texture removal
and independent texture-manager ownership.

### Pet UI and pooled images

`src/ui/pets.ts:122–144` reads the ready shared adapter, encodes the fine
backing for Siamese, and preserves the legacy portrait path for other breeds.
A WeakMap caches URLs by backing canvas and export scale. Catalog and owned
views share the result; ordinary updates do not repeatedly encode it. Tests
cover a panel opened before readiness, clearing/failure/reload, replacement of
the backing under the same logical canvas, and adoption/care controls.

The Scene image helper restores scale, flip, alpha, and crop when reusing a
pooled image. Dedicated actual-helper tests pass, including mixed fine and
ordinary textures and cropped seated-character layers.

## Executed tests

First run: **6 files, 108 passed**:

- `src/render/generated-cat-art.test.ts`
- `src/render/generated-character-sources.test.ts`
- `src/render/phaser/cafe-scene-pet-contact.test.ts`
- `src/ui/generated-cat-portraits.test.ts`
- `src/render/generated-main-art.test.ts`
- `src/render/cafe-view-resident-presentation.test.ts`

Second run: **6 files, 48 passed, 1 skipped**:

- `src/render/living-cat-art.test.ts`
- `src/render/living-cat-view.test.ts`
- `src/render/fine-sprite-art.test.ts`
- `src/render/phaser/cafe-scene-image-pool.test.ts`
- `src/render/phaser/textures.test.ts`
- `src/ui/living-cats.test.ts`

The skip is `fine-sprite-art.test.ts`'s optional production-raster evidence
export, gated by `FINE_SPRITE_RASTER`. Both commands exited successfully.
The previously supplied 1505-pass/28-skip aggregate result was not rerun or
claimed as this audit's own verification.

## Provenance fingerprints

SHA-256 aggregate recipe: sort repository-relative PNG paths, concatenate
`path + NUL + sha256(payload) + LF` as UTF-8, then hash that result. `file`
uses PNG bytes; `RGBA` uses decoded pixel bytes.

```text
14 Siamese runtime PNGs: file
0a827e820e88d4ada799ae329a183362f87200e2d110a4866318d95e40363dda

14 Siamese runtime PNGs: RGBA
c02bbd93f1bddf0e7b312a385431ba6a6f4497aa3a4f9ab4d065f9048840e5bb
```

Archived source-sheet file SHA-256 values, relative to
`assets/generated/cat-siamese-v1`:

```text
core-source.png c2a338b6fd960367e37ca9405e25d9a25b96a6912a0c50abbba43b7a41cf5ceb
behaviors-source.png 2ffe585a4beb2f82e7de38bf214e416a3837ac2014703db382e0d78deef41242
interaction-source.png b920e458b59917cc68b9900998d61ca5e3097e0825a64f0b191be29e0e808a77
nuzzle-raised-source.png f6d1499b091dc6fcb5fac4205635a7f430af0831195e01ac01f93d12caad0f2c
```

The original six runtime families still contain exactly 44 PNGs. Their file
and decoded-RGBA aggregates exactly match `asset-integrity-audit.md`:

```text
previous 44: file
a53f4a50615a37214b8a7ba1c0fec84c17ff6d1c91d5c4fe2bdbcadd5b1e5e7f

previous 44: RGBA
5f94f4b74f05996b558d4e16ef7a9afc7f584aa711d676134aa17ea71206740e
```

Thus this report extends verified provenance coverage to those 44 plus the
14 Siamese assets. During inspection, a concurrent task added three
`menu-v1` PNGs. The final observed registry had 61 unique PNG URLs, all
existing and accounting for the public PNGs, but those three new menu crops
are **outside this audit's provenance review**.

## Acceptance limits

- No browser or full Scene screenshot review was performed.
- Unit canvas/Phaser stubs validate drawing calls, metadata, ownership, and
  coordinates; they do not establish actual GPU sampling, visual scale,
  all-animation smoothness, or final table/hand occlusion aesthetics.
- Manual contact estimates and overall source consistency were inspected, but
  final in-game visual judgment remains necessary.
- No fresh build, type check, whole-suite run, or production simulation
  baseline comparison was performed here. The earlier 44-asset aggregate
  checks above are fresh.
- This report does **not** mark the main aesthetic task complete.
