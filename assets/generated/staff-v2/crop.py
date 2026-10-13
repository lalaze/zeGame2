from PIL import Image
from pathlib import Path
import json
r=Path(__file__).parent;im=Image.open(r/'owner-source.png');out=[]
for row,d in enumerate(['down','up','right']):
 for col,f in enumerate(['stand','stepA','stepB']):
  cell=(col*418,[0,430,833][row],(col+1)*418,[430,833,1254][row]);p=im.crop(cell);b=p.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox();box=(cell[0]+b[0]-10,cell[1]+b[1]-10,cell[0]+b[2]+10,cell[1]+b[3]+10);p=im.crop(box);name=f'owner-{d}-{f}.png';p.save(r/name);b=p.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox();out.append({'file':str(r/name),'direction':d,'state':f,'frame':{'stand':'stand','stepA':'stride','stepB':'passing'}[f],'size':p.size,'source_crop':box,'bbox':{'x':b[0],'y':b[1],'w':b[2]-b[0],'h':b[3]-b[1]},'foot':{'x':(b[0]+b[2])/2,'y':b[3]-1},'alpha_extrema':p.getchannel('A').getextrema()})
for a in out:a['sourceToWorldScale']=28/next(x['bbox']['h'] for x in out if x['direction']==a['direction'] and x['state']=='stand')
(r/'renderer-manifest.json').write_text(json.dumps({'identity':'owner-all-zero-look','look':{'skin':0,'hair':0,'hairStyle':0,'shirt':0,'pants':0},'frames':out,'left':'mirror right','status':'source-checked; runtime pending'},indent=2));print([(x['direction'],x['state'],x['bbox']) for x in out])
