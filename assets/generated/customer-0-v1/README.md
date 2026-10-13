# Mina / customer cast 0 — 15-frame minimum set

Identity matches CUSTOMER_CAST[0]: short dark-brown hair, light skin, terracotta cardigan over cream shirt, brown trousers, round glasses, muted gold buttons. AppearanceId 0 only. No universal cast replacement.

## Files
- Nine walk/stand PNGs: mina-{down,up,right}-{stand,stepA,stepB}.png. stepA=stride, stepB=passing-knee. Walking left can mirror right.
- Six seated PNGs: mina-{right,left}-{sit,sitPetA,sitPetB}.png. Hip remains seated, petting hand reaches down with two distinct elbow/torso positions. No chair, cup, food, book or pet embedded.
- renderer-manifest.json: per-file bbox, foot, optional seatContact and petContact, source crop, shared per-group scale.

## Validation and limits
Source-sheet and individual seated crops visually inspected: same identity, glasses/clothing consistent; complete heads/feet/hands, real transparency, 10px crop padding, no props welded into sprite. All bbox values use alpha > 128, intentionally exclude faint peripheral edge alpha and are not all-nonzero-alpha bboxes. Crops retain source RGBA, no programmatic recoloring or matte edits.

Walk source and seated source have different physical pixel scale. Approximate seated scale 0.0526 aligns ~210px seated heads with ~150px walking heads (standing world height 28). Use this shared seated scale across six frames; do NOT normalize each seated body to same height, because leaning is intentional. Body height itself is not a correct proxy for matching head size. Runtime visual check must refine this estimate if needed.

Seated foot anchors manually mark shoe baseline center; seatContact marks rear hip/chair contact in source, petContact marks reaching fingertip. These are measured visual estimates for runtime calibration, not pixel-perfect validated collision contacts. Preserve seatContact world position across idle/pet frames instead of centering by the reaching-hand bbox. Actual pets may require hand alignment offsets. Poses are three-quarter seated view, not strict orthographic profile, consistent with selected illustrative pixel style.

This is an authored minimal frame candidate set, not proof animation/collision/occlusion is correct in-game. Confirm gait timing and anchor jitter, seat placement, arm continuity, pet contact and identity in runtime. No repo edits by this worker.

## Exact built-in imagegen prompts
Edit this 9-frame cafe owner sheet into the ONE canonical CUSTOMER identity Mina, the morning-reading regular, appearanceId 0. Preserve the exact fine warm 2D pixel-art craftsmanship, head/body proportion, short dark-brown hairstyle, light skin, three directions and all distinct poses. NOT a barista now.
Mina in EVERY frame: youthful adult with short softly tousled DARK BROWN hair (#594237), warm light skin (#f4cfad), clearly visible round dark-brown framed eyeglasses, a TERRACOTTA RED CARDIGAN (#bb6b58) worn open over a CREAM shirt, small muted gold buttons (#d6b66d), warm BROWN trousers (#85664f), brown shoes. No apron, no apron straps, no apron bow, no bun, no hat. Glasses visible front/side; back view has just subtle temples around ears. Cardigan back has plain knitted hem.
Keep exact nine-pose layout: top row DOWN/front stand, wide stride, passing-knee pose; middle row UP/back stand, stride, passing-knee; bottom row RIGHT profile stand, wide stride, passing-knee. A single consistent person and outfit throughout, same height and same head size; distinct stepA/stepB silhouettes. Walking arms naturally swing without objects.
No cups, food, books, bags, chairs, animals or props anywhere. No text, labels, grid, floor, environment or shadows. Transparent alpha zero outside every complete sprite. Maintain separated sprites with generous gutters and full feet. Fine crisp pixel clusters and dark contours, never smooth 3D or lowpoly.

Create six seated-interaction frames of EXACTLY Mina, the glasses-wearing customer in the attached reference. Preserve short tousled dark brown hair, round dark brown eyeglasses, light skin, terracotta open cardigan with tiny muted-gold buttons, cream collared shirt, brown trousers and shoes. Same head/body proportions, fine pixel-cluster rendering, warm upper-left light. No apron. All frames same identity and body scale.
1536x1024 transparent canvas, exact 3 columns by 2 rows. Each character fully isolated with generous blank margins, complete feet and hands. No chair, no table, no pet, no food, no cup, no book: only the seated human body.
TOP ROW faces RIGHT throughout, bottom row faces LEFT throughout.
COLUMN 1: normal seated idle, torso upright, thighs horizontal, knees bent 90 degrees, lower legs down, hands relaxed on lap. Feet and hips maintain fixed seat geometry across that row.
COLUMN 2: same seated character leaning forward slightly and gently reaching one arm DOWN beside the knee toward a pet on the floor. The reaching arm extends diagonally down beyond knee height, open gentle hand near the ankle level, other hand rests on thigh. Hips remain in seated location. Clear natural elbow and shoulder, exactly two arms.
COLUMN 3: same seated petting interaction, head and torso lean a little farther down, reaching hand a little lower and farther forward, different elbow angle. This is a second subtle petting frame; preserve fixed hip/feet position, don't stand up, don't change clothes or body size.
Top row gestures extend down-right; bottom row gestures extend down-left. Each row's hip seat-contact and shoe baseline aligned in its cells. Head size identical in all six even when leaning. No baked-in furniture or animals. Crisp detailed warm 2D pixel art, not smooth 3D/no lowpoly. Real transparent alpha outside hard silhouettes, no halos or shadows, no grid lines, no text.

