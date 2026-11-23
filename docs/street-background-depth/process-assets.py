"""Extract only approved scenery; never touch storefronts or reference inputs.

Run with Pillow: uv run --with pillow python docs/street-background-depth/process-assets.py
Native pixels use the reference's 2:1 grid, then CSS renders them at 2x/3x.
Masks are binary and deterministic; no blur, random texture or feathered matte.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/generated/street-art-v2/source/approved-street-scenery-v4.png'
OUT = ROOT / 'public/art/street-art-v2'
ref = Image.open(SOURCE).convert('RGBA')
records = {}


def extract(box, keep):
    im = ref.crop(box).resize(((box[2]-box[0])//2, (box[3]-box[1])//2), Image.Resampling.NEAREST)
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, _ = im.getpixel((x, y))
            if not keep(r, g, b, x, y):
                im.putpixel((x, y), (0, 0, 0, 0))
    return im


def largest(im):
    """Discard disconnected mask flecks, preserving holes between branches."""
    remaining = {(x, y) for y in range(im.height) for x in range(im.width) if im.getpixel((x, y))[3]}
    components = []
    while remaining:
        component = {remaining.pop()}
        queue = list(component)
        while queue:
            x, y = queue.pop()
            for p in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if p in remaining:
                    remaining.remove(p)
                    component.add(p)
                    queue.append(p)
        components.append(component)
    kept = max(components, key=len)
    for component in components:
        if component is not kept:
            for p in component:
                im.putpixel(p, (0, 0, 0, 0))
    return im


def save(name, im, crops):
    im.save(OUT / f'{name}.png', optimize=True)
    records[name] = {'size': im.size, 'sourceCrops': crops, 'sha256': hashlib.sha256((OUT/f'{name}.png').read_bytes()).hexdigest()}


# Town silhouette ends at the house foundations, before the rectangular meadow.
town_box = (674, 274, 804, 350)
town = largest(extract(town_box, lambda r,g,b,x,y: not (b > r+20 and b >= g)))
save('depth-town', town, [town_box])

hamlet_box = (1120, 320, 1236, 352)
hamlet = largest(extract(hamlet_box, lambda r,g,b,x,y: not (b > r+20 and b >= g) and (r > g-5 or r < 148)))
save('depth-hamlet', hamlet, [hamlet_box])

cloud_box = (608,160,724,200)
cloud = largest(extract(cloud_box, lambda r,g,b,x,y: r > 205 and g > 205 and r > b-18))
save('depth-cloud-small', cloud, [cloud_box])

# A shallow, stepped continuation of the approved meadow seats each distant town.
# Only its occluded contour is reconstructed; colour is sampled from the reference.
# Its lower edge matches the existing hill extension, so overlapping mounds have no
# rectangular join. No texture/noise is synthesised.
field = Image.new('RGBA', (164, 148))
ImageDraw.Draw(field).polygon([(0,39),(12,33),(23,24),(30,17),(42,13),(106,13),(118,18),(132,26),(148,33),(163,36),(163,148),(0,148)], fill=ref.getpixel((697,365)))
save('depth-field', field, [])

# The complete central tree is visible between two shops. Material masking removes
# the blue hillside AND the pale houses visible through its branches.
tree_box = (672, 410, 806, 594)
tree = largest(extract(tree_box, lambda r,g,b,x,y: (b < g*.69 and g > r*.70) or (r > g*1.22 and r > b*1.8 and b < 95 and y > 40)))
# The reference shops occlude the outermost leaf tips. Trim only those cut edges
# into hard, stepped leaf contours; never leave the source crop's vertical sides.
edge = Image.new('1', tree.size)
ImageDraw.Draw(edge).polygon([(8,0),(59,0),(59,24),(64,24),(64,28),(61,28),(61,32),(63,32),(63,36),(61,36),(61,40),(65,40),(65,44),(63,44),(63,48),(60,48),(60,52),(57,52),(57,92),(8,92),(8,58),(4,58),(4,54),(2,54),(2,51),(5,51),(5,48),(2,48),(2,44),(4,44),(4,40),(7,40),(7,36),(3,36),(3,32),(6,32),(6,28),(8,28)], fill=1)
for y in range(tree.height):
    for x in range(tree.width):
        if not edge.getpixel((x,y)):
            tree.putpixel((x,y),(0,0,0,0))
# A modest atmospheric veil uses the reference's meadow colour, keeping this behind
# the richly coloured storefronts. Alpha remains either 0 or 255.
for y in range(tree.height):
    for x in range(tree.width):
        r,g,b,a = tree.getpixel((x,y))
        if a:
            tree.putpixel((x,y), (round(r*.78+154*.22),round(g*.78+181*.22),round(b*.78+141*.22),255))
save('depth-tree', tree, [tree_box])

# Three different distant canopies form a small hedge, all from the same reference.
# Each canopy's edge is isolated BEFORE composition, so no blue rectangles survive.
hedge = Image.new('RGBA', (54, 19))
boxes = [(6,332,38,358),(68,324,102,356),(344,320,376,350)]
for box, x, y in zip(boxes, [0,15,35], [5,2,1]):
    canopy = largest(extract(box, lambda r,g,b,x,y: g > r+6 and g > b+5))
    hedge.alpha_composite(canopy, (x,y))
save('depth-hedge', hedge, boxes)

(ROOT/'docs/street-background-depth/assets.json').write_text(json.dumps({'source': str(SOURCE.relative_to(ROOT)), 'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'assets': records}, indent=2)+'\n')
# QA contact sheet on the actual sky colour, enlarged with nearest neighbour only.
sheet = Image.new('RGBA', (240,160), '#a3d3fa')
for name, xy in [('depth-field',(40,12)),('depth-town',(74,0)),('depth-tree',(4,64)),('depth-hedge',(160,32)),('depth-hamlet',(158,5))]:
    sheet.alpha_composite(Image.open(OUT/f'{name}.png'),xy)
sheet.resize((960,640), Image.Resampling.NEAREST).save(ROOT/'docs/street-background-depth/asset-contact-sheet.png')
