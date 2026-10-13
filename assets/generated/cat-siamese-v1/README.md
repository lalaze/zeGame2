# Mocha / Siamese — 14 action asset set

## Verified production contract
Read sprites.ts CAT_BASE/CAT_COATS/catFrames, pets.ts catalog and living-cat tests. Existing normal 11frames are 18x14, raised lookUp/nuzzle2 are18x18. Original ground rows13/17, original forehead(6,3) is legacy-only. Walk faces head-left and uses walking-specific flip convention. Verified actual Siamese in mina-pet-a-contact-fixed.jpg, not the older ginger response screenshot.

## Identity
Cream beige short-haired body, dark taupe-chocolate mask/ears/tail/legs, blue eyes, cream muzzle/chest/paw tips. One breed only, no collar or striped/longhair substitutions. Original 12-breed runtime identities remain distinct; this asset batch covers only siamese.

## Files and QA
Four source sheets and 14 independent lossless PNG crops. renderer-manifest.json gives bbox alpha>128, foot and headContact points in each PNG, suggested sheet-level scale and provenance. No pixel content edited programmatically. Built-in imagegen authored all changes including the correction to raise nuzzle chests. Source/selected cropped figures visually inspected for complete silhouette, proper limbs, transparent background and distinct action silhouettes. Sleeping cat is curled; two gait phases differ; grooming paw is chest vs cheek; nuzzles tilt separately. No player hand/status, food, UI effects or labels embedded.

Foot is grounded paw support midpoint and headContact is forehead/crown between ears, never ear-tip. These are manually inspected estimates, require real petting contact/flip test. Alpha>128 boxes intentionally omit faint fringe and are not all-nonzero-alpha boxes. Actual source alpha retained, no matte cleanup.

## Scale and integration limits
Generated sheets differ in pixel magnification. One scale per source sheet aligns the approximate physical head size; do not normalize every action to the same height. Core0.03275, behavior0.02948, interaction0.02721, raisednuzzle0.0188. These are starting estimates, not runtime-validated final constants. Raised poses remain naturally taller than idle; their exact pixel heights differ from legacy18x18 and should use metadata contacts rather than legacy fixed offsets. Preserve full stretches/tails and avoid squeezing into an18x14 rectangle. Test route walking flip, all14state mappings, reduced motion, raised head-to-hand interaction, gait transitions, depth and alpha at actual scale before claiming completion.

## Exact prompts
Create a FOUR-pose canonical sprite sheet for MOCHA, the existing SIAMESE café cat in screenshot reference1. Reference1 is identity only (cream body/dark mask/blue eyes), reference2 supplies the approved fine cozy pixel-art craft, not its ginger cat color.
One single consistent small short-haired Siamese: warm cream/beige coat #e4cfaa with pale highlights #f9e4bf, dark chocolate-taupe ears and face mask #675047, clear bright blue eyes #68bde7, pale creamy muzzle/chest/front paws #f5e4ca, brown-shaded haunches and curled dark tail. Rounded cheek/head and compact haunch, NOT a fluffy ragdoll, NOT ginger, no stripes, no collar. Match the original friendly chibi body proportions and dark mask identity. Render fine crisp pixel clusters, subtle fur texture, dark brown outline, warm upper-left light, fixed elevated front/side game view, not smooth 3D.
1536x1024 transparent canvas, exactly 2 columns by2 rows, each cell768x512, independent complete cats with generous transparent gaps and margins, SAME physical head/body scale in all poses.
TOP LEFT idle: compact cat sitting front-three-quarter, face slightly LEFT, two separate grounded front paws, tail curled toward RIGHT.
TOP RIGHT lookUp: SAME cat sitting upright with chest raised (about25percent taller), head tilted gently UP toward an imagined petting hand, broad shoulders immediately below jaw, two separate forelegs and paws on same baseline; do not lengthen neck, no human hand.
BOTTOM LEFT walkA: cat on ALL FOUR legs walking LEFT, head at LEFT, body horizontal extending RIGHT, dark tail at RIGHT. Left-front and right-hind paws forward, other pair back, recognizable distinct stride.
BOTTOM RIGHT walkB: same head-left cat opposite step phase, feet visibly in different positions from walkA. Physical head size unchanged, body same length, not another cat or mirrored direction.
Every pose shows one head, two ears, four anatomically correct limbs (rear limbs partly occluded sitting), one complete tail; no extra paws. NO labels,text,props,floor,shadows,glows,scene or hands. Actual transparent alpha outside silhouettes.

Create SIX new action sprites of the EXACT SAME Siamese cat in reference. Strict identity: cream beige short fur, dark taupe brown mask/ears/tail/legs, cream paw tips and chest, blue eyes, compact friendly proportions. Preserve fine cozy pixel clusters, dark outline, warm upper-left light and elevated near-front camera. Do not change breed, markings, head size or physical body scale.
1536x1024 transparent canvas, exact3columns×2rows, 512x512 cells, complete isolated cats, transparent gutters. Head physical scale identical for all cats, body action changes only.
TOP LEFT swish: same seated idle facing slightly left, tail curls broadly to the RIGHT but tip swings farther outward/lower than reference.
TOP MIDDLE blink: same seated idle, BOTH eyes closed in gentle narrow eyelid arcs, mouth neutral, tail matching idle.
TOP RIGHT happy: same seated idle, eyes closed joyfully, soft smiling open mouth and relaxed cheeks, distinct from neutral blink.
BOTTOM LEFT sleep: cat curled asleep with head low tucked against front paws, eyes closed, body in compact oval, dark tail wraps around cream body. Not seated.
BOTTOM MIDDLE groomA: seated cat raises its near front paw to CHEST height, turns muzzle down toward it, tongue touches paw, eyes half closed. Other front paw remains planted, natural joints.
BOTTOM RIGHT groomB: same grooming seated cat lifts that same paw to CHEEK height and rubs cheek, head leans slightly into paw, clearly different silhouette from groomA. Other paw still planted.
No extra limbs, no objects, no floor, no shadows, no humans, no collar, no text/labels/grid. Real transparent alpha outside silhouettes. Don't replace action changes with identical poses. Keep warm fine 2D pixel art, not smooth 3D.

Create FOUR final behavior sprites of the EXACT same cream-and-chocolate shorthaired Siamese cat in reference. Preserve blue eyes, brown face mask/ears/tail/lower legs, pale muzzle/chest/paw tips, compact body and rounded expressive cheeks. Match fine crisp warm 2D pixel clusters, dark contour, upper-left warm light, elevated near-front view. One stable identity, no fluffy fur/collar/stripes.
1536x1024 transparent canvas, 2x2 cells, full complete cats with generous transparent gutters. SAME head and body physical scale across all four.
TOP LEFT stretch: cat facing LEFT on all fours, front legs reach far forward-left, chest lowers close to floor, hindquarters raised on rear legs, tail curves right/up. Real feline forward stretch, not lying down. Eyes gently closed, no extra limbs.
TOP RIGHT watch: compact seated cat facing slightly LEFT like reference idle, alert BLUE eyes look a little farther left, ears perked, head turned subtly to attention, tail curled right.
BOTTOM LEFT nuzzleA: same cat in reference's taller raised-chest sitting posture, two front paws grounded, head tilted up-left, eyes affectionately closed, forehead lifted for an imagined hand. Broad chest, no stretched neck. NO human hand.
BOTTOM RIGHT nuzzleB: same grounded tall sitting posture and identical body size, head gently tilts/leans a little toward right as if rubbing forehead into an imagined hand, eyes closed, visibly different head angle from nuzzleA. Paws and haunch stay on same baseline; no standing on hind legs.
No text/labels/props/humans/floor/shadows/glow, real transparent alpha outside silhouettes. Four complete anatomically correct single cats, each with one head and one tail.

Correct only the TWO bottom-row nuzzling cats from this reference into a new TWO-SPRITE sheet. Keep their exact Siamese identity, head sizes, face masks, ears, closed happy eyes, head tilt A vs B, pixel style and grounded paw shapes. Exclude stretch/watch cats entirely.
1536x1024 transparent canvas, two complete cats side by side. Raise their CHESTS and shoulders by 22 percent compared to current nuzzling poses while keeping head size unchanged: physically taller upright seated petting posture like a cat sitting up attentively. The chest broadens just below jaw and front legs extend naturally down to two separate grounded paws; NEVER lengthen the neck or make a giraffe. Keep haunch on floor, not standing on hind legs. Aim complete cat height about550px with head including ears about260px wide; this preserves head scale and gives raised body. Same scale in both images and equal paw baseline at y850.
Left nuzzleA forehead tilts up-left, eyes closed; right nuzzleB forehead softly tilts toward right, eyes closed. Both heads move subtly, same body height and paw contacts. Complete tails curl right, all anatomy correct. Transparent margins at least80px, no human hand, no objects, no floor/shadows/glow/text. Fine crisp cozy pixel clusters, cream body, dark mask and tail, cream paws.

