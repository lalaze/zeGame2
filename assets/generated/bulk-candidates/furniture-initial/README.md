# Movable cafe assets v1

Four independent sprites generated with the built-in imagegen tool in the approved fine-pixel walnut/brass/cream/gingham direction. No repository edits, commits, pushes, or runtime integration were performed.

- `clock.png`: hand-free cream dial with twelve tick marks, walnut frame and brass inner ring. The existing game clock is live local time; integration must keep separately rendered dynamic hands. Approximate dial center is in the manifest.
- `coatrack.png`: slender walnut/brass rack with sage felt hat and red-cream gingham scarf.
- `bookshelf.png`: three shelves of decorative books, no readable titles, no extra top props.
- `catbed.png`: completely empty wicker bed with cream cushion and gingham border. Living cats must remain separate.

`sources/` preserves all four full generated RGBA images. The four top-level sprite PNGs are lossless crops of those sources, using the alpha > 128 silhouette plus ten pixels of margin. `movable-source-sheet.png` packs the crops at native resolution, without scaling or pixel modification. `PROMPTS.json` preserves all four full prompts.

The manifest records source dimensions, crop rectangles, alpha > 128 bounds, bottom-center feet, SHA-256 digests, logical envelopes and aspect-preserving fit. Coordinates use top-left origin; boxes have exclusive right/bottom edges. No redraw, recoloring, background removal or alpha-threshold editing was used.

## Integration constraints and honest limitations

The existing floor renderer centers a sprite at cx and puts its bottom visible row at footY. Place by the recorded visible bounding box and bottom-center anchor, preserving aspect ratio. The game grid remains unchanged (CELL=8). Clock is wall-mounted in a 3x3-cell footprint; its old visible envelope is 21x21. Coatrack 10x28, bookshelf 32x34, catbed 18x11 are old logical envelopes.

Generated coatrack is narrower than the original envelope (uniform fit about 7.74x28). Catbed is flatter and wider (uniform fit about 18x8.31). Neither should be stretched to fill the old rectangle. Clock outer silhouette is about 1.2% taller than wide, and the dial-center metadata is a visual measurement to verify during integration. The bookcase matches its old ratio closely. Fine detail naturally reduces at tiny display resolutions; no final in-game scale/readability claim is made.

Alpha is genuinely present; all crops include transparent exterior space. Imagegen also emitted sparse very faint alpha fringe far outside the visible silhouettes. Crops preserve every RGBA pixel inside their rectangle and the full source remains available, but ten-pixel cropping omits distant near-transparent source pixels. This is not an alpha cleanup or background-redraw pass. No environmental floor, wall, cast shadow, separate cat or clock hands are baked into the visible artwork.
