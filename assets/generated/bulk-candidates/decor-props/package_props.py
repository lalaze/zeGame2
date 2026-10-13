from pathlib import Path
from PIL import Image
import json,hashlib,numpy as np
ROOT=Path('/workspace/scratch/30a3201ff9cd/cafe-decor-props-v1')
rows=json.loads((ROOT/'PROMPTS.json').read_text()); mp=json.loads((ROOT/'SOURCE-MAP.json').read_text())
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
assets=[]
notes={
 'sill_cactus':['Original selected. The apparent brown preview background is RGB under alpha=0; alpha-composited QA confirms no visible exterior halo. Optional imagegen correction retained unused. Maximum authored alpha is 254/255, preserved unchanged.'],
 'sill_tulips':['Exactly three tulips are present; source authored three broad leaves rather than requested two.'],
 'sill_bonsai':['Native content is less wide than nominal 12:9 target. Preserve aspect and fit uniformly.'],
 'ceiling_lights':['Four unlit cream-glass bulbs. Strong white spots are painted glass reflections, not exterior emission. Complete hanging endpoints. Native sag is shallower than nominal 64:14 target.'],
 'ceiling_vines':['Overhead vine trim only; no pot. Exact repeatability of vine endpoints was not requested or certified.'],
 'ceiling_pendants':['Cord reaches source top boundary intentionally usable as ceiling attachment; no upper transparent margin exists in source.'],
 'ceiling_chandelier':['Five unlit candles and five crystal drops. Source reaches top and bottom boundaries: ceiling mount top and lowest crystal tip lack transparent margin and may need later integration review. No repair or reconstructed pixels added.'],
 'rug_red':['Fringe authored at left/right ends rather than requested top/bottom ends. Rectangular overhead material retained without rotation or stretching.'],
 'rug_blue':['Fringe authored at left/right ends rather than requested top/bottom ends. Rectangular overhead material retained without rotation or stretching.'],
 'rug_round':['Oval braided rug preserved at its native aspect; fit uniformly.'],
 'neon_cafe':['Blank center confirmed: no letters, symbol or glass tube. The generated mounting body is substantially slimmer than nominal 3:1; preserve native aspect and review runtime text fit rather than squeezing.'],
 'neon_heart':['Hollow heart interior has genuine alpha. Tube reflections are authored highlights; runtime glow remains separate.'],
 'neon_cup':['Three steam curls, right handle, hollow cup/saucer with genuine alpha. Tube reflections are authored highlights; runtime glow remains separate.']}
for item in rows:
 id=item['id'];source=ROOT/'sources'/(id+'-source.png');im=Image.open(source);assert im.mode=='RGBA'
 a=np.array(im.getchannel('A'));ys,xs=np.where(a>128);l,t,r,b=int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)
 box=[max(0,l-10),max(0,t-10),min(im.width,r+10),min(im.height,b+10)]
 crop=im.crop(box);out=ROOT/'sprites'/(id+'.png');crop.save(out)
 assert np.array_equal(np.array(Image.open(out)),np.array(im)[box[1]:box[3],box[0]:box[2]])
 bb={'x':l-box[0],'y':t-box[1],'w':r-l,'h':b-t};cx=(l+r)/2-box[0];cy=(t+b)/2-box[1]
 row={'id':id,'state':'unlit' if id.startswith(('ceiling_l','ceiling_p','ceiling_c','neon_')) else 'default','kind':'sprite','file':str(out),'source':str(source),'originalGeneratedSource':mp[id],'source_crop':box,'sourceCropConvention':'[left, top, right-exclusive, bottom-exclusive]','sourceSize':list(im.size),'size':list(crop.size),'bbox':bb,'sourceOpaqueBBox':[l,t,r,b],'bboxAlphaThreshold':'>128','paddingRequested':10,'paddingActual':[l-box[0],t-box[1],box[2]-r,box[3]-b],'nativeAspect':crop.width/crop.height,'opaqueAspect':(r-l)/(b-t),'logicalEnvelope':item['logical'],'alphaExtrema':list(crop.getchannel('A').getextrema()),'sourceSha256':sha(source),'fileSha256':sha(out),'losslessCropVerified':True,'status':'candidate_pending_integration_review','notes':notes[id]}
 row['alpha']={'mode':'RGBA','zeroPixels':int((a==0).sum()),'partialPixels':int(((a>0)&(a<255)).sum()),'opaque255Pixels':int((a==255).sum()),'thresholdUsedForMeasurementOnly':True,'pixelValuesUnmodified':True}
 outside=a.copy();outside[box[1]:box[3],box[0]:box[2]]=0
 row['alpha']['excludedByRectangularCrop']={'nonzeroPixels':int((outside>0).sum()),'maxAlpha':int(outside.max()),'note':'Immutable full source retains all values outside delivery crop.'}
 if id.startswith('sill_'):
  band=a[max(t,b-max(1,int((b-t)*.02))):b,:]>128;by,bx=np.where(band);foot=[float((bx.min()+bx.max()+1)/2-box[0]),float(b-box[1]-1)]
  row['foot']=foot;row['anchor']={'x':foot[0],'y':foot[1],'kind':'pot-base-contact'}
 elif id.startswith('ceiling_'):
  top=[cx,float(t-box[1])];row['top']=top;row['anchor']={'x':top[0],'y':top[1],'kind':'ceiling-top-center'}
 else:
  center=[cx,cy];row['center']=center;row['anchor']={'x':cx,'y':cy,'kind':'floor-center' if id.startswith('rug_') else 'wall-center'}
 row['renderContract']={'preserveNativeAspect':True,'collisionFootprintUnchanged':True,'runtimeLightingSeparate':True,'worldAndShopUseSameArt':True,'renderOverflow':'Not integrated. Fit uniformly inside logical envelope; any later overflow must be declared without changing footprint.'}
 assets.append(row)
manifest={'version':1,'status':'13 generated source candidates frozen; no code integration or runtime validation.','generation':'Built-in imagegen: one independent initial call per exact sprite ID. One additional cactus alpha-only correction was generated and retained unused after original alpha inspection.','processing':'Only immutable source copy, lossless rectangular alpha>128 bounds + 10 px crops, measurement and a separate alpha-composite QA preview. No pixel cleanup, recolor, paint, silhouette edit, resize or algorithmic asset generation.','assets':assets,'producedIds':[r['id'] for r in assets],'missingIds':[],'blockingGaps':[],'reusedIds':[],'unusedSources':[{'id':'sill_cactus-correction','file':str(ROOT/'sources/sill_cactus-correction-source.png'),'originalGeneratedSource':mp['sill_cactus-correction'],'sha256':sha(ROOT/'sources/sill_cactus-correction-source.png'),'status':'unused','reason':'Original source already has valid transparent outside alpha; correction not needed.'}],'qaPreview':str(ROOT/'cactus-alpha-qa.png'),'notInScope':'No tiles, counter modules, placeable furniture, hanging pot, runtime code, repo edits, commits or pushes.'}
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'count':len(assets),'manifest':str(ROOT/'manifest.json'),'cropsVerified':all(r['losslessCropVerified'] for r in assets),'excludedAlpha':[{r['id']:r['alpha']['excludedByRectangularCrop']} for r in assets]},indent=2))
