from PIL import Image
import json,pathlib,hashlib,shutil
D=pathlib.Path('/workspace/scratch/30a3201ff9cd/cafe-bulk-ui-v1');assets=[]
def plate(source,name,items):
 s=D/name;shutil.copy2(source,s);im=Image.open(s).convert('RGBA')
 for id,box,domain in items:
  box=(max(0,box[0]),max(0,box[1]),min(im.width,box[2]),min(im.height,box[3]));c=im.crop(box);p=D/(id+'.png');c.save(p);a=c.getchannel('A');b=a.point(lambda x:255 if x>128 else 0).getbbox();x,y,r,bottom=b
  assets.append(dict(domain=domain,id=id,state='base',status='candidate_pending_render_review',file=str(p),source=str(s),source_crop=box,size=list(c.size),bbox=dict(x=x,y=y,w=r-x,h=bottom-y),anchor=dict(x=(x+r)/2,y=bottom-1),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),alpha=dict(min=a.getextrema()[0],max=a.getextrema()[1]),limitations=[]))
plate('/workspace/scratch/30a3201ff9cd/generated_images/exec-2573fc10-4337-4893-8b16-2d3fd734bc17.png','tableware-ui-source.png',[(id,box,'misc') for id,box in zip(['empty-cup-saucer','empty-tray','water-carafe-glass','empty-plate','coin-star','heart','drop','crown','map-location','arrow-right','film','spark'],[(0,45,378,412),(380,70,770,410),(775,35,1100,410),(1100,60,1450,410),(35,420,368,727),(410,420,720,724),(775,420,1080,725),(1100,420,1450,725),(0,735,387,1040),(395,735,733,1040),(739,735,1110,1040),(1115,735,1450,1040)])])
plate('/workspace/scratch/30a3201ff9cd/generated_images/exec-13033a14-8760-40be-a26e-7dd726f65b88.png','signature-components-source.png',[(id,box,'signature') for id,box in zip(['cup-coffee','cup-tea','cup-milk','cup-fruit','liquid-coffee','liquid-tea','liquid-milk','liquid-fruit','topping-milk','topping-sugar','topping-spice','topping-cocoa','topping-cream','topping-fruit','topping-matcha','glass-glints'],[(0,20,415,389),(415,20,772,389),(776,15,1026,389),(1080,15,1390,389),(0,401,368,600),(377,401,713,600),(724,401,1060,600),(1065,401,1405,600),(20,610,375,831),(405,620,720,834),(729,620,1040,834),(1075,610,1402,834),(20,831,381,1105),(390,840,710,1105),(710,866,1061,1105),(1074,840,1406,1105)])])
for a in assets:
 if a['domain']=='signature':
  a['limitations']=['Independent authored layer, not pixel-registered to other components. Fit surface to measured vessel rim at integration; no per-layer stretch promised. Glass liquids need runtime body fill/clipping or additional authored fill geometry.']
  if a['id']=='topping-milk': a['limitations'].append('Milk cap is visibly peaked; not a flat milk band. Candidate requires recipe-compositor review.')
j=dict(status='candidate_pending_render_review',bboxAlphaThreshold='alpha>128 measurement only; exact RGBA source rectangles preserved',assets=assets)
(D/'manifest.json').write_text(json.dumps(j,indent=2))
print(len(assets))
plate('/workspace/scratch/30a3201ff9cd/generated_images/exec-19ac10b3-e27b-402d-9d5f-c9c73be6319e.png','upgrades-feedback-source.png',[(id,box,domain) for id,box,domain in [('barista',(10,15,406,615),'upgrade'),('server',(408,15,773,615),'upgrade'),('cook',(774,10,1149,615),'upgrade'),('marketing',(1150,135,1530,615),'upgrade'),('order-waiting',(65,615,343,990),'misc'),('order-ready',(407,615,753,990),'misc'),('order-served',(780,615,1133,990),'misc'),('star',(1150,615,1510,990),'misc')]])
j['assets']=assets
j['aliases']=[dict(domain='upgrade',id='machine',file='/workspace/scratch/30a3201ff9cd/cafe-service-props-v1/espresso-machine.png',status='reused'),dict(domain='upgrade',id='tables',file='/workspace/scratch/30a3201ff9cd/cafe-assets-v2/table-no-vase.png',status='reused')]
j['gaps']=[dict(domain='signature',id='glass-liquid-body-fill',status='missing',reason='Surface layers exist but transparent tall glasses require renderer clipping/fill below surface; authored registered liquid body not generated.'),dict(domain='signature',id='dose-1-vs-2-variants',status='review_required',reason='Sugar/spice garnish sources include two pieces; runtime exact dose remains pips/count text until independent one-piece cutout registration is reviewed.')]
(D/'manifest.json').write_text(json.dumps(j,indent=2));print('final assets',len(assets))
