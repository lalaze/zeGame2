from PIL import Image
from pathlib import Path
import json
r=Path(__file__).parent;im=Image.open(r/'wall-source.png');frames=[]
for name,reg in [('window-gingham-frame',(0,0,680,620)),('blank-chalkboard',(680,100,1536,610)),('brass-wall-lamp',(600,620,950,1000))]:
 a=im.crop(reg).getchannel('A');b=a.point(lambda x:255 if x>128 else 0).getbbox();box=(reg[0]+b[0]-10,reg[1]+b[1]-10,reg[0]+b[2]+10,reg[1]+b[3]+10);p=im.crop(box);p.save(r/(name+'.png'));a=p.getchannel('A');b=a.point(lambda x:255 if x>128 else 0).getbbox();f={'name':name,'file':str(r/(name+'.png')),'source_crop':box,'size':p.size,'bbox':{'x':b[0],'y':b[1],'w':b[2]-b[0],'h':b[3]-b[1]},'anchor':{'x':(b[0]+b[2])/2,'y':b[3]-1},'alpha_extrema':a.getextrema()}
 if name=='window-gingham-frame':
  qa=[]
  for q in [(200,185,320,280),(380,185,505,280),(190,340,320,445),(380,340,515,445)]:
   z=im.crop(q).getchannel('A');h=z.histogram();qa.append({'safeInteriorBox':{'x':q[0]-box[0],'y':q[1]-box[1],'w':q[2]-q[0],'h':q[3]-q[1]},'alphaExtrema':z.getextrema(),'fractionFullyTransparent':h[0]/(z.width*z.height)})
  f['apertureQA']=qa;f['apertureUnionApprox']={'x':160-box[0],'y':161-box[1],'w':386,'h':296};f['note']='Curtains partially overlap outer opening. Draw animated village behind complete apertureUnion; mullions are opaque overlay.'
 if name=='blank-chalkboard':f['writingArea']={'x':750-box[0],'y':208-box[1],'w':697,'h':264}
 frames.append(f)
(r/'manifest.json').write_text(json.dumps({'bboxAlphaThreshold':'alpha > 128; excludes faint fringe, not all nonzero-alpha','assets':frames},indent=2));print(json.dumps(frames))
