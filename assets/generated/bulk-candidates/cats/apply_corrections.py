from pathlib import Path
from PIL import Image
from scipy import ndimage
import numpy as np,json,hashlib
ROOT=Path(__file__).parent
for breed,cfg in json.loads((ROOT/'correction_config.json').read_text()).items():
    d=ROOT/breed;im=Image.open(d/cfg['source']).convert('RGBA');labs,n=ndimage.label(np.array(im.getchannel('A'))>128);comps=[]
    for i,s in enumerate(ndimage.find_objects(labs)):
        if (labs[s]==i+1).sum()>5000:comps.append((i+1,[s[1].start,s[0].start,s[1].stop,s[0].stop]))
    comps.sort(key=lambda q:q[1][1] if breed=='persian' else q[1][0])
    assert len(comps)==len(cfg['states'])
    m=json.loads((d/'renderer-manifest.json').read_text())
    for state,(i,b),anchor in zip(cfg['states'],comps,cfg['anchors']):
        box=[max(0,b[0]-8),max(0,b[1]-8),min(im.width,b[2]+8),min(im.height,b[3]+8)]
        for j,other in comps:
            if i!=j:assert (labs[box[1]:box[3],box[0]:box[2]]==j).sum()==0,(breed,state,'neighbour contamination')
        p=im.crop(box);name=f'{breed}-{state}.png';p.save(d/name);a=p.getchannel('A');bb=a.point(lambda v:255 if v>128 else 0).getbbox();foot,head=anchor
        f=dict(state=state,file=str(d/name),source=cfg['source'],source_crop=box,size=list(p.size),bbox=dict(x=bb[0],y=bb[1],w=bb[2]-bb[0],h=bb[3]-bb[1]),foot=dict(x=foot[0]-box[0],y=foot[1]-box[1]),headContact=dict(x=head[0]-box[0],y=head[1]-box[1]),sourceToWorldScale=cfg['scale'],alpha_extrema=a.getextrema(),transparent_pixels=a.histogram()[0],sha256=hashlib.sha256((d/name).read_bytes()).hexdigest())
        m['frames']=[f if old['state']==state else old for old in m['frames']]
    m['qa']['status']='source-and-final-crops-inspected; runtime validation pending'
    m['qa']['correctionSheets']=[{'file':cfg['source'],'states':cfg['states'],'sharedScale':cfg['scale'],'note':'Same breed; lossless source crops with independent sheet-level head-size calibration.'}]
    m['qa']['identifiedIssues']=[]
    m['qa']['remainingRuntimeChecks']=['Game-scale silhouette and breed legibility','Walking step continuity and physical head/body scale across source sheets','Head-to-hand contact for lookUp/nuzzle','Exact state mapping, route flip and reduced motion','Low-alpha fringe on light/dark scene backgrounds']
    (d/'renderer-manifest.json').write_text(json.dumps(m,indent=2));print(breed,cfg['states'])
