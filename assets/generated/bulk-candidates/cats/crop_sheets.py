from pathlib import Path
from PIL import Image
from scipy import ndimage
import numpy as np,json,hashlib
ROOT=Path(__file__).parent
STATES=['idle','swish','blink','happy','walkA','walkB','sleep','groomA','groomB','stretch','watch','lookUp','nuzzleA','nuzzleB']
def crop_breed(breed,scale,anchors,qa=None):
    d=ROOT/breed; im=Image.open(d/'source.png').convert('RGBA'); a=np.array(im.getchannel('A')); labs,n=ndimage.label(a>128); objs=ndimage.find_objects(labs)
    comps=[]
    for i,s in enumerate(objs):
        count=int((labs[s]==i+1).sum())
        if count>5000:
            box=[s[1].start,s[0].start,s[1].stop,s[0].stop]
            comps.append((box,count))
    if len(comps)!=14:raise ValueError((breed,'expected14majorcomponents',len(comps),comps))
    comps.sort(key=lambda z:(min(3,int(((z[0][1]+z[0][3])/2)/im.height*4)),(z[0][0]+z[0][2])/2))
    frames=[]
    for state,(b,count),anchor in zip(STATES,comps,anchors):
        box=[max(0,b[0]-8),max(0,b[1]-8),min(im.width,b[2]+8),min(im.height,b[3]+8)]
        # Lossless rectangular crops may not include any neighbouring main silhouette.
        # Split short transparent gutters at their midpoint; never paint/mask pixels.
        for other,_ in comps:
            if other==b:continue
            if min(b[3],other[3])>max(b[1],other[1]):
                if other[2]<=b[0]:box[0]=max(box[0],(other[2]+b[0]+1)//2)
                if other[0]>=b[2]:box[2]=min(box[2],(b[2]+other[0])//2)
            if min(b[2],other[2])>max(b[0],other[0]):
                if other[3]<=b[1]:box[1]=max(box[1],(other[3]+b[1]+1)//2)
                if other[1]>=b[3]:box[3]=min(box[3],(b[3]+other[1])//2)
        p=im.crop(box); name=f'{breed}-{state}.png';p.save(d/name)
        pa=p.getchannel('A');pb=pa.point(lambda x:255 if x>128 else 0).getbbox();foot,head=anchor
        frames.append(dict(state=state,file=str(d/name),source='source.png',source_crop=box,size=list(p.size),bbox=dict(x=pb[0],y=pb[1],w=pb[2]-pb[0],h=pb[3]-pb[1]),foot=dict(x=foot[0]-box[0],y=foot[1]-box[1]),headContact=dict(x=head[0]-box[0],y=head[1]-box[1]),sourceToWorldScale=scale,alpha_extrema=pa.getextrema(),transparent_pixels=pa.histogram()[0],sha256=hashlib.sha256((d/name).read_bytes()).hexdigest()))
    manifest=dict(breed=breed,version=1,generator='built-in image_gen',sourceSheetDimensions=list(im.size),bboxAlphaThreshold='alpha > 128, excludes faint fringe; original alpha preserved in lossless crops',facingConvention={'walkA':'head-left','walkB':'head-left','other':'front-three-quarter slightly left; nuzzle head tilts independently'},scaleNote='One calibrated sourceToWorldScale for every frame from each source sheet. Estimated from common head width, never frame-height fit; runtime head/contact verification required.',anchorNote='Manually visually estimated grounded front-paw/support midpoint and crown/forehead between ears, not ear tips. Contact/flip verification remains runtime work.',qa=qa or {},frames=frames)
    (d/'renderer-manifest.json').write_text(json.dumps(manifest,indent=2));return manifest
if __name__=='__main__':
    import sys
    cfg=json.loads((ROOT/'crop_config.json').read_text())
    for b in sys.argv[1:] or cfg:
        m=crop_breed(b,**cfg[b]);print(b,[(f['state'],f['size']) for f in m['frames']])
