from PIL import Image
from pathlib import Path
import numpy as np,json,hashlib
r=Path(__file__).parent;coverage=[];families=[]
for folder in sorted(r.iterdir()):
 if not folder.is_dir() or not (folder/'source.png').exists():continue
 im=Image.open(folder/'source.png');arr=np.array(im);a=arr[:,:,3];hh,ww=a.shape;mask=a>128;ys=mask.sum(axis=1);yb=[0]
 for frac in [1/3,2/3]:
  lo=int(hh*(frac-.035));hi=int(hh*(frac+.035));local=ys[lo:hi];m=local.min();cand=np.flatnonzero(local==m)+lo;yb.append(int(cand[np.argmin(abs(cand-hh*frac))]))
 yb.append(hh);frames=[];colbounds=[0,round(ww/3),round(ww*2/3),ww]
 for row,d in enumerate(['down','up','right']):
  for col,state in enumerate(['stand','stepA','stepB']):
   cell=(colbounds[col],yb[row],colbounds[col+1],yb[row+1]);b=im.crop(cell).getchannel('A').point(lambda v:255 if v>128 else 0).getbbox()
   if not b:raise Exception('missingframe')
   box=(max(cell[0],cell[0]+b[0]-8),max(cell[1],cell[1]+b[1]-8),min(cell[2],cell[0]+b[2]+8),min(cell[3],cell[1]+b[3]+8));p=im.crop(box);name=f'{d}-{state}.png';p.save(folder/name);pa=np.array(p);bb=p.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox();hsv=np.array(p.convert('RGB').convert('HSV')).astype(float);h=hsv[:,:,0]*360/255;s=hsv[:,:,1]/255;rgb=pa[:,:,:3].astype(float);core=pa[:,:,3]>=16;neutral=(s<=.12)|((rgb.max(axis=2)-rgb.min(axis=2))<=12);cent=np.array([0,30,60,120,180,240,270,300]);dist=np.abs(h[:,:,None]-cent);dist=np.minimum(dist,360-dist);strict=neutral|((s>=.45)&(dist.min(axis=2)<=12));bad=core&~strict;bd={'x':bb[0],'y':bb[1],'w':bb[2]-bb[0],'h':bb[3]-bb[1]};issues=['semantic ID mapping not runtime-reviewed','chromatic dark contours/fixed face may need semantic correction']
   if folder.name in ['server-style1','server-style3'] and d=='up':issues.append('unwanted rear bowtie visible; role geometry mismatch')
   if bb[1]==0 or bb[3]==p.height:issues.append('tight vertical gutter or silhouette reaches source/cell boundary; inspect clipping')
   f={'domain':'parameter','id':folder.name,'state':f'{d}-{state}','direction':d,'pose':state,'status':'candidate_pending_render_review','file':str(folder/name),'source':str(folder/'source.png'),'source_crop':box,'size':p.size,'bbox':bd,'foot':{'x':(bb[0]+bb[2])/2,'y':bb[3]-1},'sourceToWorldScale':28/383,'scaleNote':'Shared initial body family scale from approved base; chef hat/bun may need envelope expansion, never perframe fit.','coreAlphaThreshold':16,'strictUnclassifiedFraction':float(bad.sum()/max(1,core.sum())),'alphaExtrema':[int(pa[:,:,3].min()),int(pa[:,:,3].max())],'sha256':hashlib.sha256((folder/name).read_bytes()).hexdigest(),'issues':issues};frames.append(f);coverage.append(f)
 roles=['owner','barista'] if folder.name.startswith('shared') else [folder.name.split('-')[0]];style=int(folder.name[-1]);fam={'family':folder.name,'roles':roles,'hairStyle':style,'status':'candidate_pending_render_review','sourceSize':im.size,'rowBoundaries':yb,'bboxAlphaThreshold':'alpha>128 not all-nonzero alpha','frames':frames};(folder/'renderer-manifest.json').write_text(json.dumps(fam,indent=2));families.append({'family':folder.name,'roles':roles,'hairStyle':style,'source':str(folder/'source.png'),'manifest':str(folder/'renderer-manifest.json'),'status':'candidate_pending_render_review','frames':len(frames),'boundaryFlags':sum(any('gutter' in x for x in f['issues']) for f in frames)})
(r/'coverage.json').write_text(json.dumps({'physicalFamilies':11,'roleStyleRecipes':15,'sourceFrames':99,'eligibleRuntimeLooks':0,'status':'ALL CANDIDATES; no palette/identity coverage acceptance','families':families,'assets':coverage},indent=2));print([(x['family'],x['frames'],x['boundaryFlags']) for x in families])
