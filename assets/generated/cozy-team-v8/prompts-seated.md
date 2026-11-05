# Seated sprite sheet generation prompts

Built-in image_gen; reference: `public/art/generated/cozy-team-v7/seated-a.png`. Each generated original is copied without pixel edits.

Selected originals: attempt 2 for all three sheets. Each is 1086 × 1448 RGBA with actual transparent pixels. Copies verified byte-for-byte against generated originals.

Visual checks: each selected sheet has a 3-column × 4-row layout, twelve complete seated figures and chairs, the requested hairstyle row order, chestnut hair, and the reference's cream/sage/peach/brown/honey-oak/teal palette. Chair placement and scale appear consistent by eye; exact pixel identity and exact palette equality are not guaranteed by generation.

Remaining limitations: seated-c and seated-e retain a shin-level downward reach rather than a fully floor-level hand. Seated-d attempt 2 has the stronger low reach. Slight colored edge speckling remains around some sprites. Afro margins are tighter than the other hairstyles. No pixel edits, resizing, recoloring or cleanup were performed.

## seated-d.png — attempt 2

```text
Use case: precise-object-edit.
Asset type: Tiny Bean Café seated character sprite sheet, transparent PNG.
Input image: the provided seated-a.png is the edit target and exact reference for style, palette, proportions, body, costume, chair, scale, composition and poses.
Create ONE portrait PNG, exactly THREE columns by FOUR rows: twelve complete figures seated on twelve complete chairs. Preserve the reference composition and change ONLY the hairstyles specified per row and the explicitly specified face details. Same chibi storybook rendering as reference, dark-brown outlines, same gentle face and light peach skin. Rich CHESTNUT-BROWN hair throughout, cream rolled-sleeve shirt, dark sage-green bib apron with brass buttons, cream trousers, brown shoes. Same honey-oak wooden café chair and teal cushion. Match reference colors closely; these are used for game recoloring. No new costume colors or accessories.
Strict equally spaced 3 x 4 grid of equal cells. Identical figure scale, chair scale and chair position within every cell. Generous clear transparent outer margins and gutters, no overlap, no cropping. Each row is one hairstyle/person repeated in the three poses; all face right three-quarter.
Column 1: sitting upright, BOTH hands resting on lap.
Column 2: seated, reaching ONE hand forward to the RIGHT at chair-seat height as if petting a cat, other hand on lap.
Column 3: seated, torso and head leaning forward and down to the RIGHT, one hand reaching LOW toward the floor, distinctly lower than column 2, other hand near lap. Keep feet and chair fully visible.
TRUE alpha transparency outside sprites and through chair gaps. No background, no floor, no cast shadows, no grid lines, no text, no labels, no border, no watermark. No cats, hats, glasses, earrings, scarves, ribbons, bows or additional objects. Preserve same person proportions, outfit and chairs across all 12 cells.
Replace the reference hairstyles with these EXACT rows, top to bottom:
Row 1: man, SHORT SIDE-PARTED hair, NEAT SHORT FULL BEARD in the same chestnut color, THICKER EYEBROWS.
Row 2: man, VERY SHORT BUZZ CUT, THICKER EYEBROWS, clean shaven.
Row 3: woman, PIXIE CUT with SOFT SIDE-SWEPT BANGS.
Row 4: woman, TWO ROUND SPACE BUNS ON TOP OF HEAD, one bun on each side; no ties or accessories visible.
Maintain the reference's small dark eyes and gentle smile; only the explicitly requested beard and eyebrows change the face.
Correction for this retry: in COLUMN THREE of all four rows, extend the reaching arm DOWN toward the floor, hand BELOW THE KNEE beside the lower shin/ankle near the FRONT CHAIR FOOT. Torso leans down-right and head lowers. Do not rest the reaching forearm on top of the thigh or stop the hand at knee height. Column 2 still reaches forward right at SEAT height. Keep the row hairstyles, thicker brows only in rows 1-2, chestnut beard only in row 1, palette, outfit, chair, twelve complete sprites, equal 3x4 cell layout and full real alpha transparency exact to reference.
```

## seated-e.png — attempt 2

```text
Use case: precise-object-edit.
Asset type: Tiny Bean Café seated character sprite sheet, transparent PNG.
Input image: the provided seated-a.png is the edit target and exact reference for style, palette, proportions, body, costume, chair, scale, composition and poses.
Create ONE portrait PNG, exactly THREE columns by FOUR rows: twelve complete figures seated on twelve complete chairs. Preserve the reference composition and change ONLY the hairstyles specified per row and the explicitly specified face details. Same chibi storybook rendering as reference, dark-brown outlines, same gentle face and light peach skin. Rich CHESTNUT-BROWN hair throughout, cream rolled-sleeve shirt, dark sage-green bib apron with brass buttons, cream trousers, brown shoes. Same honey-oak wooden café chair and teal cushion. Match reference colors closely; these are used for game recoloring. No new costume colors or accessories.
Strict equally spaced 3 x 4 grid of equal cells. Identical figure scale, chair scale and chair position within every cell. Generous clear transparent outer margins and gutters, no overlap, no cropping. Each row is one hairstyle/person repeated in the three poses; all face right three-quarter.
Column 1: sitting upright, BOTH hands resting on lap.
Column 2: seated, reaching ONE hand forward to the RIGHT at chair-seat height as if petting a cat, other hand on lap.
Column 3: seated, torso and head leaning forward and down to the RIGHT, one hand reaching LOW toward the floor, distinctly lower than column 2, other hand near lap. Keep feet and chair fully visible.
TRUE alpha transparency outside sprites and through chair gaps. No background, no floor, no cast shadows, no grid lines, no text, no labels, no border, no watermark. No cats, hats, glasses, earrings, scarves, ribbons, bows or additional objects. Preserve same person proportions, outfit and chairs across all 12 cells.
Replace the reference hairstyles with these EXACT rows, top to bottom:
Row 1: woman, BIG ROUND VOLUMINOUS CURLY AFRO, chestnut brown.
Row 2: woman, LONG STRAIGHT HAIR with BLUNT BANGS straight across forehead.
Row 3: woman, TWO LOW TWIN TAILS OVER THE SHOULDERS, SIDE BANGS; no visible ties, bows or accessories.
Row 4: woman, SHOULDER-LENGTH LAYERED HAIR with CURTAIN BANGS parted centrally.
Maintain the reference's small dark eyes and gentle smile. Allow enough transparent margin for the afro and long hair without reducing scale or touching another cell.
Correction for this retry: NO VISIBLE HAIR TIES OR COLORED BANDS in row 3. Form the two low tails using only the chestnut hair silhouette, no green bands, no ribbons, no accessory pixels. Keep the afro generously padded from top and sides. In column 3 in EVERY row make the one reaching hand visibly LOW near ankle/floor level, with head and torso leaning down-right, clearly distinct from column 2's seat-height reach. Do not add any floor or shadow. Preserve the reference's style, palette, costume, chair, grid and scale. All twelve figures and chairs must be complete and separate.
```

## seated-c.png — attempt 2

```text
Use case: precise-object-edit.
Asset type: Tiny Bean Café seated character sprite sheet, transparent PNG.
Input image: the provided seated-a.png is the edit target and exact reference for style, palette, proportions, body, costume, chair, scale, composition and poses.
Create ONE portrait PNG, exactly THREE columns by FOUR rows: twelve complete figures seated on twelve complete chairs. Preserve the reference composition and change ONLY the hairstyles specified per row and the explicitly specified face details. Same chibi storybook rendering as reference, dark-brown outlines, same gentle face and light peach skin. Rich CHESTNUT-BROWN hair throughout, cream rolled-sleeve shirt, dark sage-green bib apron with brass buttons, cream trousers, brown shoes. Same honey-oak wooden café chair and teal cushion. Match reference colors closely; these are used for game recoloring. No new costume colors or accessories.
Strict equally spaced 3 x 4 grid of equal cells. Identical figure scale, chair scale and chair position within every cell. Generous clear transparent outer margins and gutters, no overlap, no cropping. Each row is one hairstyle/person repeated in the three poses; all face right three-quarter.
Column 1: sitting upright, BOTH hands resting on lap.
Column 2: seated, reaching ONE hand forward to the RIGHT at chair-seat height as if petting a cat, other hand on lap.
Column 3: seated, torso and head leaning forward and down to the RIGHT, one hand reaching LOW toward the floor, distinctly lower than column 2, other hand near lap. Keep feet and chair fully visible.
TRUE alpha transparency outside sprites and through chair gaps. No background, no floor, no cast shadows, no grid lines, no text, no labels, no border, no watermark. No cats, hats, glasses, earrings, scarves, ribbons, bows or additional objects. Preserve same person proportions, outfit and chairs across all 12 cells.
Replace the reference hairstyles with these EXACT rows, top to bottom:
Row 1: man, neat SHORT CROP with a SMALL SOFT QUIFF.
Row 2: man, SHORT TIGHT CURLS close to the head.
Row 3: man, UNDERCUT with visibly short sides and LONGER TOP SWEPT TO ONE SIDE.
Row 4: man, MEDIUM-LENGTH HAIR COMBED STRAIGHT BACK from forehead.
All four men are clean shaven with the reference's simple face. Clearly distinguish the four hairstyles. Do not retain reference's long feminine hairstyles.
Correction for this retry: Row 1 must be a NEAT CLOSE SHORT CROP, small soft quiff only at the front; no large wavy mop, no shaggy layered fringe. Row 2 must have SMALL tightly coiled curls, a compact close-cropped curly haircut rather than large round ringlets. Keep hairstyles clearly separated in silhouette. In column 3 ensure torso visibly leans down-right and extended hand is low alongside shin, approaching floor. Maintain the exact reference body, chair, palette and layout.
```

## seated-c.png — attempt 1

```text
Use case: precise-object-edit.
Asset type: Tiny Bean Café seated character sprite sheet, transparent PNG.
Input image: the provided seated-a.png is the edit target and exact reference for style, palette, proportions, body, costume, chair, scale, composition and poses.
Create ONE portrait PNG, exactly THREE columns by FOUR rows: twelve complete figures seated on twelve complete chairs. Preserve the reference composition and change ONLY the hairstyles specified per row and the explicitly specified face details. Same chibi storybook rendering as reference, dark-brown outlines, same gentle face and light peach skin. Rich CHESTNUT-BROWN hair throughout, cream rolled-sleeve shirt, dark sage-green bib apron with brass buttons, cream trousers, brown shoes. Same honey-oak wooden café chair and teal cushion. Match reference colors closely; these are used for game recoloring. No new costume colors or accessories.
Strict equally spaced 3 x 4 grid of equal cells. Identical figure scale, chair scale and chair position within every cell. Generous clear transparent outer margins and gutters, no overlap, no cropping. Each row is one hairstyle/person repeated in the three poses; all face right three-quarter.
Column 1: sitting upright, BOTH hands resting on lap.
Column 2: seated, reaching ONE hand forward to the RIGHT at chair-seat height as if petting a cat, other hand on lap.
Column 3: seated, torso and head leaning forward and down to the RIGHT, one hand reaching LOW toward the floor, distinctly lower than column 2, other hand near lap. Keep feet and chair fully visible.
TRUE alpha transparency outside sprites and through chair gaps. No background, no floor, no cast shadows, no grid lines, no text, no labels, no border, no watermark. No cats, hats, glasses, earrings, scarves, ribbons, bows or additional objects. Preserve same person proportions, outfit and chairs across all 12 cells.
Replace the reference hairstyles with these EXACT rows, top to bottom:
Row 1: man, neat SHORT CROP with a SMALL SOFT QUIFF.
Row 2: man, SHORT TIGHT CURLS close to the head.
Row 3: man, UNDERCUT with visibly short sides and LONGER TOP SWEPT TO ONE SIDE.
Row 4: man, MEDIUM-LENGTH HAIR COMBED STRAIGHT BACK from forehead.
All four men are clean shaven with the reference's simple face. Clearly distinguish the four hairstyles. Do not retain reference's long feminine hairstyles.
```

## seated-d.png — attempt 1

```text
Use case: precise-object-edit.
Asset type: Tiny Bean Café seated character sprite sheet, transparent PNG.
Input image: the provided seated-a.png is the edit target and exact reference for style, palette, proportions, body, costume, chair, scale, composition and poses.
Create ONE portrait PNG, exactly THREE columns by FOUR rows: twelve complete figures seated on twelve complete chairs. Preserve the reference composition and change ONLY the hairstyles specified per row and the explicitly specified face details. Same chibi storybook rendering as reference, dark-brown outlines, same gentle face and light peach skin. Rich CHESTNUT-BROWN hair throughout, cream rolled-sleeve shirt, dark sage-green bib apron with brass buttons, cream trousers, brown shoes. Same honey-oak wooden café chair and teal cushion. Match reference colors closely; these are used for game recoloring. No new costume colors or accessories.
Strict equally spaced 3 x 4 grid of equal cells. Identical figure scale, chair scale and chair position within every cell. Generous clear transparent outer margins and gutters, no overlap, no cropping. Each row is one hairstyle/person repeated in the three poses; all face right three-quarter.
Column 1: sitting upright, BOTH hands resting on lap.
Column 2: seated, reaching ONE hand forward to the RIGHT at chair-seat height as if petting a cat, other hand on lap.
Column 3: seated, torso and head leaning forward and down to the RIGHT, one hand reaching LOW toward the floor, distinctly lower than column 2, other hand near lap. Keep feet and chair fully visible.
TRUE alpha transparency outside sprites and through chair gaps. No background, no floor, no cast shadows, no grid lines, no text, no labels, no border, no watermark. No cats, hats, glasses, earrings, scarves, ribbons, bows or additional objects. Preserve same person proportions, outfit and chairs across all 12 cells.
Replace the reference hairstyles with these EXACT rows, top to bottom:
Row 1: man, SHORT SIDE-PARTED hair, NEAT SHORT FULL BEARD in the same chestnut color, THICKER EYEBROWS.
Row 2: man, VERY SHORT BUZZ CUT, THICKER EYEBROWS, clean shaven.
Row 3: woman, PIXIE CUT with SOFT SIDE-SWEPT BANGS.
Row 4: woman, TWO ROUND SPACE BUNS ON TOP OF HEAD, one bun on each side; no ties or accessories visible.
Maintain the reference's small dark eyes and gentle smile; only the explicitly requested beard and eyebrows change the face.
```

## seated-e.png — attempt 1

```text
Use case: precise-object-edit.
Asset type: Tiny Bean Café seated character sprite sheet, transparent PNG.
Input image: the provided seated-a.png is the edit target and exact reference for style, palette, proportions, body, costume, chair, scale, composition and poses.
Create ONE portrait PNG, exactly THREE columns by FOUR rows: twelve complete figures seated on twelve complete chairs. Preserve the reference composition and change ONLY the hairstyles specified per row and the explicitly specified face details. Same chibi storybook rendering as reference, dark-brown outlines, same gentle face and light peach skin. Rich CHESTNUT-BROWN hair throughout, cream rolled-sleeve shirt, dark sage-green bib apron with brass buttons, cream trousers, brown shoes. Same honey-oak wooden café chair and teal cushion. Match reference colors closely; these are used for game recoloring. No new costume colors or accessories.
Strict equally spaced 3 x 4 grid of equal cells. Identical figure scale, chair scale and chair position within every cell. Generous clear transparent outer margins and gutters, no overlap, no cropping. Each row is one hairstyle/person repeated in the three poses; all face right three-quarter.
Column 1: sitting upright, BOTH hands resting on lap.
Column 2: seated, reaching ONE hand forward to the RIGHT at chair-seat height as if petting a cat, other hand on lap.
Column 3: seated, torso and head leaning forward and down to the RIGHT, one hand reaching LOW toward the floor, distinctly lower than column 2, other hand near lap. Keep feet and chair fully visible.
TRUE alpha transparency outside sprites and through chair gaps. No background, no floor, no cast shadows, no grid lines, no text, no labels, no border, no watermark. No cats, hats, glasses, earrings, scarves, ribbons, bows or additional objects. Preserve same person proportions, outfit and chairs across all 12 cells.
Replace the reference hairstyles with these EXACT rows, top to bottom:
Row 1: woman, BIG ROUND VOLUMINOUS CURLY AFRO, chestnut brown.
Row 2: woman, LONG STRAIGHT HAIR with BLUNT BANGS straight across forehead.
Row 3: woman, TWO LOW TWIN TAILS OVER THE SHOULDERS, SIDE BANGS; no visible ties, bows or accessories.
Row 4: woman, SHOULDER-LENGTH LAYERED HAIR with CURTAIN BANGS parted centrally.
Maintain the reference's small dark eyes and gentle smile. Allow enough transparent margin for the afro and long hair without reducing scale or touching another cell.
```

