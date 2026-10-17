# Image-generation specifications

Tool: built-in `image_gen`, four calls; no API/CLI generation fallback. Original
output IDs and bytes are retained in `sources/` and identified by `hashes.json`.
The following records the final production prompt set's constraints; the complete
conversational phrasing is also retained in this task's image-generation calls.

## Shared reference and rendering instructions

Use the visible cozy-team-v7 short-haired staff sprite sheet as the PRIMARY
character-style reference: big rounded chibi head, squat rounded limbs, warm brown
soft one-pixel-style outlines, upper-left light and calm flat shading. Use the
visible cafe-style-sample-v1 café scene as supporting palette/seated-pose reference.
Simple clear colour clusters, no black outlines, no noisy texture. Solid flat
magenta `#ff00ff` removable background; no text, dividers, borders or external
shadows. Production animation assets, not a poster.

## 1. `sources/bodies-a.png`

1536×1024, twelve columns and four rows, nominal cells 128×256. BODY PARTS ONLY:
no heads, hair, faces or hats; just peach neck stumps. Torso and legs together
about 1.5 head heights, broad short torso, short chunky arms and rounded legs.
Blue garments, purple trousers, peach skin, cream accents, brown shoes; identical
material channels across all outfits/poses. Four rows: open buttoned cardigan over
cream shirt; horizontally striped sweater; bib overalls over cream short sleeves;
sweater with large cream scarf.

Each row's twelve columns: front neutral, front left step, front right step;
rear neutral, rear left step, rear right step; right profile neutral, right left
step, right right step; right-facing seated hands reaching the tabletop; seated
petting down-forward; seated petting slightly further down-forward. Seated thighs
horizontal, shins down. No chair/table/cup/cat. Keep each figure within its cell,
consistent neck/foot levels, all 48 cells populated.

## 2. `sources/bodies-b.png`

Same style, materials, dimensions, headless proportions and twelve-column pose
order as sheet A. Four outfit rows: short casual jacket over cream shirt; buttoned
vest over cream shirt; knee-length flared dress with cream collar/purple leggings;
hoodie with hood resting on shoulders and cream drawstrings. Broad squat rounded
staff-like proportions, never tall narrow humans. All 48 cells populated, isolated
on solid magenta, generous space above the neck for head assembly.

## 3. `sources/bodies-c.png`

Same style, materials, dimensions and complete pose order as sheets A/B. Four rows:
sailor shirt with wide cream collar/neckerchief; duffle coat with large cream toggle
closures and patch pockets; cream shirt with blue waist apron; plain blue sweater.
The apron/sweater preserve completeness of the historical twelve-family pack.
Standing shoes near cell y232, neck near y95; seated hips around x56/y195, neck
near y125. No heads/faces/hair, no chair/table/cat/cup, no figure crosses a cell.

## 4. `sources/heads.png`

1024×1536, three columns/eight rows of modular HEADS ONLY with small neck stumps.
Columns: front, back, right profile. Rows: short fluffy crop; high round bun with
swept bangs; long loose hair just below chin; round chin-length bob with bangs;
high ponytail; neat short side part; twin braids; long soft waves framing face.
All medium warm-brown hair, peach skin and warm-brown outlines. Large round chibi
heads like the staff, simple dark oval eyes with tiny upper-left cream highlight,
tiny curved mouth, subtle cheek blush. Calm broad hair highlights, no noisy strands.
No glasses/accessories/body/clothes. Consistent skull/face positions, one visible
eye in profile, no overlapping sprites. Solid magenta background, no labels/grid.
Keep important features clear when conformed to roughly thirty art pixels per head.
