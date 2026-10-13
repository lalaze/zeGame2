from PIL import Image
from pathlib import Path
import json
root=Path(__file__).parent
specs={'pastry-production-sheet.png':[('empty-pastry-cabinet',(200,0,1300,650)),('croissant',(240,670,750,1000)),('strawberry-cake',(880,650,1280,1000))], 'seating-production-sheet.png':[('table-no-vase',(140,0,760,480)),('flower-vase',(930,150,1240,460)),('chair-facing-right',(220,470,650,1010)),('chair-facing-left',(900,470,1330,1010))]}
out=[]
for src,items in specs.items():
 im=Image.open(root/src)
 for name,region in items:
  patch=im.crop(region);mask=patch.getchannel('A').point(lambda a:255 if a>128 else 0);b=mask.getbbox();p=12;box=(max(0,region[0]+b[0]-p),max(0,region[1]+b[1]-p),min(im.width,region[0]+b[2]+p),min(im.height,region[1]+b[3]+p));asset=im.crop(box);asset.save(root/(name+'.png'));a=asset.getchannel('A');h=a.histogram();bbox=a.point(lambda v:255 if v>128 else 0).getbbox();out.append({'name':name,'file':name+'.png','source':src,'source_crop':box,'size':asset.size,'visible_alpha_bbox':bbox,'transparent_pixels':h[0],'alpha_extrema':a.getextrema(),'recommended_anchor_pixel':[asset.width//2,bbox[3]-1]})
(root/'asset-manifest.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps(out,ensure_ascii=False))
