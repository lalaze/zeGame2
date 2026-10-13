from PIL import Image
from pathlib import Path
import json
r=Path(__file__).parent
out=[]
def crop(im,source,name,region,metadata):
 p=im.crop(region);a=p.getchannel('A');b=a.point(lambda x:255 if x>128 else 0).getbbox();pad=12;box=(max(0,region[0]+b[0]-pad),max(0,region[1]+b[1]-pad),min(im.width,region[0]+b[2]+pad),min(im.height,region[1]+b[3]+pad));p=im.crop(box);p.save(r/(name+'.png'));a=p.getchannel('A');b=a.point(lambda v:255 if v>128 else 0).getbbox();out.append({'name':name,'file':name+'.png','source':source,'source_crop':box,'size':p.size,'body_bbox':b,'body_size':[b[2]-b[0],b[3]-b[1]],'foot_anchor_px':[(b[0]+b[2])/2,b[3]-1],'alpha_extrema':a.getextrema(),'transparent_pixels':a.histogram()[0],**metadata})
s='barista-poses-source.png';im=Image.open(r/s);print('barista',im.size)
for row,d in enumerate(['down','up','right']):
 for col,f in enumerate(['stand','stepA','stepB']):
  box=(round(im.width*col/3),[0,435,830,1254][row],round(im.width*(col+1)/3),[0,435,830,1254][row+1]);crop(im,s,'barista-'+d+'-'+f,box,{'identity':'barista-default','direction':d,'state':f,'pose':['idle','stride','passing-knee'][col],'target_body_height':28,'integration_status':'candidate-awaits-runtime-review'})
s='customer-seated-source.png';im=Image.open(r/s)
for n,d in enumerate(['right','left']):crop(im,s,'customer-sit-'+d,(n*im.width//2,0,(n+1)*im.width//2,im.height),{'identity':'customer-red-cardigan','direction':d,'state':'sit','integration_status':'hold-until-matching-walk-stand-identity-set-exists'})
(r/'manifest.json').write_text(json.dumps({'assets':out,'left_barista':'Mirror right frames at runtime if needed; warm light will mirror too.','animation_note':'Three distinct poses per direction, not a verified full gait cycle. Feet-anchor alignment and animation cadence require runtime review.','scope':'Default barista candidate only; no replacement of all thirty identities.'},indent=2));print(json.dumps(out))
