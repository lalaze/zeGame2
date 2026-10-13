from PIL import Image
from pathlib import Path
import json
r=Path(__file__).parent;im=Image.open(r/'menu-three-source.png');print(im.size,im.mode);out=[]
for name,x0,x1,old in [('espresso',0,620,[12,12]),('latte',620,1450,[12,11]),('eggtart',1450,im.width,[12,9])]:
 reg=(x0,0,x1,im.height);b=im.crop(reg).getchannel('A').point(lambda v:255 if v>128 else 0).getbbox();box=(max(0,x0+b[0]-10),max(0,b[1]-10),min(im.width,x0+b[2]+10),min(im.height,b[3]+10));p=im.crop(box);p.save(r/(name+'.png'));a=p.getchannel('A');b=a.point(lambda v:255 if v>128 else 0).getbbox();out.append({'itemId':name,'file':str(r/(name+'.png')),'source_crop':box,'size':p.size,'bbox':{'x':b[0],'y':b[1],'w':b[2]-b[0],'h':b[3]-b[1]},'anchor':{'x':(b[0]+b[2])/2,'y':b[3]-1},'oldMenuEnvelope':old,'suggestedMaxWidth':12,'optionalMaxWidth':14,'alpha_extrema':a.getextrema(),'transparent_pixels':a.histogram()[0]})
(r/'manifest.json').write_text(json.dumps({'bboxAlphaThreshold':'alpha > 128; not full nonzero-alpha box','identitySource':'src/game/data.ts MENU and RECIPES; src/render/sprites.ts MENU_ENVELOPES','assets':out,'renderNote':'Preserve aspect and fit inside appropriate menu/table envelope. Tiny-size recognizability requires runtime review, not guaranteed by high-res source.'},indent=2));print(json.dumps(out))
