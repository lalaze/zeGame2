from pathlib import Path
from PIL import Image
import json,hashlib,numpy as np
R=Path(__file__).parent
# Source regions measured from sheets, never inferred from a regular grid.
# Anchors/overlay geometry are manually estimated source pixels and require runtime review.
specs=[
('cooler','storage-source.png',(100,0,490,490),(280,474),[34,72],{'closedDoorFace':(177,100,358,452),'doorGapEdge':(189,265),'display':(267,73)},['cooler-active-door-gap','cold-room-stock'],['Closed opaque door has right hinges unlike legacy small drawing. Existing active gap overlay must be positioned/occluded explicitly; open-state geometry not yet validated.']),
('dryStore','storage-source.png',(570,20,960,456),(764,448),[36,58],{'shelf1':(760,185),'shelf2':(760,286),'shelf3':(760,388)},['ingredient-stock'],[]),
('handSink','storage-source.png',(1080,20,1450,490),(1259,460),[16,40],{'wallMount':(1265,257),'basin':(1148,267,1340,310),'faucetTip':(1236,184)},[],['Separate dispenser housings are part of this single wall fixture crop.']),
('mixer','storage-source.png',(70,490,520,1010),(298,962),[24,39],{'hookPivot':(254,636),'bowlOpening':(140,682,379,728),'controlDisplay':(257,585)},['spiral-mixer-hook-shaft','dough-stock','working-status-light'],['Body leaves head-to-bowl clearance; exact hook motion/occlusion must be calibrated.']),
('proofer','storage-source.png',(590,456,960,1010),(764,972),[24,58],{'shelf1':(747,620),'shelf2':(747,697),'shelf3':(747,773),'shelf4':(747,839),'display':(744,506)},['proofing-stock','steam','working-status-light'],[]),
('pastryFridge','storage-source.png',(1080,500,1450,1010),(1257,965),[20,38],{'shelf1':(1238,695),'shelf2':(1238,783),'glass':(1153,606,1316,854),'display':(1237,566)},['pastry-stock','working-status-light'],[]),
('kettle','hotline-source.png',(25,75,430,550),(226,495),[26,40],{'potOpening':(127,119,346,170),'burner':(228,310)},['water-fill','boiling-bubbles','steam','burner-flame'],[]),
('deckOven','hotline-source.png',(470,75,1080,550),(776,518),[56,54],{'upperChamber':(559,219,867,280),'lowerChamber':(556,372,868,435),'upperControl':(948,207),'lowerControl':(948,354)},['baking-stock','oven-hot-glow','working-status-light'],[]),
('convection','hotline-source.png',(1110,50,1500,550),(1301,528),[28,48],{'fanCenter':(1277,238),'chamber':(1181,158,1338,311),'display':(1384,158)},['convection-fan-blades','baking-stock','oven-hot-glow','working-status-light'],['Rear grille is static; fan blades deliberately absent. Add runtime blades over/behind grille under later validated order.']),
('fryer','hotline-source.png',(20,550,420,990),(222,948),[26,34],{'leftVat':(91,682,202,729),'rightVat':(218,682,344,729)},['oil-fill','donut-stock','oil-bubbles','working-status-light'],[]),
('hood','hood-correction-source.png',(0,0,2098,750),(1048,269),[154,23],{'wallMount':(1048,269),'plaqueCenter':(1048,389),'leftLight':(520,547),'rightLight':(1600,547)},['hood-task-light','runtime-zone-label'],['Corrected wider candidate still has aspect4.72 versus target6.70. At154logical width it is32.6high, about9.6px over the23px envelope. Do not vertically squash; review overflow or use uniform contained fit.']),
('hookup','hotline-source.png',(1210,680,1510,900),(1370,794),[13,7],{'wallMount':(1370,794),'pipeCap':(1306,749),'socketCenter':(1434,785)},[],['Only uninstalled/capped state is visible; installed state hides this module and has no separate blank PNG.']),
('bench','floor-source.png',(10,130,720,465),(365,430),[104,42],{'topCenter':(370,237),'worktop':(89,185,649,271),'sheeterMount':(131,230),'standMixerMount':(605,249)},['bench-food-tools','sheeter-body','standMixer-body'],['Empty cabinet shelves and bare inset marble slab are intentional. Appliances attach independently.']),
('sheeter','floor-source.png',(710,170,1170,460),(929,414),[22,12],{'rollerPivot':(939,282),'conveyor':(797,319,1024,379)},['dough-sheet'],[]),
('standMixer','floor-source.png',(1170,50,1510,460),(1337,424),[14,16],{'beaterPivot':(1290,232),'bowlOpening':(1228,250,1380,286)},['stand-mixer-beater','ingredients'],['Open coupling-to-bowl area deliberately excludes beater/shaft.']),
('rack','floor-source.png',(30,460,325,955),(181,904),[22,46],{'shelf1':(182,530),'shelf2':(181,634),'shelf3':(181,738),'shelf4':(181,834)},['cooling-food-stock'],['Real transparent open bays; no stock or cloth baked in.']),
('bins','floor-source.png',(340,620,810,955),(579,911),[40,20],{'leftLabel':(478,776),'rightLabel':(640,795),'leftLid':(492,692),'rightLid':(654,706)},['runtime-bin-labels'],['Two closed empty bin bodies in one paired module, blank labels.']),
('dishPit','floor-source.png',(815,460,1510,985),(1164,932),[64,38],{'sink1':(960,698),'sink2':(1090,708),'sink3':(1215,714),'sprayTip':(1118,618),'drainRack':(1370,717)},['runtime-dishes','water-flow'],[])
]
frames=[]
for id,src,reg,foot,logical,geometry,overlays,notes in specs:
 im=Image.open(R/src).convert('RGBA');tile=im.crop(reg);b=tile.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox();box=[max(reg[0],reg[0]+b[0]-10),max(reg[1],reg[1]+b[1]-10),min(reg[2],reg[0]+b[2]+10),min(reg[3],reg[1]+b[3]+10)];p=im.crop(box);p.save(R/(id+'.png'));a=p.getchannel('A');bb=a.point(lambda v:255 if v>128 else 0).getbbox();ow,oh=bb[2]-bb[0],bb[3]-bb[1];sc=min(logical[0]/ow,logical[1]/oh)
 geom={}
 for k,v in geometry.items():
  geom[k]=[v[0]-box[0],v[1]-box[1]] if len(v)==2 else [v[0]-box[0],v[1]-box[1],v[2]-box[0],v[3]-box[1]]
 aspect=ow/oh;deviation=abs(aspect/(logical[0]/logical[1])-1)
 frames.append(dict(id=id,status='candidate_pending_runtime_review',file=str(R/(id+'.png')),source=src,sourceCrop=box,size=list(p.size),bboxAlpha128=dict(x=bb[0],y=bb[1],w=ow,h=oh),anchor=dict(x=foot[0]-box[0],y=foot[1]-box[1],kind='wall-attachment' if id in ['hood','hookup','handSink'] else 'ground-or-counter-support'),logicalEnvelope=logical,nativeAspect=aspect,uniformContainedScale=sc,containedOpaqueWorldSize=[ow*sc,oh*sc],atLogicalWidthWorldHeight=oh*logical[0]/ow,aspectReviewRequired=deviation>0.25,overlayRequired=overlays,overlayGeometrySourcePixelsRelativeToCrop=geom,notes=notes,alphaExtrema=a.getextrema(),transparentPixels=a.histogram()[0],sha256=hashlib.sha256((R/(id+'.png')).read_bytes()).hexdigest()))
 assert np.array_equal(np.array(p),np.array(im.crop(box)))
 assert a.histogram()[0]>0
manifest=dict(version=1,status='generation-candidate-only; not integrated or runtime validated',generator='built-in image_gen',bboxRule='alpha >128 for QA bounds only. All original alpha retained; no masking/repainting/resizing.',count=len(frames),overlayPolicy='Existing runtime procedural hooks, beater, fan, door-gap, stock, status, labels and effects are explicitly reused. New bodies alone do not prove complete animated geometry. Integrator must calibrate overlay positions and occlusion before acceptance.',installedHookupState={'uninstalled':'hookup.png capped pipe/socket visible','installed':'hookup layer hidden; no blank PNG required','lockedRoom':'no equipment body rendered'},frames=frames)
(R/'renderer-manifest.json').write_text(json.dumps(manifest,indent=2))
(R/'validation.json').write_text(json.dumps({'totalBodies':18,'allLosslessSourceCrops':True,'allTransparent':True,'uniqueHashes':len(set(x['sha256'] for x in frames)),'runtimeValidated':False,'aspectReview':[x['id'] for x in frames if x['aspectReviewRequired']]},indent=2))
print([(x['id'],x['size'],x['aspectReviewRequired']) for x in frames])
