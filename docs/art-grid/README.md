# One art grid for the café world

The café looked inconsistent mainly because each frame mixed art at several pixel sizes:
room layers at 2 art px per room px, code-drawn shapes at whole room pixels, characters
at 3×, generated furniture/food/cats at 4×, and in-world text at screen resolution. On
top of that the stage was scaled by fractional factors (4.17× at 1440×1000, ~7.25× on a
Retina laptop window) with nearest-neighbour sampling, so pixels came out uneven and
fine sprites lost or doubled pixels.

The foundation below puts everything on one grid. It does not by itself redraw the
placeholder-looking surfaces; that is the backlog at the end.

## The grid

- **1 room pixel = 2 art pixels** (`WORLD_ART_DENSITY` in `src/render/world-art-grid.ts`).
  The 320×240 room is 640×480 art pixels. This matches the approved sample
  (`public/art/generated/cafe-style-sample-v1/sample.png`): a seated figure's head there
  is ~30 pseudo-pixels wide, and a 15-room-pixel head is 30 art pixels.
- **The stage renders an even number of device pixels per room pixel**
  (`fitFullscreenRoom`, `src/ui/fullscreen-layout.ts`), so every art pixel covers the
  same whole number of device pixels. If that exact scale is within 10% of the contain
  size, the room shows at exactly that size and the neighbouring-room previews fill the
  margin (crisp, no browser resampling). Otherwise the room keeps its contain size and
  the browser smooths the small remainder (phones and some laptop windows). The room's
  offset in the drawing buffer is a whole pixel (`viewportFrame`).
- **Sprites draw from their world-grid artwork.** `CafeScene.image()` uses
  `worldSpriteArt()`: 2× and room-pixel art is used as is; 3×/4× backings are resampled
  once (cached) with the dominant-colour resampler in `src/render/pixel-resample.ts`
  (area-weighted colour families instead of blending or nearest-neighbour, plus outer
  contour restoration). Lit variants, seated crops (`worldCrop`), baked floor/wall
  furniture, kitchen floor pieces, tray icons and generated main pictures follow the
  same grid. Room layers paint through `gridSafeContext()`, which resamples any finished
  image drawn smaller than its own resolution to exactly the pixels it covers.
- The HTML UI uses the master-palette joinery in `src/style.css`: walnut/honey
  cabinet frames, brass-edged paper plates and raised sage buttons. Shop thumbnails
  and portraits retain their original backings.

## Café team poses

The owner, barista, server and cook now use `team-pixel-art.ts` through
`cozy-team-art.ts`. Source paintings are labelled by material and voted directly
onto the 2× world grid, then painted with the master-palette customization ramps.
Each pose's grid is cached across looks; the world renderer uses it without another
resample. Faces keep their eyes and mouth, outlines are one art pixel, and the
seated foreground is cut at pixel centres to avoid translucent table-edge fringes.
Saved appearance IDs, logical sizes, carry/seat/pet anchors and mirrored poses are
preserved. Garments use the selected clothing ramp directly, including staff aprons.

Inspect `/scripts/team-art-fixture.html?verify=1&zoom=2` on the dev server. Its
`#team-art-report` checks 32 role/look combinations and 768 whole/foreground frames
for native density, palette, binary alpha, mirrors, cache reuse and contacts.
The numerical conversion tests live in `src/render/team-pixel-art.test.ts`.

## Interface chrome

The final material layer in `src/style.css` owns interface colors and bevels, not
room fitting or gameplay. One interface art pixel is **2 CSS pixels**; outlines,
top-left highlights, bottom-right shades and pressed travel use whole multiples.
Zero-blur CSS shadows avoid resampling frame textures. Frame dimensions therefore
map to integer device pixels at DPR 1, 2 and 3; this arithmetic is regression-tested
in `src/ui/pixel-chrome.test.ts`, not a substitute for browser screenshot review.

The edge tool faces are inset inside the existing button rectangles, exposing more
room art without reducing touch targets. Native checkbox, text, number, select,
progress and disclosure elements keep their semantics and interaction handlers.
Number fields retain browser spin controls and the existing pixel +/- buttons;
the native spin glyphs and select popup are browser-owned. Forced-colors mode
restores native checkbox/select appearance. Existing Latin/Chinese pixel fonts,
breakpoints, drawer scroll ownership and focus trapping are unchanged.

Round 5 verification and the outside-sandbox visual checklist live in
`artifacts/art-grid/round-5/report.json`.

Resampling 3×/4× art down to 2× is an interim measure: thin details (chair-back slats,
1-pixel mouths) can merge. **New and redrawn world art must be authored natively at 2×**
so nothing is resampled at runtime.

## Rules for world artwork

1. **Size.** Author each asset at exactly its in-game logical size × 2. Register it with
   `registerFineSpriteArt(logical, backing, 2)` (or paint room layers at density 2). No
   runtime scaling other than whole multiples; never `setDisplaySize` a painting to an
   arbitrary size.
2. **Palette.** Use `docs/art-grid/palette.json` (136 colours in 36 named ramps, swatch
   `palette.png`). Sampled ramps come from the approved sample; the skin, hair, cloth and
   pants ramps shade the game's customisation colours. If a new material truly needs a
   ramp, add it to `palette-spec.json` and rebuild (command below), rather than
   introducing loose colours.
3. **Outlines.** One art pixel, from the warm `ink`/darkest ramp shades; never pure black.
   Selective outlining (lighter outline on lit edges) is welcome.
4. **Light.** One key light from the upper left. Highlights on top-left edges, shading on
   lower-right. Every grounded object gets a contact shadow directly under its feet/base.
5. **Alpha.** Fully opaque or fully clear, except glass, steam, shadows and glows.
6. **Text in the world** uses pixel fonts at their native pixel size on the art grid, with
   no anti-aliasing: Fusion Pixel 12px for Chinese (`@fontsource/fusion-pixel-12px-proportional-sc`,
   already subset into `src/assets/pixel-zh.woff2`) and a pixel Latin face. No system fonts.
7. **Projection.** Back walls are frontal; furniture is a low three-quarter view. The main
   room floor layer is row-warped by the keystone projection (`backScale` 0.9,
   `src/render/pixel-floor-projection.ts`), which resamples it per row. Floor and rug art
   for the main room must be warp-friendly (flat fills and grout lines, no fine dithering,
   motifs of 4+ art pixels) or be drawn in perspective with the warp bypassed for it.
8. **Detail density.** Large surfaces (floor, counter, walls) need material and light, not
   noise; small props should not out-detail the room around them.

## Tools

```sh
# Generated or painted source → 2× world art on the master palette
node scripts/pixel-conform.mjs conform source.png --out=public/art/…/thing.png --room-width=44 [--crop=x,y,w,h] [--key=#ffffff:24] [--keep-alpha]
# Verify art is on-palette and has clean alpha (exit code 1 on failure)
node scripts/pixel-conform.mjs check public/art/…/*.png
# Rebuild the palette after editing palette-spec.json
node scripts/pixel-conform.mjs ramps docs/art-grid/palette-spec.json --out=docs/art-grid/palette.json --swatch=docs/art-grid/palette.png
# Captures of all five rooms at an exact 4× stage plus 3× close-ups (needs npm run dev and Chrome)
node scripts/art-grid-qa.mjs --base=http://127.0.0.1:5173 --out=artifacts/art-grid [--light=10.5] [--locale=en]
```

`scripts/art-grid-fixture.html` renders the live painters with no save (`?backing=4&qa-light=10.5&locale=zh`).
Image generators produce "pixel-style" paintings without a real grid; always pass their
output through `conform` (or redraw by hand) and inspect the result in the fixture, not
just the PNG.

## Redraw backlog (priority order)

1. **Main-room big surfaces** — floor tiles, counter body and top, glass case, bakery case,
   pickup hutch and its sign, counter end cap, side walls and trims, the T-shaped rug.
   These are flat code fills next to richly shaded cabinets and cover most of the screen.
2. **Light** — readable window light patches on the floor in daytime (the sample's main
   mood), contact shadows, lamp glows without stepped concentric discs, warm (not grey)
   night floors.
3. **In-world signage** — menu-board title, ORDER/PICKUP/OPEN/CLOSED (点单/取餐/营业中/休息中),
   kitchen STORE/PREP, room name boards: pixel fonts per rule 6.
4. **Code primitives** — square sun/moon (the moon reads as an "L"), flat open-sign box,
   flat brown strip beside the left sill, blurry sill plant, cold light-blue counter glass.
5. **Customers into the staff family** — soft warm outlines, the staff's proportions,
   simple 2× faces; avoid hard broken black outlines and smeared or see-through pixels.
6. **Other rooms** — reading-room armchair and floor lamp at believable scale, glasshouse
   checker floor and terrace terrazzo calmer, room-specific furniture instead of the same
   gingham set everywhere.
7. **HUD frames** — implemented with palette-based pixel joinery, same layout and behaviour; outside-sandbox browser review remains (see the round 5 report).
