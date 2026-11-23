"""Reproducible approved-image extraction. Run: uv run --with pillow python docs/street-art-v2/process-assets.py
All coordinates refer to the supplied original PNG; logical pixels render at exactly 2x.
No storefront/window/person is baked into the scenery layers.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'assets/generated/street-art-v2/source'
OUT=ROOT/'public/art/street-art-v2'
OUT.mkdir(parents=True,exist_ok=True)
N=Image.Resampling.NEAREST
spec=[('01-cafe','cafe',.463,.72),('02-vacant-brick','vacant-brick',.453,.50),('03-bookshop','bookshop',.484,.82),('04-plant-shop','plant-shop',.348,.51),('05-florist','florist',.471,.47),('06-pottery','pottery',.476,.79),('07-tea-shop','tea-shop',.46,.78),('08-vacant-blue','vacant-blue',.453,.23)]
meta={}
for name,key,sign,door in spec:
 im=Image.open(SRC/'storefronts'/f'{name}.png').convert('RGBA');box=im.getbbox();im=im.crop(box)
 # Every source uses the same ~3 source pixels per logical pixel, never stretch to a slot.
 size=(round(im.width/3),round(im.height/3));im=im.resize(size,N)
 im.save(OUT/f'{key}.png',optimize=True)
 meta[key]={'width':size[0]*2,'height':size[1]*2,'signY':round(size[1]*sign)*2,'doorX':round(size[0]*door)*2,'sourceCrop':box}
ref=Image.open(SRC/'approved-street-scenery-v4.png').convert('RGBA')
def save_crop(name,box,mask=None):
 im=ref.crop(box).resize(((box[2]-box[0])//2,(box[3]-box[1])//2),N)
 if mask:
  p=im.load()
  for y in range(im.height):
   for x in range(im.width):
    if not mask(*p[x,y][:3]):p[x,y]=(0,0,0,0)
 im.save(OUT/f'{name}.png',optimize=True)
# Only cream cloud pixels, no rectangular sky surround.
save_crop('cloud',(104,82,342,160),lambda r,g,b:r>205 and g>205 and r>b-18)
# Distant clock-tower cluster between the foreground shops, cropped before the bookshop roof.
save_crop('town',(674,274,804,356))
# Keep only the remote town/trees (not sky/blue hill) for transparent layering.
im=Image.open(OUT/'town.png');p=im.load()
for y in range(im.height):
 for x in range(im.width):
  r,g,b,a=p[x,y]
  if b>r+20 and b>=g:p[x,y]=(0,0,0,0)
im.save(OUT/'town.png',optimize=True)
# Trace the original clean hill/sky boundary at 1/2 resolution; fill occluded lower
# portions with the exact hill colour sampled at (540,280), then add a softer near hill.
hill=Image.new('RGBA',(768,120));d=ImageDraw.Draw(hill)
points=[(0,41),(22,34),(47,40),(83,48),(110,40),(136,30),(169,36),(196,26),(226,22),(246,16),(265,11),(279,11),(300,18),(322,26),(351,38),(384,32),(411,36),(435,25),(459,16),(485,14),(510,23),(540,37),(567,34),(592,25),(618,36),(644,31),(669,24),(697,35),(722,40),(745,35),(768,40)]
d.polygon(points+[(768,120),(0,120)],fill=ref.getpixel((540,280)))
d.polygon([(0,99),(60,88),(119,93),(180,77),(234,90),(298,73),(364,95),(423,81),(485,89),(552,71),(616,82),(690,76),(768,94),(768,120),(0,120)],fill=ref.getpixel((697,365)))
hill.save(OUT/'hills.png',optimize=True)
# Long-brick road: a clean brick face sampled below ALL reference pedestrians.
# Rebuild only tile joins/staggering with sampled mortar and hard edge colours.
brick=ref.crop((340,866,476,894)).resize((68,14),N)
tile=Image.new('RGBA',(144,32),ref.getpixel((480,893)));d=ImageDraw.Draw(tile)
for row in range(2):
 for x in range(-72,216,72):
  xx=x+(36 if row else 0);tile.paste(brick,(xx+2,row*16+1));d.line((xx+2,row*16+1,xx+68,row*16+1),fill=ref.getpixel((347,865)),width=1)
tile.save(OUT/'paving.png',optimize=True)
# Unobstructed stepped curb (right of bench/people); periodic strip, no feet/shadows.
save_crop('curb',(360,714,648,774))
# Sparse furnishings cut out using material colours, not rectangular background crops.
save_crop('bench',(688,650,796,712),lambda r,g,b:(r<110 and g<100 and b<90) or (r>100 and r>g*1.25 and g>b*1.3))
save_crop('lamp',(1114,500,1158,724),lambda r,g,b:(r<95 and g<95 and b<90) or (r>200 and g>160 and b<155))
# Contact shadows are small coarse, hard-edged transparent pixels.
shadow=Image.new('RGBA',(136,9));ImageDraw.Draw(shadow).polygon([(0,0),(121,0),(136,7),(15,7)],fill=(62,51,43,55));shadow.save(OUT/'shadow.png')
(OUT/'anchors.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps(meta,indent=2))
# Remove isolated colour fragments from extraction, preserving the approved silhouettes.
# Cloud's lower edge follows the continuous cream/lavender band, not JPEG-like blue flecks.
im=Image.open(OUT/'cloud.png').convert('RGBA');p=im.load()
for x in range(im.width):
 ys=[y for y in range(im.height) if p[x,y][3] and p[x,y][0]>230 and p[x,y][1]>222]
 if not ys:continue
 lo,hi=min(ys),max(ys)
 # A continuous hard cloud underside; sample its neutral shadow from the reference.
 for y in range(lo,hi+1):
  if not p[x,y][3]:p[x,y]=(226,229,237,255)
 for y in range(hi+1,im.height):p[x,y]=(0,0,0,0)
im.save(OUT/'cloud.png',optimize=True)
# Original lamp is narrow below the lantern. Discard the planted wall behind it.
im=Image.open(OUT/'lamp.png').convert('RGBA');p=im.load()
for y in range(im.height):
 for x in range(im.width):
  if y>31 and y<92 and not 8<=x<=13:p[x,y]=(0,0,0,0)
  if y>=92 and not 3<=x<=17:p[x,y]=(0,0,0,0)
im.save(OUT/'lamp.png',optimize=True)
# Furniture uses the same logical pixel grid as the storefronts at runtime.
for key,size in [('bench',(24,14)),('lamp',(15,75))]:
 im=Image.open(OUT/f'{key}.png');im.resize(size,N).save(OUT/f'{key}.png',optimize=True)
provenance={
 'referenceSha256':hashlib.sha256((SRC/'approved-street-scenery-v4.png').read_bytes()).hexdigest(),
 'storefrontZipSha256':'70dc9fdd663d39f5c80727029a2a098b8b054aab130d254432cb02f4a4c86ff6',
 'storefrontSources':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((SRC/'storefronts').glob('0*.png'))},
 'pngs':{p.name:{'size':Image.open(p).size,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(OUT.glob('*.png'))},
 'coordinates':'source PNG coordinates; storefront alpha bbox reduced 3:1 nearest, runtime desktop 3x / mobile 2x',
 'sceneryCrops':{'cloud':[104,82,342,160],'town':[674,274,804,356],'brickFace':[340,866,476,894],'curb':[360,714,648,774],'bench':[688,650,796,712],'lamp':[1114,500,1158,724]}}
(ROOT/'docs/street-art-v2/provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
