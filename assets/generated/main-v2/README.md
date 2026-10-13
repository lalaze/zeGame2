# Production asset handoff

New generated images preserve the user-selected Tiny Bean Café sample style. No game source was edited. All listed asset PNGs are independent lossless crops with original alpha and 12px padding, unless noted. asset-manifest.json records crop coordinates, dimensions, visible-alpha bounds and provisional foot anchors. Production code should choose semantic anchors appropriate to each layer.

## New assets
- empty-pastry-cabinet.png: complete empty cabinet, no fixed inventory, tall base included. Avoid squeezing into wide short game area.
- empty-wide-display.png: countertop glass box only, no tall cupboard, aspect near 3.6:1 for the 72x20 display slot. Shelf remains opaque; glass and frame are not separate layers. Dynamic food should be drawn after empty case; front frame/selected reflection can be composited above if needed.
- croissant.png and strawberry-cake.png: independent food inventory sprites, no plates.
- table-no-vase.png: 563x462, ratio 1.22 fits 33x27 table; no fixed vase.
- flower-vase.png: independent table decoration.
- chair-facing-right.png and chair-facing-left.png: matching directional chairs; backrest opposite seat direction, upper-left light.

## Inspection
Complete visible silhouettes with transparent margins and no visible clipping. PNG transparency verified numerically. Alpha is non-binary with some extremely faint edge haze; crops preserve bytes and do not claim matte cleanup. Character animation was deliberately not generated: requested next minimum is barista down/back/right stand plus two walk steps and customer sit-left/sit-right. Existing static character samples must not be described as complete walk animation replacement. No new assets have been claimed as integrated or gameplay tested here.

## Prompts (built-in imagegen)
Edit the attached selected Tiny Bean Café furniture sprite sheet into a focused PRODUCTION ASSET SHEET. Preserve the EXACT approved pixel art style, warm walnut palette, pixel cluster scale, elevated near-front camera and upper-left light. Do not redesign the wood material.
Canvas 1536x1024, genuinely transparent alpha outside hard object contours, no colored haze or ground shadows. Three completely independent assets, generous blank spacing and 64px minimum outer margin:
TOP HALF: reproduce ONLY the upper-right glass pastry display cabinet from the input, but EMPTY. Keep its complete dark walnut base with three recessed front panels, brass trim, golden frame, glass upper front, top and side, same shape and camera. Remove ALL pastries, cakes, plates and internal food lighting blobs. The cabinet shelf is an empty honey-brown wooden shelf visible through clear glass, with only restrained pale glass reflection streaks. Cabinet complete and not cropped.
BOTTOM LEFT: a single croissant from the original display, isolated without plate or shadow, facing at the same elevated camera, rich golden flaky pixel clusters, roughly 180 pixels wide.
BOTTOM RIGHT: a single strawberry mini cake from the original display, isolated without plate or shadow, cream frosting, golden cake base, red strawberry on top, same camera, roughly 160 pixels wide.
Do not include counter, table, chair, vase, people or text. Do not place pastries inside the cabinet. Assets never overlap. Hard crisp pixel edges and visible square color clusters, no smooth 3D/no low-poly/no gradients. The bakery items must remain separate sprites; empty cabinet is the dominant large asset, placed above them.

Edit the attached selected furniture sprite sheet into a matching four-asset sheet for the same café game. Preserve its warm walnut, forest-green seat cushion, red-and-cream gingham fabric, crisp pixel-cluster texture and dark pixel outlines exactly. Genuine transparent alpha outside object contours. No colored haze, no background, no floor, no shadows outside silhouettes. Canvas 1536x1024, four well-separated objects in 2x2 layout, at least 64 pixels margin and large transparent gutters.
TOP LEFT: the SAME gingham round bistro table from lower left of reference, same wooden pedestal and folds, but REMOVE the flower vase entirely. Tabletop has only uninterrupted red/cream check pattern. Elevated 35-degree near-front camera with horizontal tabletop oval, chunky coherent square pixel clusters.
TOP RIGHT: ONLY the small glass vase with white flowers formerly on the table, now independent, complete base and all petals/stems, tiny asset placed centrally with generous space; elevated 35-degree camera.
BOTTOM LEFT: the SAME dark walnut chair with forest-green seat and carved slatted back from reference, but rotate chair to face RIGHT toward a dining table to its right. Clear side-facing chair silhouette viewed from elevated 35-degree angle; BACKREST on LEFT, SEAT extends RIGHT, front legs on right, glimpse the INNER front-facing surface of backrest and top of green cushion. It must be a usable chair side sprite for a person sitting and facing right.
BOTTOM RIGHT: exact matching chair but facing LEFT, BACKREST on RIGHT, SEAT extends LEFT, front legs on left. Do not just keep original front-facing chair. Both chairs same physical scale, consistent upper-left warm lighting (not mirrored lighting), complete legs and back.
No people, no counter, no cabinet, no food, no labels, no text. Keep all objects complete, isolated, detailed 2D PIXEL ART and not smooth 3D or low-poly.

Edit the reference cabinet into an EMPTY COUNTERTOP GLASS DISPLAY MODULE with NO LOWER WOODEN CUPBOARD. Preserve exactly the pixel-art glass upper part and thin honey-walnut shelf with gold trim, same camera, same pixel texture and warm light. DELETE the entire tall three-panel walnut cabinet base, leaving ONLY a very wide low glass box on a slim wooden tray base.
Crucial sprite proportion: the complete visible object is 1260 pixels wide and approximately 350 pixels high, a 3.6:1 wide short aspect ratio. Center this single complete object on a 1536x1024 genuinely transparent canvas. Its top and bottom have broad transparent margins. Orthographic elevated near-frontal view, front horizontal edges, visible top and right side like the reference. Empty wood shelf inside, no pastries, no plates, no decorations, no labels, no lettering.
Game layer use: KEEP the interior shelf opaque walnut. Make the glass front mostly CLEAR, showing the empty shelf and rear wood panel; only very restrained reflection streaks on glass, not a solid blue wall. Complete golden glass frame and crisp pixel edges. Transparent alpha zero outside the object, no glow, no ambient shadow. Rich 2D PIXEL ART same as reference, not smooth 3D. ONLY glass box and thin tray base, NOT the tall lower cabinet.

