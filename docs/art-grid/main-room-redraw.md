# Main café redraw, backlog 1–4

The redraw is code-authored at two art pixels per room pixel, using the existing
master palette. No generated asset pack, prompt, source bitmap, historical pack,
gameplay geometry, simulation, save field or HTML interface was changed.

## Artwork

| Backlog | Treatment |
| --- | --- |
| 1. Big surfaces | Native cream/oat beveled tiles, distinct plank/parquet/mint/terrazzo/marble alternatives; honey worktops and recessed cabinet panels; warm sage glazing and cream bakery interior; walnut pickup hutch, inset sign and shelves; framed end gate; paneled walls, crown/base trims and palette-matched side returns; continuous sage T runner with restrained yarn blocks and separate purchased rugs. |
| 2. Light | Two golden panes per opening, fixed upper-left key, crossbar gap, half-pixel scanlines, feathered far edge extending beyond the counter. Object exposure follows the same reach. Stronger chestnut contact shadows supplement the existing cast/contact passes. Main-only lamp pools use smooth alpha falloff sampled at half-room-pixel spacing and cached textures. Main night grading retains amber material warmth. |
| 3. Signage | Café name, 今日菜单/MENU, 点单/ORDER, 取餐/PICKUP, 营业中/休息中 and OPEN/CLOSED use binary pixel masks. Chinese uses the loaded bundled Fusion Pixel face at 12 native art pixels, with complete ink bounds and thresholded alpha. Latin uses bitmap glyphs, with distinct supported accents. Unsupported characters use distinct six-digit hexadecimal code-point plaques; no OS font fallback. The existing code-point limit, measuring and ellipsis algorithm remains. Main café-name neon opts into the same lettering. |
| 4. Primitives | Scanline circle and carved crescent; beveled wooden OPEN/CLOSED plaque; grain/bevels on the narrow counter return; native sill cactus/tulips/bonsai silhouettes; warm glass replacing cyan. |

The main floor still uses the established row projection. Its motifs use broad
blocks and flat fills rather than fine dithering. No slot, seat, collision,
walkable boundary, sprite attachment, tap target or pass-bell coordinate moved.
Bakery icons remain driven by the existing menu/stock/phase logic. Menu icons,
clock, ceiling, kitchen door, window cat and all other live layers remain active.

All seven wallpapers, six floors, five counters, three sill plants plus none,
and three purchased rugs plus none have native main-room surface painters.
Classic Cream, Mint Fresh and Rose Cottage retain their existing finish IDs.
Ceiling and neon body artwork keep their existing painters/asset variants; only
main-room neon name lettering changes. No other room artwork is converted here.

## Files in this change

Production:

- `src/render/main-room-surfaces.ts` (new)
- `src/render/room-art.ts`
- `src/render/pixel-room-shell.ts`
- `src/render/main-room-lighting.ts`
- `src/render/lighting.ts`
- `src/render/sign-lettering.ts`
- `src/render/decor-art.ts` (opt-in main-room neon lettering)
- `src/render/phaser/cafe-scene.ts` (main sill adapter and main-only lamp falloff)

Tests/tools:

- `src/render/main-room-surfaces.test.ts` (new): palette, native grid,
  deterministic/distinct finishes, floor bounds, curved sky silhouettes.
- `src/render/sign-lettering.test.ts`: binary Unicode fallback, mixed-name bounds,
  distinct accents, native Chinese bottom strokes and alpha threshold.
- `src/render/main-room-lighting.test.ts`: the intentionally brighter/longer pane
  contract replaces the old diffuse-only contract; checks fade, reach, night
  suppression and native grid.
- `src/render/rug-join.test.ts`: new sage material/binding and native purchased-rug
  painters replace the former jute colors; geometry and continuity assertions stay.
  Its recorder now restores canvas alpha and ignores translucent lighting while
  probing the underlying textile material.
- `src/render/passages.test.ts`: floor-material comparison uses the new native
  main-floor painter; doorway, sill and clearance assertions are unchanged.
- `src/render/generated-service-props.test.ts`: font mock exposes bitmap glyphs;
  generated pickup expectations become native shelf/pixel lettering assertions.
  Pickup image counts are zero, including asset removal and live-stock cases;
  six slots, bell, shelf planes, stock and canvas state stay checked.
- `src/render/generated-wall-art.test.ts`: font mock exposes bitmap glyphs;
  square sun/moon and native `fillText` expectations become curved pixel marks and
  binary lettering. Sill plant anchor and full-size Chinese line spacing are
  checked. Floor beam assertions use the new palette pigment and pane widths.
- `scripts/main-room-surface-qa.mjs` (new): reproducible software surface swatch;
  explicitly does not substitute for real-renderer visual QA.
- `docs/art-grid/main-room-redraw.md` (this report).

Pre-existing worktree changes, including the art-grid foundation, remain in place.
No commit or stash was made.

## Verification

- `npx tsc --noEmit`: pass.
- `npm run build`: pass; log `artifacts/art-grid/main-redraw-build.log`.
- `npx vitest run --reporter=json --outputFile=artifacts/art-grid/main-redraw-tests.json`:
  compare exact failed test names and discovery-suite names with
  `foundation-test-failures.txt`. Final counts are recorded in
  `artifacts/art-grid/main-redraw-test-comparison.json`.
- `node scripts/main-room-surface-qa.mjs`: generated and visually inspected
  `artifacts/art-grid/main-redraw-surfaces.png` (640×480, native art grid).
- `node scripts/pixel-conform.mjs check artifacts/art-grid/main-redraw-surfaces.png`:
  pass. This is the only new PNG; there are no new/changed runtime PNGs.
- `git diff --check`: pass.

Real-renderer QA commands attempted:

```sh
node scripts/art-grid-qa.mjs --base=http://127.0.0.1:5199 --out=artifacts/art-grid/main-redraw-day --light=10.5
node scripts/art-grid-qa.mjs --base=http://127.0.0.1:5200 --out=artifacts/art-grid/main-redraw-night --light=21
node scripts/art-grid-qa.mjs --base=http://127.0.0.1:5200 --out=artifacts/art-grid/main-redraw-en --light=10.5 --locale=en
```

**Blocked by the sandbox:** Vite cannot bind either `0.0.0.0:5200` or
`127.0.0.1:5200` (`listen EPERM`). The previous port 5199 did not respond.
Headless Chrome exits before `Target.createTarget`; the QA script exits 13 with
an unsettled top-level await. No real-renderer screenshots were produced in the
three requested capture folders. Night/English attempts have logs under
`artifacts/art-grid/main-redraw-{night,en}.log`.

The approved sample and foundation main-room capture were inspected alongside
the software swatch. Final composition, Chinese font appearance in Phaser,
night/day balance, projected rugs and lamp appearance still need the prescribed
real-renderer captures in an environment that permits Chrome and a dev server.
Unsupported Unicode is intentionally represented by code-point plaques, not by
a full additional font. Unrelated legacy props/ceiling/neon body assets retain
the foundation's runtime resampling. No animation was added; the new glows and
mask variants are cached, and shadow-state buckets remain bounded.

The required automation-process check was attempted with both `ps` and `pgrep`.
The sandbox denies process enumeration (`operation not permitted` / `Cannot get
process list`), so cleanup could not be independently verified. No agent-browser
session was started, and no ordinary user Chrome process was targeted.
