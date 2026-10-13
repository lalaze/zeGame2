from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib
r=Path(__file__).parent;errors=[];summ=[];frames=0
expected={(di,st) for di in ['down','up','right'] for st in ['stand','stepA','stepB']}|{(di,st) for di in ['left','right'] for st in ['sit','sitPetA','sitPetB']}
for i in range(1,30):
 dr=r/f'cast-{i:02d}';m=json.load(open(dr/'renderer-manifest.json'));d=json.load(open(dr/'identity-contract.json'));source=Image.open(dr/'source.png').convert('RGBA');hs=[]
 if m['appearanceId']!=i or any(m[k]!=d[k] for k in ['look','hairstyle','outfit','accessory','accent']):errors.append([i,'identity metadata mismatch'])
 if set((f['direction'],f['state']) for f in m['frames'])!=expected:errors.append([i,'pose contract mismatch'])
 if len(set(f['sourceToWorldScale'] for f in m['frames']))!=1:errors.append([i,'per-frame scale mismatch'])
 if len(m['frames'])!=15:errors.append([i,'wrong frame count'])
 for f in m['frames']:
  im=Image.open(f['file']).convert('RGBA');a=np.array(im);crop=np.array(source.crop(f['source_crop']));name=Path(f['file']).name;frames+=1;hs.append(hashlib.sha256(a.tobytes()).hexdigest())
  if not np.array_equal(a,crop):errors.append([i,name,'not lossless source crop'])
  if list(im.size)!=f['size']:errors.append([i,name,'size mismatch'])
  bb=im.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox();actual={'x':bb[0],'y':bb[1],'w':bb[2]-bb[0],'h':bb[3]-bb[1]}
  if actual!=f['bbox']:errors.append([i,name,'bbox mismatch'])
  if im.getchannel('A').getextrema()!=(0,255):errors.append([i,name,'alpha invalid'])
  for k in ['foot','seatContact','petContact']:
   if k in f and not(0<=f[k]['x']<im.width and 0<=f[k]['y']<im.height):errors.append([i,name,k,'anchor out of image'])
 if len(set(hs))!=15:errors.append([i,'duplicate frames'])
 summ.append({'id':i,'frames':15,'sourceSize':list(source.size),'sourceSHA256':hashlib.sha256((dr/'source.png').read_bytes()).hexdigest(),'oneSharedScale':m['frames'][0]['sourceToWorldScale'],'status':'source visually reviewed; lossless crops audited; runtime pending'})
report={'identities':29,'frames':frames,'expectedFrames':435,'errors':errors,'allChecksPassed':not errors,'checks':['exact identity metadata','15-state pose key coverage','one shared sheet scale','byte-equal source RGBA crops','alpha>128 bbox','real transparent/opaque alpha extrema','anchor bounds','unique frame pixels'],'scope':'Metadata and source integrity; visual sheet inspection recorded separately; no runtime rendering claim','cast':summ}
(r/'audit-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='cast'},ensure_ascii=False,indent=2))
