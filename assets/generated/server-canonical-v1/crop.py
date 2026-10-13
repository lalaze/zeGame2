from PIL import Image
from pathlib import Path
import json,hashlib
r=Path(__file__).resolve().parent;im=Image.open(r/'server-source.png').convert('RGBA');out=[]
for row,d in enumerate(['down','up','right']):
 for col,f in enumerate(['stand','stepA','stepB']):
  cell=(col*418,[0,430,835][row],(col+1)*418,[430,835,1254][row]);p=im.crop(cell);b=p.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox();box=(max(cell[0],cell[0]+b[0]-10),max(cell[1],cell[1]+b[1]-10),min(cell[2],cell[0]+b[2]+10),min(cell[3],cell[1]+b[3]+10));p=im.crop(box);name=f'server-{d}-{f}.png';p.save(r/name);b=p.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox();a=p.getchannel('A');w,h=p.size;edge=max(a.crop(q).getextrema()[1] for q in [(0,0,w,1),(0,h-1,w,h),(0,0,1,h),(w-1,0,w,h)])
  out.append(dict(file=str(r/name),source=str(r/'server-source.png'),direction=d,state=f,frame={'stand':'stand','stepA':'stride','stepB':'passing'}[f],size=list(p.size),source_crop=list(box),bbox=dict(x=b[0],y=b[1],w=b[2]-b[0],h=b[3]-b[1]),foot=dict(x=(b[0]+b[2])/2,y=b[3]-1),alpha_extrema=list(a.getextrema()),edgeAlphaMax=edge,sha256=hashlib.sha256((r/name).read_bytes()).hexdigest(),status='candidate_source_checked_runtime_pending'))
scale=28/out[0]['bbox']['h']
for a in out:a['sourceToWorldScale']=scale
j=dict(identity='canonical-server-all-zero-only',role='server',look=dict(skin=0,hair=0,hairStyle=0,shirt=0,pants=0),exactLookOnly=True,frames=out,left='mirror right',bboxAlphaThreshold='alpha>128 measurement only; full RGBA crop retained',sourceToWorldScale=scale,logicalStandingHeight=28,anchorDefinition='Feet baseline midpoint, visually inferred using opaque body bounds; same source scale for all directions and poses. Validate ground-contact/stride in runtime.',status='candidate_source_checked_runtime_pending',notCovered='Any nonzero Look key; no all-staff/default/random identity replacement or parameterized coverage.',sourceGeneration='built-in image_gen edit using approved owner9 craft+legacy exact server Look reference',limitations=['Top-middle stride cell has6px bottom gutter and up frames5-7px top gutter; all opaque body pixels preserved.','Natural-shaded palette follows target hue identity, not exact flat per-pixel hex swatches.','Handheld trays/food must be runtime layers; no objects baked in.'])
(r/'renderer-manifest.json').write_text(json.dumps(j,indent=2))
assert len({a['sha256'] for a in out})==9
for a in out:
 p=Image.open(a['file']).convert('RGBA');assert p.tobytes()==im.crop(a['source_crop']).tobytes();assert a['alpha_extrema'][0]==0;assert a['edgeAlphaMax']<128
(r/'audit.json').write_text(json.dumps(dict(frames=9,uniqueImages=9,exactRGBAcrop=True,transparent=True,opaqueBodyNotClipped=True,edgeMax=max(a['edgeAlphaMax'] for a in out),visualChecks=['short dark-brown hair and light skin stable','cream shirt blue-grey apron/pants','bowtie only on front and right neck','all three backs show crossed straps/waist tie and no neck bowtie','distinct stand and opposing step poses','same source scale all nine'],runtimeValidated=False),indent=2));print([(a['direction'],a['state'],a['size'],a['edgeAlphaMax']) for a in out])
