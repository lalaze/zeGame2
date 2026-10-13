from PIL import Image
from pathlib import Path
import json
r=Path(__file__).parent;frames=[]
def crop(im,source,name,region,meta,foot=None,seat=None,contact=None):
 p=im.crop(region);b=p.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox();box=(region[0]+b[0]-10,region[1]+b[1]-10,region[0]+b[2]+10,region[1]+b[3]+10);p=im.crop(box);p.save(r/(name+'.png'));b=p.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox();o={'file':str(r/(name+'.png')),'source':source,'source_crop':box,'size':p.size,'bbox':{'x':b[0],'y':b[1],'w':b[2]-b[0],'h':b[3]-b[1]},'foot':{'x':(b[0]+b[2])/2,'y':b[3]-1},'alpha_extrema':p.getchannel('A').getextrema(),**meta}
 for key,v in [('foot',foot),('seatContact',seat),('petContact',contact)]:
  if v:o[key]={'x':v[0]-box[0],'y':v[1]-box[1]}
 frames.append(o)
s='mina-walk-source.png';im=Image.open(r/s)
for row,d in enumerate(['down','up','right']):
 for col,f in enumerate(['stand','stepA','stepB']):crop(im,s,f'mina-{d}-{f}',(col*418,[0,430,833][row],(col+1)*418,[430,833,1254][row]),{'direction':d,'state':f,'frame':{'stand':'stand','stepA':'stride','stepB':'passing'}[f],'group':'walk'})
for a in frames:a['sourceToWorldScale']=28/next(x['bbox']['h'] for x in frames if x['direction']==a['direction'] and x['state']=='stand')
s='mina-seated-source.png';im=Image.open(r/s);print('seated',im.size)
feet=[(333,493),(793,493),(1288,493),(228,990),(740,990),(1301,990)]
seats=[(227,370),(704,370),(1197,370),(335,870),(841,870),(1398,870)]
hands=[None,(937,412),(1446,450),None,(592,916),(1147,949)]
for row,d in enumerate(['right','left']):
 for col,f in enumerate(['sit','sitPetA','sitPetB']):
  i=row*3+col;crop(im,s,f'mina-{d}-{f}',(col*512,row*512,(col+1)*512,(row+1)*512),{'direction':d,'state':f,'frame':f,'group':'seated','sourceToWorldScale':0.0526,'scaleBasis':'Approximate shared head scale: seated head width ~210 source px vs walk ~150; runtime visual review required.','anchorBasis':'Manually inspected source shoe-baseline center and seated hip contact, not whole-body bbox midpoint.'},feet[i],seats[i],hands[i])
(r/'renderer-manifest.json').write_text(json.dumps({'identity':'customer-cast-0-Mina','appearanceId':0,'look':{'skin':0,'hair':0,'hairStyle':0,'shirt':0,'pants':1},'outfit':'cardigan','accessory':'glasses','accent':'#d6b66d','bboxAlphaThreshold':'alpha > 128; excludes faint fringe, not all-nonzero alpha','frames':frames,'leftWalk':'mirror right','status':'source inspected; runtime gait/seat/contact validation pending'},indent=2));print([(x['state'],x['direction'],x['bbox']) for x in frames])
