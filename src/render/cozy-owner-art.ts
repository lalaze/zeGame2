import type { Look } from '../game/state';
import type { CharacterFrames } from './sprites';
import { fineSpriteArt, registerFineSpriteArt } from './fine-sprite-art';
import { registerSeatingUnit, seatingFurniture } from './cozy-seating-art';

type Point={x:number;y:number};
type Spec={box:number[];neck:number[];hip?:number[];hand?:number[]};
type Pose=Spec&{canvas:HTMLCanvasElement;width:number;height:number};
type Manifest={walk:Spec[];seated:Spec[];heads:Spec[]};
type Contacts={foot:Point;headScale?:number;bodyScale?:number;seatContact?:Point;petContact?:Point};
const D=3, WORLD_SCALE=1.6;
const SKIN=['#f4cfad','#dfaa7d','#b67c55','#80533f'];
const HAIR=['#594237','#976546','#dfb96f','#b9674e','#626782','#cc8c9f'];
const CLOTH=['#bb6b58','#799ba7','#8ba477','#d3a453','#9b87af','#cf929e','#69a295','#e5d7ba'];
const PANTS=['#53637b','#85664f','#585464'];
let walk:Pose[]=[],seated:Pose[]=[],heads:Pose[]=[],pending:Promise<void>|null=null,epoch=0;
const canvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const mod=(n:number,l:number)=>((Math.trunc(n)%l)+l)%l;
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
function decode(image:HTMLImageElement,spec:Spec):Pose{
 const [x,y,r,b]=spec.box,c=canvas(r-x,b-y),ctx=c.getContext('2d')!;
 ctx.drawImage(image,x,y,r-x,b-y,0,0,r-x,b-y);
 const pixels=ctx.getImageData(0,0,c.width,c.height),d=pixels.data;
 for(let i=3;i<d.length;i+=4)if(d[i]<100)d[i]=0;
 // Atlas margins can contain a neighboring long hair tip. Keep this pose's connected silhouette.
 const seen=new Uint8Array(c.width*c.height);let largest:number[]=[];
 for(let n=0;n<seen.length;n++){if(seen[n]||!d[n*4+3])continue;const q=[n];seen[n]=1;
  for(let k=0;k<q.length;k++){const p=q[k],xx=p%c.width,yy=Math.floor(p/c.width);for(const v of [xx?p-1:-1,xx<c.width-1?p+1:-1,yy?p-c.width:-1,yy<c.height-1?p+c.width:-1])if(v>=0&&!seen[v]&&d[v*4+3]){seen[v]=1;q.push(v);}}
  if(q.length>largest.length)largest=q;
 }
 const keep=new Uint8Array(seen.length);largest.forEach(n=>keep[n]=1);for(let n=0;n<keep.length;n++)if(!keep[n])d[n*4+3]=0;
 ctx.putImageData(pixels,0,0);return {...spec,canvas:c,width:c.width,height:c.height};
}
export function clearCozyOwner(){epoch++;walk=[];seated=[];heads=[];pending=null;}
export function preloadCozyOwner():Promise<void>{
 if(walk.length===9&&seated.length===3&&heads.length===24)return Promise.resolve();if(pending)return pending;
 const generation=epoch,base=import.meta.env.BASE_URL+'art/generated/cozy-owner-v5/';
 pending=(async()=>{const response=await fetch(base+'manifest.json');if(!response.ok)throw Error('Missing redesigned owner manifest');
 const manifest:Manifest=await response.json();
 const load=async(name:string)=>{const image=new Image();image.src=base+name;await image.decode();return image;};
 const [w,s,h]=await Promise.all([load('walk.png'),load('seated.png'),load('heads.png')]);
 if(manifest.walk.length!==9||manifest.seated.length!==3||manifest.heads.length!==24)throw Error('Incomplete redesigned owner family');
 if(generation===epoch){walk=manifest.walk.map(p=>decode(w,p));seated=manifest.seated.map(p=>decode(s,p));heads=manifest.heads.map(p=>decode(h,p));}
 })().catch(error=>{if(generation===epoch)pending=null;throw error;});return pending;
}
function paintPalette(p:Pose,look:Look,isHead:boolean):HTMLCanvasElement{
 const c=canvas(p.width,p.height),ctx=c.getContext('2d')!;ctx.drawImage(p.canvas,0,0);
 const image=ctx.getImageData(0,0,c.width,c.height),d=image.data;
 const face=new Uint8Array(c.width*c.height);
 if(isHead){
  const nx=p.neck[0]-p.box[0],ny=p.neck[1]-p.box[1]-5;
  const candidate=(n:number)=>{const i=n*4,r=d[i],g=d[i+1],b=d[i+2];return d[i+3]>0&&r>150&&g>75&&b>30&&r-g>20&&g-b>10&&(r*.299+g*.587+b*.114)>112;};
  const seen=new Uint8Array(face.length);let mainFace:number[]=[];
  for(let at=0;at<face.length;at++){if(seen[at]||!candidate(at))continue;const q=[at];seen[at]=1;
   for(let k=0;k<q.length;k++){const n=q[k],x=n%c.width,y=Math.floor(n/c.width);for(const v of [x?n-1:-1,x<c.width-1?n+1:-1,y?n-c.width:-1,y<c.height-1?n+c.width:-1])if(v>=0&&!seen[v]&&candidate(v)){seen[v]=1;q.push(v);}}
   if(q.length>mainFace.length&&q.some(n=>Math.abs(n%c.width-nx)<45&&Math.floor(n/c.width)<ny-15&&Math.floor(n/c.width)>ny-100))mainFace=q;
  }
  mainFace.forEach(n=>face[n]=1);
  let seed=-1,distance=Infinity;
  for(let n=0;n<face.length;n++)if(candidate(n)){const dd=(n%c.width-nx)**2+(Math.floor(n/c.width)-ny)**2;if(dd<distance){seed=n;distance=dd;}}
  if(seed>=0){const q=[seed];face[seed]=1;for(let k=0;k<q.length;k++){const n=q[k],x=n%c.width,y=Math.floor(n/c.width);for(const v of [x?n-1:-1,x<c.width-1?n+1:-1,y?n-c.width:-1,y<c.height-1?n+c.width:-1])if(v>=0&&!face[v]&&candidate(v)){face[v]=1;q.push(v);}}}
 }
 const skin=rgb(SKIN[mod(look.skin,4)]),hair=rgb(HAIR[mod(look.hair,6)]),cloth=rgb(CLOTH[mod(look.shirt,8)]),pants=rgb(PANTS[mod(look.pants,3)]);
 for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;
  const r=d[i],g=d[i+1],b=d[i+2],y=Math.floor(i/4/c.width)/c.height,l=r*.299+g*.587+b*.114;
  let color:number[]|undefined,base=1;
  const skinPixel=r>145&&g>70&&r-g>60&&g-b>16&&r-g<150&&g-b<100;
  if(isHead){
   if(face[i/4]){color=skin;base=185;}
   else if(r>g*1.12&&g>b*1.06&&l>35){color=hair;base=93;}
  }else{
   if(r>g*1.14&&b>g*1.07&&y>.48){color=pants;base=59;}
   else if(g>r*.88&&g>b*1.12&&r<195&&y>.24&&y<.77){color=cloth;base=95;}
   else if(skinPixel&&l>135){color=skin;base=185;}
  }
  if(color){const light=Math.max(.35,Math.min(1.38,l/base));for(let k=0;k<3;k++)d[i+k]=Math.max(15,Math.min(250,Math.round(color[k]*light)));}
 }
 ctx.putImageData(image,0,0);return c;
}
function publish(art:HTMLCanvasElement){const c=canvas(art.width/D,art.height/D);c.getContext('2d')!.drawImage(art,0,0,c.width,c.height);registerFineSpriteArt(c,art,D);return c;}
/** One deliberately matched owner family, shared by every saved look and all UI/game consumers. */
export function makeCozyOwner(look:Look,setContacts:(frame:HTMLCanvasElement,points:Contacts)=>void):CharacterFrames|null{
 if(walk.length!==9||heads.length!==24||seated.length!==3)return null;
 const style=mod(look.hairStyle,8);
 const make=(index:number,sit=false,mirror=false)=>{
  const p=(sit?seated:walk)[index],w=sit?34:24,h=sit?42:34;
  const art=canvas(w*D,h*D),ctx=art.getContext('2d')!,person=canvas(w*D,h*D),pc=person.getContext('2d')!;
  const scale=sit?37/667:30/404;
  const neckX=p.neck[0]-p.box[0],neckY=p.neck[1]-p.box[1];
  const dx=sit?13-((p.hip?.[0]??p.neck[0])-p.box[0])*scale:12-neckX*scale;
  const dy=(sit?41:33)-p.height*scale;
  const point=(q:number[]):Point=>({x:dx+(q[0]-p.box[0])*scale,y:dy+(q[1]-p.box[1])*scale});
  const body=paintPalette(p,look,false),bodyCtx=body.getContext('2d')!;
  // Remove the source head only at its authored neck seam. Replacement heads belong to this same design.
  bodyCtx.clearRect(0,0,p.width,neckY-1);
  pc.imageSmoothingEnabled=true;pc.imageSmoothingQuality='high';pc.drawImage(body,dx*D,dy*D,p.width*scale*D,p.height*scale*D);
  const direction=sit||index>=6?2:index>=3?1:0,hp=heads[style*3+direction],head=paintPalette(hp,look,true);
  const hs=.075/(sit?1:WORLD_SCALE),neck=point(p.neck);
  pc.drawImage(head,(neck.x-(hp.neck[0]-hp.box[0])*hs)*D,(neck.y-(hp.neck[1]-hp.box[1])*hs+.35)*D,hp.width*hs*D,hp.height*hs*D);
  if(sit){const chair=seatingFurniture('chair');if(chair)ctx.drawImage(fineSpriteArt(chair).canvas,0,0,w*D,h*D);}
  ctx.drawImage(person,0,0);
  const foreground=canvas(w*D,h*D),fg=foreground.getContext('2d')!;
  if(sit){fg.drawImage(person,0,0);const cutoff=point(p.hip!).y+1;fg.clearRect(0,cutoff*D,w*D,(h-cutoff)*D);}
  const reflect=(source:HTMLCanvasElement)=>{if(!mirror)return source;const out=canvas(source.width,source.height),c=out.getContext('2d')!;c.translate(out.width,0);c.scale(-1,1);c.drawImage(source,0,0);return out;};
  const frame=publish(reflect(art)),flip=(q:Point):Point=>({x:mirror?w-q.x:q.x,y:q.y});
  const foot=flip({x:sit?13:12,y:sit?41:33});
  if(sit){const hip=flip(point(p.hip!)),petContact=index?flip(point(p.hand!)):undefined;
   registerSeatingUnit(frame,{foreground:publish(reflect(foreground)),floor:foot,hip,...(petContact?{petContact}:{})});
   setContacts(frame,{foot,headScale:.075,bodyScale:scale,seatContact:hip,...(petContact?{petContact}:{})});
  }else setContacts(frame,{foot,headScale:hs,bodyScale:scale});
  return frame;
 };
 const down=[0,1,2].map(i=>make(i)),up=[3,4,5].map(i=>make(i)),right=[6,7,8].map(i=>make(i)),left=[6,7,8].map(i=>make(i,false,true));
 return {down,up,right,left,stand:down[0],sitRight:make(0,true),sitLeft:make(0,true,true),sitPetRight:[make(1,true),make(2,true)],sitPetLeft:[make(1,true,true),make(2,true,true)]};
}
