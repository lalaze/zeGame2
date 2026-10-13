from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib
from scipy.ndimage import label,find_objects
root=Path(__file__).parent
manual=json.load(open(root/'manual-pet-contact-source.json'))
# Source sheets were visually inspected as 3 columns x5 rows. Connected-component
# bounds locate the authored frames; only lossless RGBA source crops are written.
# Source-space anchor estimates are further calibrated in runtime, never by resizing bodies.
for p in sorted(root.glob('cast-*/source.png')):
 d=json.load(open(p.parent/'identity-contract.json'));im=Image.open(p).convert('RGBA');a=np.array(im)[:,:,3]>128;lab,n=label(a);s=find_objects(lab);bbs=[]
 for i,b in enumerate(s,1):
  if np.count_nonzero(lab[b]==i)>1000:bbs.append([b[1].start,b[0].start,b[1].stop,b[0].stop])
 if len(bbs)!=15:
  print('BLOCKED',d['id'],'components',len(bbs));continue
 bbs.sort(key=lambda b:b[1]);bbs=[b for row in range(5) for b in sorted(bbs[row*3:row*3+3],key=lambda b:b[0])]
 scale=28/(bbs[0][3]-bbs[0][1]);frames=[]
 for i,b in enumerate(bbs):
  row,col=divmod(i,3);direction=['down','up','right','right','left'][row];state=(['stand','stepA','stepB'] if row<3 else ['sit','sitPetA','sitPetB'])[col]
  # Include source edge alpha and only crop; no matte modification, resampling or recolor.
  box=[max(0,b[0]-10),max(0,b[1]-10),min(im.width,b[2]+10),min(im.height,b[3]+10)]
  if row>0:box[1]=max(box[1],(max(x[3] for x in bbs[(row-1)*3:row*3])+min(x[1] for x in bbs[row*3:row*3+3]))//2)
  if row<4:box[3]=min(box[3],(max(x[3] for x in bbs[row*3:row*3+3])+min(x[1] for x in bbs[(row+1)*3:(row+2)*3]))//2)
  crop=im.crop(box);fn=f'customer-{d["id"]}-{direction}-{state}.png';crop.save(p.parent/fn)
  bb=crop.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox();w=b[2]-b[0];h=b[3]-b[1]
  def pt(x,y):return {'x':round(x-box[0],2),'y':round(y-box[1],2)}
  fx=b[0]+w*.5
  if row>=3:
   shoe_x=np.where(a[max(b[1],b[3]-8):b[3],b[0]:b[2]])[1]
   fx=b[0]+float(np.median(shoe_x))
  f={'file':str(p.parent/fn),'source':'source.png','source_crop':box,'size':list(crop.size),'bbox':{'x':bb[0],'y':bb[1],'w':bb[2]-bb[0],'h':bb[3]-bb[1]},'foot':pt(fx,b[3]-1),'alpha_extrema':list(crop.getchannel('A').getextrema()),'direction':direction,'state':state,'frame':{'stepA':'stride','stepB':'passing'}.get(state,state),'group':'walk' if row<3 else 'seated','sourceToWorldScale':scale,'sourceRGBA_SHA256':hashlib.sha256(crop.tobytes()).hexdigest()}
  if row>=3:
   f['seatContact']=pt(b[0]+w*(.33 if row==3 else .69),b[1]+h*.76)
   if col>0:
    contact=manual[str(d['id'])][(row-3)*2+col-1]
    f['petContact']=pt(*contact)
    f['petContactSource']=contact
    f['petContactBasis']='Manually inspected approximate fingertip in the final authored source sheet; runtime target placement must be refined.'
   f['anchorBasis']='Shoe baseline center measured from bottom8 opaque source rows; seat hip provisionally estimated from inspected silhouette; fingertip manually estimated in source coordinates. All contacts require runtime refinement.'
  frames.append(f)
 status='source inspected; crops and shared scale prepared; runtime validation pending'
 issues=[]
 if d['id']==-1:status='candidate on hold; wrong-facing right-sit requires imagegen repair';issues=['Row4column1 faces left instead of right. Do not integrate.']
 manifest={'identity':f'customer-cast-{d["id"]}-{d["name"]}','appearanceId':d['id'],'look':d['look'],'hairstyle':d['hairstyle'],'outfit':d['outfit'],'accessory':d['accessory'],'accent':d['accent'],'paletteTargets':d['palette'],'hatPaletteTarget':d['hatPalette'],'bboxAlphaThreshold':'alpha >128; excludes faint fringe, not all-nonzero alpha','frames':frames,'sourceSize':list(im.size),'leftWalk':'mirror right','scaleBasis':'One shared source-to-world scale across the entire 15-frame sheet, from the standing reference height 28. Head size remains authored, never per-frame body-height normalization.','status':status,'issues':issues,'runtimeValidation':['palette appearance at game scale','gait timing and foot jitter','seat contact and head scale','pet contact and arm continuity','occlusion and edge alpha'],'contentEdits':'Built-in imagegen only. Python performs lossless independent-frame RGBA crops and metadata, no content edits.'}
 (p.parent/'renderer-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print('PREPARED',d['id'],len(frames),round(scale,4),status)
ids=[int(p.parent.name.split('-')[1]) for p in root.glob('cast-*/source.png')]
(root/'batch-status.json').write_text(json.dumps({'generatedSourceIds':sorted(ids),'sourceQAReadyIds':[i for i in sorted(ids) if i!=-1],'heldIds':[],'pendingIds':[i for i in range(1,30) if i not in ids],'runtime':'pending root checkpoint'},indent=2))
