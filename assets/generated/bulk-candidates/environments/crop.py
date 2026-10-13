from PIL import Image
from pathlib import Path
import json,hashlib
r=Path(__file__).parent
specs={'reading-greenhouse-source.png':[('reading-library-shelf',(12,85,560,650),['reading'],[73,65]),('greenhouse-glass-bay',(1172,40,1520,650),['greenhouse'],[53,80]),('greenhouse-empty-potting-bench',(10,745,884,970),['greenhouse'],[96,18]),('greenhouse-hanging-planter',(900,625,1159,995),['greenhouse'],[11,24]),('reading-book-stack',(1200,750,1521,978),['reading'],[14,8])], 'terrace-source.png':[('pergola-post',(40,70,235,565),['terrace'],[6,89]),('pergola-beam',(265,310,710,408),['terrace'],[64,7]),('terrace-parapet',(730,308,1150,505),['terrace'],[64,18]),('festoon-three-lamps',(1170,309,1520,500),['terrace'],[64,20]),('terrace-flowerbox',(0,680,490,920),['terrace'],[31,17]),('climbing-vine-sprig',(480,590,715,981),['terrace','greenhouse'],[12,24]),('blank-region-sign',(714,727,1150,885),['reading','greenhouse','terrace'],[60,15]),('coping-strip',(1151,770,1536,853),['terrace'],[64,8])], 'main-structure-source.png':[('main-corner-post',(40,40,187,580),['main','reading'],[6,80]),('main-horizontal-beam',(193,262,877,380),['main','reading'],[64,8]),('main-open-door-frame',(895,70,1215,560),['main','reading','kitchen'],[24,40]),('main-closed-door-leaf',(1276,130,1495,560),['main','reading','kitchen'],[18,35]),('outdoor-tree-line',(0,585,516,997),['main','reading','greenhouse','terrace'],[94,50]),('village-roof-cluster',(516,643,920,990),['main','reading'],[80,48]),('cloud',(915,650,1334,870),['main','greenhouse','terrace'],[44,20]),('foreground-threshold',(917,870,1536,992),['main'],[64,12])]}
assets=[]
for src,items in specs.items():
 im=Image.open(r/src)
 for id,reg,areas,target in items:
  p=im.crop(reg);p.save(r/(id+'.png'));a=p.getchannel('A');bb=a.point(lambda v:255 if v>128 else 0).getbbox();assets.append({'domain':'environment','id':id,'areas':areas,'state':'base','status':'candidate_pending_render_review','file':str(r/(id+'.png')),'source':str(r/src),'source_crop':reg,'size':p.size,'bbox':{'x':bb[0],'y':bb[1],'w':bb[2]-bb[0],'h':bb[3]-bb[1]},'anchor':{'x':(bb[0]+bb[2])/2,'y':bb[3]-1},'targetLogicalEnvelope':target,'alphaExtrema':a.getextrema(),'sha256':hashlib.sha256((r/(id+'.png')).read_bytes()).hexdigest(),'notes':['Source ROI retained whole, no alpha thresholding, recoloring or resampling','Target envelope is design reference, preserve aspect and review layout overflow']})
im=Image.open(r/'reading-window-ochre-source.png');reg=(0,0,im.width,im.height);p=im.copy();p.save(r/'reading-window-ochre.png');a=p.getchannel('A');bb=a.point(lambda v:255 if v>128 else 0).getbbox();assets.append({'domain':'environment','id':'reading-window-ochre','areas':['reading'],'state':'base','status':'candidate_pending_render_review','file':str(r/'reading-window-ochre.png'),'source':str(r/'reading-window-ochre-source.png'),'source_crop':reg,'size':p.size,'bbox':{'x':bb[0],'y':bb[1],'w':bb[2]-bb[0],'h':bb[3]-bb[1]},'anchor':{'x':(bb[0]+bb[2])/2,'y':bb[3]-1},'targetLogicalEnvelope':[108,53],'alphaExtrema':a.getextrema(),'notes':['Corrected to ochre curtains; source aspect may differ from target; no stretching','Four genuinely transparent apertures; exact placement requires runtime review']})
(r/'manifest.json').write_text(json.dumps({'bboxAlphaThreshold':'alpha>128 for measurement only; full ROI RGBA preserved','assets':assets},indent=2));print('assets',len(assets),'windowSize',im.size)
for id in ['greenhouse-glass-bay','main-open-door-frame','reading-window-ochre']:
 a=next(x for x in assets if x['id']==id);im=Image.open(a['file']);w,h=im.size
 if id=='greenhouse-glass-bay':qs=[(45,190,64,330),(99,193,137,330),(199,431,230,499)]
 elif id=='main-open-door-frame':qs=[(80,100,230,410)]
 else:qs=[(int(w*.22),int(h*.30),int(w*.44),int(h*.43)),(int(w*.56),int(h*.30),int(w*.79),int(h*.43)),(int(w*.22),int(h*.56),int(w*.44),int(h*.67)),(int(w*.56),int(h*.56),int(w*.79),int(h*.67))]
 qa=[]
 for q in qs:
  z=im.crop(q).getchannel('A');hist=z.histogram();qa.append({'box':q,'alphaExtrema':z.getextrema(),'alphaZeroFraction':hist[0]/(z.width*z.height)})
 a['apertureQA']=qa;print(id,qa)
(r/'manifest.json').write_text(json.dumps({'bboxAlphaThreshold':'alpha>128 for measurement only; full ROI RGBA preserved','assets':assets},indent=2))
