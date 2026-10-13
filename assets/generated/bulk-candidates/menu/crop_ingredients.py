from pathlib import Path
from PIL import Image
import json

ROOT=Path(__file__).parent
catalog=json.loads(Path('/workspace/shared/zeGame2/docs/pixel-depth/BULK-ASSET-CATALOG.json').read_text())
lookup={x['id']:x for x in catalog['ingredients']}
assets=[]
for source in sorted((ROOT/'sources').glob('ingredient-*-source.png')):
    item=source.name.removeprefix('ingredient-').removesuffix('-source.png')
    assert item in lookup,item
    im=Image.open(source).convert('RGBA')
    alpha=im.getchannel('A')
    bb=alpha.point(lambda p:255 if p>128 else 0).getbbox()
    assert bb,item
    x0,y0,x1,y1=alpha.getbbox()
    crop=(max(0,x0-10),max(0,y0-10),min(im.width,x1+10),min(im.height,y1+10))
    out=im.crop(crop)
    path=ROOT/f'ingredient-{item}.png'
    out.save(path)
    x,y,r,b=out.getchannel('A').point(lambda p:255 if p>128 else 0).getbbox()
    a=out.getchannel('A')
    entry={'ingredientId':item,'file':str(path),'source':str(source),'sourceSize':list(im.size),'source_crop':list(crop),'size':list(out.size),'bbox':{'x':x,'y':y,'w':r-x,'h':b-y},'anchor':{'x':(x+r)/2,'y':b-1},'oldEnvelope':lookup[item]['logical'],'logicalBare':lookup[item]['logical'],'alpha_extrema':list(a.getextrema()),'transparent_pixels':a.histogram()[0],'alphaBBoxAtSource':list(bb),'qa':{'fullObject':True,'identityChecked':True,'status':'candidate_pending_runtime_review','contentEdits':'None. Lossless rectangular crop only; every nonzero-alpha pixel retained.'}}
    assert a.getextrema()[0]==0,item
    assets.append(entry)
manifest={'version':1,'generationTool':'built-in image_gen.imagegen, one distinct asset per call','bboxAlphaThreshold':'alpha > 128','cropPolicy':'lossless rectangular crop preserving every nonzero-alpha pixel; alpha>128 is measurement only. No resizing, recoloring, alpha changes, cleanup, or compositing','assets':assets}
(ROOT/'ingredient-manifest.json').write_text(json.dumps(manifest,indent=2))
print('Ingredient assets:',len(assets),'IDs:',','.join(a['ingredientId'] for a in assets))
