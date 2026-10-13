"""Lossless crop/pack only. No pixel repainting, blending, tiling repair or recoloring."""
from pathlib import Path
from PIL import Image,ImageChops
import numpy as np
import json, shutil, hashlib

R=Path(__file__).parent
entries=[]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def edge_scores(im):
    a=np.asarray(im.convert('RGB')).astype(np.float32)
    return {'leftRightMeanAbsoluteRGB':round(float(abs(a[:,0]-a[:,-1]).mean()),3),'topBottomMeanAbsoluteRGB':round(float(abs(a[0]-a[-1]).mean()),3)}
def match_axis(a):
    # Compare short strips at potential repeat phases. Only selects a crop.
    n=a.shape[1];best=(float('inf'),0,n)
    ends=list(range(int(n*.73),n-5,2))
    for x in range(0,int(n*.24),2):
        valid=[e for e in ends if e-x>=n*.58]
        block=np.stack([a[:,e:e+4] for e in valid])
        cost=abs(block-a[:,x:x+4]).mean(axis=(1,2,3))
        k=int(np.argmin(cost))
        if float(cost[k])<best[0]:best=(float(cost[k]),x,valid[k])
    return best[1:]
def periodic_axis(a,period):
    # Whole-pattern repeat span avoids minimizing RGB by cutting arbitrary motifs.
    n=a.shape[1];span=int(period*(n//period))
    if period<n and span>n*.92:span-=period
    if span==n:return (0,n)
    best=(float('inf'),0)
    for x in range(0,n-span):
        end=x+span
        cost=float(abs(a[:,x]-a[:,end-1]).mean())
        if cost<best[0]:best=(cost,x)
    return (best[1],best[1]+span)
PERIODS={'wall_cream':(627,261),'wall_mint':(337,336),'wall_rose':(418,145),'wall_dots':(627,278),'wall_brick':(582,202),'wall_walnut':(384,392),'wall_stars':(405,431),'floor_checker':(1254,1254),'floor_mint':(313,313),'floor_herringbone':(531,261)}
def record(spec,source,im,box,state):
    crop=im.crop(box);name=spec['id']+('-'+state if spec['kind']=='counter' else '')+'.png';dest=R/name;crop.save(dest)
    assert ImageChops.difference(Image.open(dest).convert('RGBA'),im.crop(box).convert('RGBA')).getbbox() is None
    a=crop.convert('RGBA').getchannel('A');bb=a.point(lambda x:255 if x>128 else 0).getbbox();x,y,x1,y1=bb
    rec={'id':spec['id'],'state':state,'kind':spec['kind'],'file':str(dest),'source':str(source),'source_crop':list(box),'sourceSize':list(im.size),'size':list(crop.size),'bbox':{'x':x,'y':y,'w':x1-x,'h':y1-y},'bboxAlphaThreshold':'>128','nativeAspect':(x1-x)/(y1-y),'alphaExtrema':list(a.getextrema()),'sourceSha256':digest(source),'fileSha256':digest(dest),'losslessCropVerified':True,'status':'candidate_pending_integration_review'}
    if spec['kind']=='tile':
        rec['nominalMotifUnitFromLegacy']=spec['logical'];rec['repeatAxes']=['x','y'];rec['tileEdges']=edge_scores(crop);rec['sourceEdges']=edge_scores(im)
        rec['edgeSelection']='Lossless rectangle chosen by matching opposite 4px source strips; no edge blending, mirroring, repaint or synthesis.'
        rec['seamStatus']='Edge-score checked; native 2x2 repeat preview provided. Runtime visual repeat/density still requires review.'
        rec['anchor']={'x':0,'y':0,'kind':'material-origin'}
        preview=Image.new('RGBA',(crop.width*2,crop.height*2),(0,0,0,0))
        for yy in [0,crop.height]:
            for xx in [0,crop.width]:preview.paste(crop,(xx,yy))
        p=R/(spec['id']+'-repeat-proof.png');preview.save(p);rec['repeatProof']=str(p)
    else:
        rec['anchor']={'x':x+(x1-x)/2,'y':y1-1,'kind':'module-bottom-center'}
        rec['adaptation']='Top/front independent. Maintain native aspect; crop-repeat or scale uniformly. Counter front is wider than old 190:138 module; do not squeeze.'
    entries.append(rec)

for batch in sorted(R.glob('batch-*.json')):
    for spec in json.loads(batch.read_text()):
        source=R/'sources'/(spec['id']+'-source.png');shutil.copy2(spec['sourcePath'],source);im=Image.open(source).convert('RGBA')
        if spec['kind']=='tile':
            v=np.asarray(im.convert('RGB')).astype(np.float32)
            if spec['id'] in PERIODS:
                px,py=PERIODS[spec['id']]
                x0,x1=periodic_axis(v[::4],px);y0,y1=periodic_axis(v[:,x0:x1].transpose(1,0,2)[::4],py)
            else:
                x0,x1=match_axis(v[::4]);y0,y1=match_axis(v[:,x0:x1].transpose(1,0,2)[::4])
            box=(x0,y0,x1,y1)
            # A cropped repeat is accepted only when both raw edge metrics improve.
            sc=edge_scores(im);cc=edge_scores(im.crop(box))
            if spec['id'] not in PERIODS and (cc['leftRightMeanAbsoluteRGB']>sc['leftRightMeanAbsoluteRGB'] or cc['topBottomMeanAbsoluteRGB']>sc['topBottomMeanAbsoluteRGB']):box=(0,0,im.width,im.height)
            record(spec,source,im,box,'tile')
            entries[-1]['edgeSelection']='Lossless crop with whole-motif period estimated from source self-similarity, then low-difference edge phase. No blending/repaint/synthesis.' if spec['id'] in PERIODS else entries[-1]['edgeSelection']
            if spec['id'] in PERIODS:entries[-1]['estimatedSourcePeriod']=list(PERIODS[spec['id']])
        elif spec['kind']=='counter':
            a=np.asarray(im.getchannel('A'));occupied=np.any(a>128,axis=1);spans=[];start=None
            for y,on in enumerate(occupied):
                if on and start is None:start=y
                if start is not None and (not on or y==len(occupied)-1):
                    end=y if not on else y+1
                    if end-start>20:spans.append((start,end))
                    start=None
            assert len(spans)==2,(spec['id'],spans)
            for state,(top,bottom) in zip(['top','front'],spans):
                ys,xs=np.where(a[top:bottom]>128);x0,x1=int(xs.min()),int(xs.max())+1
                box=(max(0,x0-10),max(0,top-10),min(im.width,x1+10),min(im.height,bottom+10));record(spec,source,im,box,state)
    print('packaged',batch.name,flush=True)

manifest={'version':1,'status':'Generated source candidates only, no code integration.','generation':'Built-in imagegen; one call per material ID or related two-module counter set.','processing':'Only source copy, rectangular lossless cropping, measurements and native unscaled 2x2 packing.','assets':entries,'excludedNoBitmap':['sill_none','ceiling_none','rug_none','neon_none'],'aliases':[{'id':'counter_oak','state':'top','file':'/workspace/shared/zeGame2/public/art/generated/main-v1/cabinet-top.png','source':'/workspace/shared/zeGame2/public/art/generated/main-v1/cabinet-top.png','source_crop':[0,0,580,60],'size':[580,60],'status':'reuse_candidate_pending_integration_review'},{'id':'counter_oak','state':'front','file':'/workspace/shared/zeGame2/public/art/generated/main-v1/cabinet-front.png','source':'/workspace/shared/zeGame2/public/art/generated/main-v1/cabinet-front.png','source_crop':[0,0,190,138],'size':[190,138],'status':'reuse_candidate_pending_integration_review'}]}
for a in manifest['aliases']:a['fileSha256']=digest(Path(a['file']))
(R/'materials-manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'ids':len(set(a['id'] for a in entries)),'pngs':len(entries),'tileEdges':{a['id']:a['tileEdges'] for a in entries if a['kind']=='tile'}},indent=2))
