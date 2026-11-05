# Cozy team v8 — prompts and QA

Generated with the built-in image_gen tool. Every call used transparent_background=true. Exactly two attempts were made per requested sheet; attempt 2 was chosen for all twelve. Chosen PNGs are byte-for-byte copies of generated originals, with no resizing, recoloring, pixel edits, or source changes.

Reference images for every attempt 1 and attempts 2 of sheets 8–15:

- /Volumes/data/code/zeGame2/public/art/generated/cozy-team-v7/hair-0-short-v1.png
- /Volumes/data/code/zeGame2/public/art/generated/cozy-team-v7/hair-2-long-v1.png

Attempts 2 of sheets 16–19 used their own generated attempt 1 as the single edit target instead.

## Final verification

All twelve requested hair PNGs are 1254 × 1254, 8-bit RGBA, with real fully transparent pixels (alpha 0) and alpha values through 255. Each was visually inspected for nine complete figures, front/back/right-facing rows, hairstyle, outfit, chestnut hair, and reference palette. Palette matching is visual rather than an exact swatch guarantee. Byte comparisons against generated originals passed for all twelve.

Not fully happy with any sheet's strict equal-cell registration: top-row shoes extend below the first equal-cell boundary (y=418), despite correction requests. The images have nine separate, complete figures arranged in three rows, but strict equal-cell slicing will cut into some shoes. Minor head/baseline differences remain. Sheets 8–15 retain repeated leading feet in the back walking pair; sheets 8 and 11 also retain repeated front leading feet. Sheets 16–19 improve both front/back alternation after the targeted edits. No additional pixel editing was done, per request.

## hair-8-crop-v1.png

Chosen: attempt 2. Size: 1254 × 1254. Alpha: yes.

Chosen generated original: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-269b2752-028b-4bd8-a088-559c7acecd6c.png`

### Attempt 1

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Man: neat short chestnut crop, short at sides and back, a small soft quiff at front. Ears showing. Keep reference face. Very slightly broader shoulders permitted, same overall size.

### Attempt 2

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Man: neat short chestnut crop, short at sides and back, a small soft quiff at front. Ears showing. Keep reference face. Very slightly broader shoulders permitted, same overall size.
CORRECTION FOR RETRY: The previous result had a cloudy gray/white matte and near-opaque background. Produce CLEAN CUTOUTS: all pixels outside the characters must have ALPHA=0, not pale paint, haze or simulated transparency. No shadow or glow around figures. The second and third front/back walking frames must visibly advance OPPOSITE feet. In front row column 2 advance the foot on viewer RIGHT; in column 3 advance foot on viewer LEFT, reversing the hand swing too. Crop hairstyle must have SHORT clipped sides and back, not a shaggy nape. Preserve exact reference chestnut/cream/dark sage colors and original figure scale. Strict square 3×3 nine-figure sheet.

## hair-9-curls-v1.png

Chosen: attempt 2. Size: 1254 × 1254. Alpha: yes.

Chosen generated original: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-52c69d97-cca4-4444-9dc3-98d4a687651e.png`

### Attempt 1

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Man: short tight chestnut curls all over, a little volume on top. Clearly small tight rounded curls, short sides/back. Keep reference face. Very slightly broader shoulders permitted, same overall size.

### Attempt 2

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Man: short tight chestnut curls all over, a little volume on top. Clearly small tight rounded curls, short sides/back. Keep reference face. Very slightly broader shoulders permitted, same overall size.
RETRY CORRECTION: Keep nine complete figures, hair design, chestnut/cream/sage reference palette, transparent background and exact 3×3 layout. Fix duplicated walk frames. TOP RIGHT must have the foot on VIEWER LEFT (character's right) visibly enlarged and extended lower/forward, with the other shoe behind on viewer right; TOP MIDDLE has viewer-RIGHT foot forward, as reference. Mirror BODY pose and arm swing of top-middle to obtain top-right while keeping hairstyle consistent. MIDDLE RIGHT must likewise advance the OPPOSITE leg from MIDDLE MIDDLE: forward sole on viewer LEFT in column 3, viewer RIGHT in column 2. Bottom-right must show opposite leading leg and arm swing from bottom-middle. Do not simply copy the reference's duplicate leading foot. Cut out all figures cleanly, ALPHA=0 outside, no gray matte, halo, glow or shadows.

## hair-10-undercut-v1.png

Chosen: attempt 2. Size: 1254 × 1254. Alpha: yes.

Chosen generated original: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-4f6bea77-923c-438b-983b-8527092d7ba9.png`

### Attempt 1

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Man: chestnut undercut, sides and back clipped very short and longer top swept to one side. Clearly visible clipped back in middle row and clipped side in right-facing profile. Use chestnut tones, no new colors. Keep reference face.

### Attempt 2

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Man: chestnut undercut, sides and back clipped very short and longer top swept to one side. Clearly visible clipped back in middle row and clipped side in right-facing profile. Use chestnut tones, no new colors. Keep reference face.
RETRY CORRECTION: Keep nine complete figures, hair design, chestnut/cream/sage reference palette, transparent background and exact 3×3 layout. Fix duplicated walk frames. TOP RIGHT must have the foot on VIEWER LEFT (character's right) visibly enlarged and extended lower/forward, with the other shoe behind on viewer right; TOP MIDDLE has viewer-RIGHT foot forward, as reference. Mirror BODY pose and arm swing of top-middle to obtain top-right while keeping hairstyle consistent. MIDDLE RIGHT must likewise advance the OPPOSITE leg from MIDDLE MIDDLE: forward sole on viewer LEFT in column 3, viewer RIGHT in column 2. Bottom-right must show opposite leading leg and arm swing from bottom-middle. Do not simply copy the reference's duplicate leading foot. Cut out all figures cleanly, ALPHA=0 outside, no gray matte, halo, glow or shadows.

## hair-11-slick-v1.png

Chosen: attempt 2. Size: 1254 × 1254. Alpha: yes.

Chosen generated original: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-567d6baa-628a-44fa-a6ce-4bc0b904e8e3.png`

### Attempt 1

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Man: medium-length chestnut hair combed straight BACK from forehead, tidy smooth swept-back locks, ears visible, no hanging bangs or side part. Back view shows neatly combed-back hair. Keep reference face.

### Attempt 2

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Man: medium-length chestnut hair combed straight BACK from forehead, tidy smooth swept-back locks, ears visible, no hanging bangs or side part. Back view shows neatly combed-back hair. Keep reference face.
RETRY CORRECTION: Keep nine complete figures, hair design, chestnut/cream/sage reference palette, transparent background and exact 3×3 layout. Fix duplicated walk frames. TOP RIGHT must have the foot on VIEWER LEFT (character's right) visibly enlarged and extended lower/forward, with the other shoe behind on viewer right; TOP MIDDLE has viewer-RIGHT foot forward, as reference. Mirror BODY pose and arm swing of top-middle to obtain top-right while keeping hairstyle consistent. MIDDLE RIGHT must likewise advance the OPPOSITE leg from MIDDLE MIDDLE: forward sole on viewer LEFT in column 3, viewer RIGHT in column 2. Bottom-right must show opposite leading leg and arm swing from bottom-middle. Do not simply copy the reference's duplicate leading foot. Cut out all figures cleanly, ALPHA=0 outside, no gray matte, halo, glow or shadows.

## hair-12-beard-v1.png

Chosen: attempt 2. Size: 1254 × 1254. Alpha: yes.

Chosen generated original: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-b9572267-7bd7-43bc-8b8f-14d260035977.png`

### Attempt 1

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Man: short chestnut side-parted hair AND a neat short full beard in exactly the same chestnut brown. Thicker chestnut eyebrows. Beard follows cheeks, jaw and chin, small tidy moustache; retain visible dark oval eyes, peach face, rosy cheeks and small smile. Beard visible in front/profile, absent on back of head.

### Attempt 2

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Man: short chestnut side-parted hair AND a neat short full beard in exactly the same chestnut brown. Thicker chestnut eyebrows. Beard follows cheeks, jaw and chin, small tidy moustache; retain visible dark oval eyes, peach face, rosy cheeks and small smile. Beard visible in front/profile, absent on back of head.
RETRY CORRECTION: Keep nine complete figures, hair design, chestnut/cream/sage reference palette, transparent background and exact 3×3 layout. Fix duplicated walk frames. TOP RIGHT must have the foot on VIEWER LEFT (character's right) visibly enlarged and extended lower/forward, with the other shoe behind on viewer right; TOP MIDDLE has viewer-RIGHT foot forward, as reference. Mirror BODY pose and arm swing of top-middle to obtain top-right while keeping hairstyle consistent. MIDDLE RIGHT must likewise advance the OPPOSITE leg from MIDDLE MIDDLE: forward sole on viewer LEFT in column 3, viewer RIGHT in column 2. Bottom-right must show opposite leading leg and arm swing from bottom-middle. Do not simply copy the reference's duplicate leading foot. Cut out all figures cleanly, ALPHA=0 outside, no gray matte, halo, glow or shadows.
Keep the side-parted hairstyle short and tidy at the sides and nape.

## hair-13-buzz-v1.png

Chosen: attempt 2. Size: 1254 × 1254. Alpha: yes.

Chosen generated original: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-473a6335-6c09-47b7-b06b-b0b0ca6755c5.png`

### Attempt 1

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Man: very short even chestnut buzz cut following the rounded head shape, a thin uniform close-cropped hair layer with tiny soft hair texture, no quiff or longer strands. Thicker chestnut eyebrows. Same rounded head scale; do not shrink skull. Clearly close-cropped back and sides.

### Attempt 2

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Man: very short even chestnut buzz cut following the rounded head shape, a thin uniform close-cropped hair layer with tiny soft hair texture, no quiff or longer strands. Thicker chestnut eyebrows. Same rounded head scale; do not shrink skull. Clearly close-cropped back and sides.
RETRY CORRECTION: Keep nine complete figures, hair design, chestnut/cream/sage reference palette, transparent background and exact 3×3 layout. Fix duplicated walk frames. TOP RIGHT must have the foot on VIEWER LEFT (character's right) visibly enlarged and extended lower/forward, with the other shoe behind on viewer right; TOP MIDDLE has viewer-RIGHT foot forward, as reference. Mirror BODY pose and arm swing of top-middle to obtain top-right while keeping hairstyle consistent. MIDDLE RIGHT must likewise advance the OPPOSITE leg from MIDDLE MIDDLE: forward sole on viewer LEFT in column 3, viewer RIGHT in column 2. Bottom-right must show opposite leading leg and arm swing from bottom-middle. Do not simply copy the reference's duplicate leading foot. Cut out all figures cleanly, ALPHA=0 outside, no gray matte, halo, glow or shadows.

## hair-14-pixie-v1.png

Chosen: attempt 2. Size: 1254 × 1254. Alpha: yes.

Chosen generated original: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-73d1bdc3-fc3a-4426-9e3b-d4bfd75f564d.png`

### Attempt 1

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Woman: short chestnut pixie cut with soft side-swept bangs, ears showing, delicate tapered short nape. Do not reuse the reference shaggy bob: this is a clearly short pixie.

### Attempt 2

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Woman: short chestnut pixie cut with soft side-swept bangs, ears showing, delicate tapered short nape. Do not reuse the reference shaggy bob: this is a clearly short pixie.
RETRY CORRECTION: Keep nine complete figures, hair design, chestnut/cream/sage reference palette, transparent background and exact 3×3 layout. Fix duplicated walk frames. TOP RIGHT must have the foot on VIEWER LEFT (character's right) visibly enlarged and extended lower/forward, with the other shoe behind on viewer right; TOP MIDDLE has viewer-RIGHT foot forward, as reference. Mirror BODY pose and arm swing of top-middle to obtain top-right while keeping hairstyle consistent. MIDDLE RIGHT must likewise advance the OPPOSITE leg from MIDDLE MIDDLE: forward sole on viewer LEFT in column 3, viewer RIGHT in column 2. Bottom-right must show opposite leading leg and arm swing from bottom-middle. Do not simply copy the reference's duplicate leading foot. Cut out all figures cleanly, ALPHA=0 outside, no gray matte, halo, glow or shadows.
LAYOUT CORRECTION: A 3×3 equal-cell sheet must not let shoes extend into the next row. Give EACH full figure at least 20 pixels of transparent margin from EVERY edge of its own equal square cell, including above hair and below shoes. Keep uniform scale and corresponding head heights/baselines. On a 1254-square canvas, row boundaries are y=418 and 836: every top-row shoe must end BEFORE y=398; every middle-row shoe BEFORE y=816. Keep all nine figures complete and generously separated. No hidden grid drawn.

## hair-15-buns-v1.png

Chosen: attempt 2. Size: 1254 × 1254. Alpha: yes.

Chosen generated original: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-f2fb321f-4336-486a-968a-794802c92b8c.png`

### Attempt 1

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Woman: two round chestnut space buns on top of head, one on each side, with short loose strands at front. Hair buns formed only of chestnut hair, no ribbons or ties visible. Both buns visible and consistent in back row. Maintain overall reference scale.

### Attempt 2

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Woman: two round chestnut space buns on top of head, one on each side, with short loose strands at front. Hair buns formed only of chestnut hair, no ribbons or ties visible. Both buns visible and consistent in back row. Maintain overall reference scale.
RETRY CORRECTION: Keep nine complete figures, hair design, chestnut/cream/sage reference palette, transparent background and exact 3×3 layout. Fix duplicated walk frames. TOP RIGHT must have the foot on VIEWER LEFT (character's right) visibly enlarged and extended lower/forward, with the other shoe behind on viewer right; TOP MIDDLE has viewer-RIGHT foot forward, as reference. Mirror BODY pose and arm swing of top-middle to obtain top-right while keeping hairstyle consistent. MIDDLE RIGHT must likewise advance the OPPOSITE leg from MIDDLE MIDDLE: forward sole on viewer LEFT in column 3, viewer RIGHT in column 2. Bottom-right must show opposite leading leg and arm swing from bottom-middle. Do not simply copy the reference's duplicate leading foot. Cut out all figures cleanly, ALPHA=0 outside, no gray matte, halo, glow or shadows.
LAYOUT CORRECTION: A 3×3 equal-cell sheet must not let shoes extend into the next row. Give EACH full figure at least 20 pixels of transparent margin from EVERY edge of its own equal square cell, including above hair and below shoes. Keep uniform scale and corresponding head heights/baselines. On a 1254-square canvas, row boundaries are y=418 and 836: every top-row shoe must end BEFORE y=398; every middle-row shoe BEFORE y=816. Keep all nine figures complete and generously separated. No hidden grid drawn.

## hair-16-afro-v1.png

Chosen: attempt 2. Size: 1254 × 1254. Alpha: yes.

Chosen generated original: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-5a7b8f26-b3ae-45f5-b505-3ab4272434bd.png`

### Attempt 1

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Woman: big round voluminous curly chestnut afro, a rounded cloud silhouette of tight curls surrounding the head. Same rich chestnut color as reference, no black hair. Keep big afro within each cell with transparent margins, same body scale. Back row shows full round curly afro and apron bow below.

### Attempt 2

Inputs: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-de620dc2-474c-4bc4-a977-62ab1575e245.png` (attempt 1, edit target).

Use case: precise-object-edit.
EDIT THE SUPPLIED SINGLE SPRITE SHEET. Preserve the nine characters' hairstyle, chestnut hair color, cream outfit, dark sage apron, brass buttons, peach skin, brown shoes, dark brown outlines, soft rounded pixel-art rendering, head proportions and every accessory constraint. Keep transparent alpha background, no shadow, no matte, no text.
MANDATORY POSE CORRECTIONS:
1. TOP RIGHT body must be a HORIZONTAL MIRROR OF THE TOP MIDDLE BODY POSE, from collar downward only. Thus the large leading shoe moves to viewer LEFT and the forward hand moves to viewer RIGHT. Preserve top-right head and hairstyle unchanged.
2. MIDDLE RIGHT body must be a HORIZONTAL MIRROR OF THE MIDDLE MIDDLE BODY POSE, from collar downward only. Thus the visible forward sole and lifted leg move to the OTHER SIDE, viewer LEFT; forward hand moves to viewer RIGHT. Preserve back-view head/hair and apron crossed straps/back bow. This back-view correction is just as essential as the front-view correction.
3. Bottom row stays strict RIGHT-facing, idle then two walk steps with opposite arm and leg swing. Complete shoes.
Leave the six other frames' poses alone. Do not repeat the same leading foot in columns 2 and 3.
LAYOUT: square 3×3 equal invisible cells. Uniformly fit and center each complete character inside its own cell with at least 20 pixels of transparent margin on all four sides, so no top-row shoes fall below the first row boundary. Same figure scale in every cell and same head-height/shoe-baseline within each row. Preserve generous gutters. Nine complete figures with empty hands, no new elements.
HAIR MUST REMAIN: Woman: big round voluminous curly chestnut afro, a rounded cloud silhouette of tight curls surrounding the head. Same rich chestnut color as reference, no black hair. Keep big afro within each cell with transparent margins, same body scale. Back row shows full round curly afro and apron bow below.

## hair-17-bangs-v1.png

Chosen: attempt 2. Size: 1254 × 1254. Alpha: yes.

Chosen generated original: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-ce58e8d2-bc89-4ab9-8d58-95e33b2893b9.png`

### Attempt 1

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Woman: long STRAIGHT chestnut hair to mid-back with STRAIGHT BLUNT BANGS across forehead. Clearly straight smooth lengths, no waves/curls. Back view shows straight mid-back hair, front view long hair beside shoulders. Back apron bow visible below hair.

### Attempt 2

Inputs: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-01fde877-83ae-4f68-bd49-126d4e25035f.png` (attempt 1, edit target).

Use case: precise-object-edit.
EDIT THE SUPPLIED SINGLE SPRITE SHEET. Preserve the nine characters' hairstyle, chestnut hair color, cream outfit, dark sage apron, brass buttons, peach skin, brown shoes, dark brown outlines, soft rounded pixel-art rendering, head proportions and every accessory constraint. Keep transparent alpha background, no shadow, no matte, no text.
MANDATORY POSE CORRECTIONS:
1. TOP RIGHT body must be a HORIZONTAL MIRROR OF THE TOP MIDDLE BODY POSE, from collar downward only. Thus the large leading shoe moves to viewer LEFT and the forward hand moves to viewer RIGHT. Preserve top-right head and hairstyle unchanged.
2. MIDDLE RIGHT body must be a HORIZONTAL MIRROR OF THE MIDDLE MIDDLE BODY POSE, from collar downward only. Thus the visible forward sole and lifted leg move to the OTHER SIDE, viewer LEFT; forward hand moves to viewer RIGHT. Preserve back-view head/hair and apron crossed straps/back bow. This back-view correction is just as essential as the front-view correction.
3. Bottom row stays strict RIGHT-facing, idle then two walk steps with opposite arm and leg swing. Complete shoes.
Leave the six other frames' poses alone. Do not repeat the same leading foot in columns 2 and 3.
LAYOUT: square 3×3 equal invisible cells. Uniformly fit and center each complete character inside its own cell with at least 20 pixels of transparent margin on all four sides, so no top-row shoes fall below the first row boundary. Same figure scale in every cell and same head-height/shoe-baseline within each row. Preserve generous gutters. Nine complete figures with empty hands, no new elements.
HAIR MUST REMAIN: Woman: long STRAIGHT chestnut hair to mid-back with STRAIGHT BLUNT BANGS across forehead. Clearly straight smooth lengths, no waves/curls. Back view shows straight mid-back hair, front view long hair beside shoulders. Back apron bow visible below hair.

## hair-18-twintails-v1.png

Chosen: attempt 2. Size: 1254 × 1254. Alpha: yes.

Chosen generated original: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-0fd9c4dc-49d4-4498-b682-41a2a718d11e.png`

### Attempt 1

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Woman: two LOW chestnut twin tails resting OVER THE SHOULDERS, side bangs. Both separate low tails visible in front; back view shows low attachment points near nape and two tails draping forward over shoulders, apron back bow visible. Hair only, no accessories, colored ties, ribbons or bows.

### Attempt 2

Inputs: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-58ca2c80-c051-4b96-abf0-f3eae481f739.png` (attempt 1, edit target).

Use case: precise-object-edit.
EDIT THE SUPPLIED SINGLE SPRITE SHEET. Preserve the nine characters' hairstyle, chestnut hair color, cream outfit, dark sage apron, brass buttons, peach skin, brown shoes, dark brown outlines, soft rounded pixel-art rendering, head proportions and every accessory constraint. Keep transparent alpha background, no shadow, no matte, no text.
MANDATORY POSE CORRECTIONS:
1. TOP RIGHT body must be a HORIZONTAL MIRROR OF THE TOP MIDDLE BODY POSE, from collar downward only. Thus the large leading shoe moves to viewer LEFT and the forward hand moves to viewer RIGHT. Preserve top-right head and hairstyle unchanged.
2. MIDDLE RIGHT body must be a HORIZONTAL MIRROR OF THE MIDDLE MIDDLE BODY POSE, from collar downward only. Thus the visible forward sole and lifted leg move to the OTHER SIDE, viewer LEFT; forward hand moves to viewer RIGHT. Preserve back-view head/hair and apron crossed straps/back bow. This back-view correction is just as essential as the front-view correction.
3. Bottom row stays strict RIGHT-facing, idle then two walk steps with opposite arm and leg swing. Complete shoes.
Leave the six other frames' poses alone. Do not repeat the same leading foot in columns 2 and 3.
LAYOUT: square 3×3 equal invisible cells. Uniformly fit and center each complete character inside its own cell with at least 20 pixels of transparent margin on all four sides, so no top-row shoes fall below the first row boundary. Same figure scale in every cell and same head-height/shoe-baseline within each row. Preserve generous gutters. Nine complete figures with empty hands, no new elements.
HAIR MUST REMAIN: Woman: two LOW chestnut twin tails resting OVER THE SHOULDERS, side bangs. Both separate low tails visible in front; back view shows low attachment points near nape and two tails draping forward over shoulders, apron back bow visible. Hair only, no accessories, colored ties, ribbons or bows.

## hair-19-curtain-v1.png

Chosen: attempt 2. Size: 1254 × 1254. Alpha: yes.

Chosen generated original: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-203d801b-28e1-4c31-b35a-129c2f761c60.png`

### Attempt 1

Inputs: both v7 references listed above.

Use case: identity-preserve.
Create ONE square PNG hairstyle-family sprite sheet for Tiny Bean Café, using the two supplied sheets as strict visual references. Output a real alpha transparent background. Match the reference composition, character identity, rendering, outfit, palette, scale, poses and framing EXACTLY; change ONLY the requested hairstyle and explicitly requested facial details. Reference 1 is the short-haired family and reference 2 the long-haired family. Prefer the short sheet for body and pose registration. Do not retain its old hair.
CANVAS: square, preferably 1280 × 1280 like references. Strict invisible 3 × 3 equal-cell grid, NINE complete separate figures, centered in cells at x=1/6,1/2,5/6 of canvas. Match reference generous transparent outer margins and gutters. Same figure scale, head height and shoe baseline within each row. All hair, hands and shoes fully inside each cell, no touching or cropped parts.
POSES, left to right: TOP ROW front facing: idle with feet together; walking with character's LEFT foot forward; walking with character's RIGHT foot forward (visibly opposite leg, not duplicate frames). MIDDLE ROW back facing: idle; left-foot walking; right-foot walking. Show the actual back of the requested hair and visible apron bow. BOTTOM ROW strict side profile facing RIGHT: idle; left-foot walking; right-foot walking with opposite arm/leg swing.
FIGURE: same rounded chibi storybook proportions, head about 45% total height, small body, short legs, mitten hands, empty hands. Same soft rounded pixel-art rendering and dark-brown outlines as references, not realistic, not vector, no hard new style.
EXACT REFERENCE COLORS AND CLOTHING: light peach skin and rosy cheeks; rich warm chestnut-brown hair; cream rolled-sleeve collared shirt; dark sage-green bib apron with two small brass buttons, one front pocket, crossed back straps and back bow; cream trousers; brown shoes. Match the reference swatches without shifting hue or saturation. Same two dark oval eyes, small smile. Only face edits explicitly requested below. No new colors on the figure.
No hats, glasses, earrings, scarves, ribbons, decorative bows or other accessories (the clothing's apron tie bow is required). No objects. No floor, ground, cast shadow, scenery, checkerboard drawn in pixels, grid lines, text, labels or watermark. Transparent pixels everywhere outside the nine figures.
HAIRSTYLE FOR ALL NINE FIGURES: Woman: shoulder-length layered chestnut hair with CURTAIN BANGS parted in the MIDDLE, symmetrical soft face-framing sections separated at center forehead. Hair stops at shoulders, layered soft ends, clearly distinct from long hair and blunt bangs. Back row shows shoulder-length layers and apron bow.

### Attempt 2

Inputs: `/Users/lalaze/.codex/generated_images/01a1a231-d478-76d1-bf96-c34e3e06404e/exec-56c7af98-4fdc-4ffe-a6d4-db738a4bba73.png` (attempt 1, edit target).

Use case: precise-object-edit.
EDIT THE SUPPLIED SINGLE SPRITE SHEET. Preserve the nine characters' hairstyle, chestnut hair color, cream outfit, dark sage apron, brass buttons, peach skin, brown shoes, dark brown outlines, soft rounded pixel-art rendering, head proportions and every accessory constraint. Keep transparent alpha background, no shadow, no matte, no text.
MANDATORY POSE CORRECTIONS:
1. TOP RIGHT body must be a HORIZONTAL MIRROR OF THE TOP MIDDLE BODY POSE, from collar downward only. Thus the large leading shoe moves to viewer LEFT and the forward hand moves to viewer RIGHT. Preserve top-right head and hairstyle unchanged.
2. MIDDLE RIGHT body must be a HORIZONTAL MIRROR OF THE MIDDLE MIDDLE BODY POSE, from collar downward only. Thus the visible forward sole and lifted leg move to the OTHER SIDE, viewer LEFT; forward hand moves to viewer RIGHT. Preserve back-view head/hair and apron crossed straps/back bow. This back-view correction is just as essential as the front-view correction.
3. Bottom row stays strict RIGHT-facing, idle then two walk steps with opposite arm and leg swing. Complete shoes.
Leave the six other frames' poses alone. Do not repeat the same leading foot in columns 2 and 3.
LAYOUT: square 3×3 equal invisible cells. Uniformly fit and center each complete character inside its own cell with at least 20 pixels of transparent margin on all four sides, so no top-row shoes fall below the first row boundary. Same figure scale in every cell and same head-height/shoe-baseline within each row. Preserve generous gutters. Nine complete figures with empty hands, no new elements.
HAIR MUST REMAIN: Woman: shoulder-length layered chestnut hair with CURTAIN BANGS parted in the MIDDLE, symmetrical soft face-framing sections separated at center forehead. Hair stops at shoulders, layered soft ends, clearly distinct from long hair and blunt bangs. Back row shows shoulder-length layers and apron bow.

