import { CHARACTER_PROPORTIONS } from './character-proportions';
import type { Look } from '../game/state';
import { CUSTOMER_CAST } from '../game/customer-cast';
import type { CharacterFrames, Role } from './sprites';
import { registerFineSpriteArt } from './fine-sprite-art';
import { registerSeatingUnit } from './cozy-seating-art';

type Point = {x:number;y:number};
type Box = [number,number,number,number];
type PoseMeta = {box:Box;file?:string;head?:number[];hip?:number[];cushion?:number[];hand?:number[];neck?:number[];eye?:number[]|null};
type Pose = PoseMeta & {source:HTMLCanvasElement;width:number;height:number};
type Manifest = {families:Record<string,{file:string;poses:PoseMeta[]}>;heads:{file:string;poses:PoseMeta[]}};
type Contacts = {foot:Point;headScale?:number;bodyScale?:number;seatContact?:Point;petContact?:Point};
const D=3;
const SKIN=['#f4cfad','#dfaa7d','#b67c55','#80533f'];
const HAIR=['#594237','#976546','#dfb96f','#b9674e','#626782','#cc8c9f'];
const CLOTH=['#bb6b58','#799ba7','#8ba477','#d3a453','#9b87af','#cf929e','#69a295','#e5d7ba'];
const PANTS=['#53637b','#85664f','#585464'];
const families=new Map<string,Pose[]>();let heads:Pose[]=[];
let pending:Promise<void>|null=null,epoch=0;
function canvas(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const mod=(n:number,l:number)=>((Math.trunc(n)%l)+l)%l;
function decode(image:HTMLImageElement,p:PoseMeta,isHead=false):Pose{
 const [x,y,r,b]=p.box;if(x<0||y<0||r<=x||b<=y||r>image.naturalWidth||b>image.naturalHeight)throw Error('Batch pose outside atlas');
 const source=canvas(r-x,b-y),ctx=source.getContext('2d')!;ctx.drawImage(image,x,y,r-x,b-y,0,0,r-x,b-y);
 const pixels=ctx.getImageData(0,0,source.width,source.height),a=pixels.data;
 for(let n=3;n<a.length;n+=4)if(a[n]<100)a[n]=0;
 if(isHead){
  // Keep the head's connected silhouette when neighboring irregular rows overlap a crop corner.
  const w=source.width,h=source.height,seen=new Uint8Array(w*h);let largest:number[]=[];
  for(let i=0;i<w*h;i++){if(seen[i]||!a[i*4+3])continue;const q=[i];seen[i]=1;
   for(let j=0;j<q.length;j++){const n=q[j],xx=n%w,yy=Math.floor(n/w);for(const v of [xx>0?n-1:-1,xx<w-1?n+1:-1,yy>0?n-w:-1,yy<h-1?n+w:-1])if(v>=0&&!seen[v]&&a[v*4+3]){seen[v]=1;q.push(v);}}
   if(q.length>largest.length)largest=q;
  }
  const keep=new Uint8Array(w*h);largest.forEach(i=>keep[i]=1);for(let i=0;i<w*h;i++)if(!keep[i])a[i*4+3]=0;
 }
 ctx.putImageData(pixels,0,0);return {...p,source,width:source.width,height:source.height};
}
export function clearBatchCharacters(){epoch++;families.clear();heads=[];pending=null;}
export function batchCharactersReady(){return families.size===12&&heads.length===24;}
export function preloadBatchCharacters():Promise<void>{
 if(batchCharactersReady())return Promise.resolve();if(pending)return pending;const generation=epoch;
 pending=(async()=>{const base=import.meta.env.BASE_URL+'art/generated/cozy-cast-v4/';
  const response=await fetch(base+'manifest.json');if(!response.ok)throw Error('Missing batch character manifest');const manifest:Manifest=await response.json();
  const entries=Object.entries(manifest.families);if(entries.length!==12||manifest.heads.poses.length!==24)throw Error('Incomplete batch character family');
  const load=async(file:string)=>{const image=new Image();image.src=base+file;await image.decode();return image;};
  const result=await Promise.all(entries.map(async([name,item])=>{if(item.poses.length!==12)throw Error('Missing batch poses');const names=[...new Set([item.file,...item.poses.map(p=>p.file??item.file)])];const images=new Map(await Promise.all(names.map(async file=>[file,await load(file)] as const)));return [name,item.poses.map(p=>decode(images.get(p.file??item.file)!,p))] as const;}));
  const headImage=await load(manifest.heads.file),decodedHeads=manifest.heads.poses.map(p=>decode(headImage,p,true));
  if(generation===epoch){result.forEach(([name,poses])=>families.set(name,poses));heads=decodedHeads;}
 })().catch(error=>{if(generation===epoch)pending=null;throw error;});return pending;
}
// Mask only visible furniture; hidden chair pixels behind the source head cannot be recovered.
function furnitureMask(p:Pose,data:Uint8ClampedArray):Uint8Array{
 const {width:w,height:h}=p,mask=new Uint8Array(w*h);
 const neckX=p.head?p.head[0]-p.box[0]:w*.55;
 const cushionY=p.cushion?p.cushion[1]-p.box[1]:h*.72;
 const handX=p.hand?p.hand[0]-p.box[0]:w*.87,handY=p.hand?p.hand[1]-p.box[1]:h*.61;
 const nearHand=(x:number,y:number)=>((x-handX)/(w*.13))**2+((y-handY)/(h*.07))**2<1;
 for(let n=0;n<w*h;n++){
  const i=n*4,x=n%w,y=Math.floor(n/w),r=data[i],g=data[i+1],b=data[i+2];
  // Above the cushion, chair wood is left of the person. Below it, protect legs too.
  if(data[i+3]&&y>=h*.25&&!nearHand(x,y)&&(y>cushionY||x<neckX-w*.12)&&r>g&&g>b&&r-b>35&&b<r*.45&&(g-b)/(r-b)>.38)mask[n]=1;
 }
 const core=mask.slice();
 // Retain the source's narrow dark furniture outline without growing through hair.
 for(let n=0;n<w*h;n++){
  if(core[n]||!data[n*4+3]||Math.floor(n/w)<h*.25)continue;
  const i=n*4;if(data[i]>125||data[i+1]>105||data[i+2]>90)continue;
  const x=n%w,y=Math.floor(n/w);if(nearHand(x,y))continue;let found=false;
  for(let yy=Math.max(0,y-2);yy<=Math.min(h-1,y+2)&&!found;yy++)
   for(let xx=Math.max(0,x-2);xx<=Math.min(w-1,x+2);xx++)if(core[yy*w+xx]){found=true;break;}
  if(found)mask[n]=1;
 }
 return mask;
}
function headSkinMask(p:Pose,data:Uint8ClampedArray):Uint8Array{
 const w=p.width,h=p.height,seen=new Uint8Array(w*h),mask=new Uint8Array(w*h);
 const candidate=(n:number)=>{const i=n*4,r=data[i],g=data[i+1],b=data[i+2];return data[i+3]>0&&r>190&&g>140&&b>85&&r-g<95&&g-b<95;};
 let largest:number[]=[];
 const anchor=p.eye??p.neck!,ax=anchor[0]-p.box[0],ay=anchor[1]-p.box[1];
 const rx=p.eye?w*.20:w*.12,ry=p.eye?h*.14:h*.055;
 for(let n=0;n<w*h;n++){
  if(seen[n]||!candidate(n))continue;const q=[n];seen[n]=1;
  for(let k=0;k<q.length;k++){
   const at=q[k],x=at%w,y=Math.floor(at/w);
   for(const v of [x?at-1:-1,x<w-1?at+1:-1,y?at-w:-1,y<h-1?at+w:-1])
    if(v>=0&&!seen[v]&&candidate(v)){seen[v]=1;q.push(v);}
  }
  // The face (or exposed neck in back views) is the largest pale-skin island.
  // Isolated pale highlights in the brown hair must follow the hair color instead.
  if(q.length>largest.length&&q.some(n=>Math.abs(n%w-ax)<rx&&Math.abs(Math.floor(n/w)-ay)<ry))largest=q;
 }
 largest.forEach(n=>mask[n]=1);return mask;
}
function removeSourceHead(p:Pose,body:HTMLCanvasElement,seated:boolean,neckY:number):void{
 const ctx=body.getContext('2d')!;
 if(!seated){ctx.clearRect(0,0,p.width,neckY+1);return;}
 const original=p.source.getContext('2d')!.getImageData(0,0,p.width,p.height).data;
 const keep=furnitureMask(p,original),pixels=ctx.getImageData(0,0,p.width,p.height);
 for(let y=0;y<Math.min(p.height,Math.ceil(neckY+1));y++)for(let x=0;x<p.width;x++){
  const n=y*p.width+x;if(!keep[n])pixels.data[n*4+3]=0;
 }
 ctx.putImageData(pixels,0,0);
}
function recolour(p:Pose,look:Look,role:Role,head:boolean,seated:boolean):HTMLCanvasElement{
 const target=canvas(p.width,p.height),ctx=target.getContext('2d')!;ctx.drawImage(p.source,0,0);const img=ctx.getImageData(0,0,p.width,p.height),d=img.data;
 const furniture=seated?furnitureMask(p,d):null,face=head?headSkinMask(p,d):null;
 const cushionY=p.cushion?p.cushion[1]-p.box[1]:p.height*.72;
 const skin=rgb(SKIN[mod(look.skin,4)]),hair=rgb(HAIR[mod(look.hair,6)]),cloth=rgb(role==='barista'?'#74805a':role==='server'?'#657f88':role==='cook'?'#a76e52':CLOTH[mod(look.shirt,8)]),pants=rgb(PANTS[mod(look.pants,3)]);
 for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const r=d[i],g=d[i+1],b=d[i+2],x=(i/4%p.width)/p.width,y=Math.floor(i/4/p.width)/p.height;let color:number[]|undefined,base=1;
  if(head){
   if(face![i/4]){color=skin;base=205;}
   else if(r>g*1.12&&g>b*1.08&&r>45){color=hair;base=96;}
  }else if(!furniture?.[i/4]){
   // Explicit blue garment and purple trouser source channels exclude green upholstery and orange wood.
   if(r>g*1.12&&b>g*1.12&&b>r*.74){color=pants;base=81;}
   else if(b>r*1.12&&b>g*1.04){color=cloth;base=92;}
   else if((!seated||(x>.42&&y*p.height<cushionY-3))&&r>195&&g>135&&b>85&&r-g<100&&g-b<95){color=skin;base=205;}
  }
  if(color){const light=Math.max(.48,Math.min(1.35,(r*.299+g*.587+b*.114)/base));for(let c=0;c<3;c++)d[i+c]=Math.max(18,Math.min(250,Math.round(color[c]*light)));}
 }
 ctx.putImageData(img,0,0);return target;
}
function publish(art:HTMLCanvasElement):HTMLCanvasElement{const frame=canvas(art.width/D,art.height/D);frame.getContext('2d')!.drawImage(art,0,0,frame.width,frame.height);registerFineSpriteArt(frame,art,D);return frame;}
export function makeBatchCharacter(look:Look,role:Role,appearanceId:number|undefined,setContacts:(frame:HTMLCanvasElement,points:Contacts)=>void):CharacterFrames|null{
 if(!batchCharactersReady())return null;
 const design=role==='customer'&&Number.isInteger(appearanceId)?CUSTOMER_CAST[appearanceId!]:undefined;
 const family=role==='cook'?'chef':role!=='customer'?'staff':design?.outfit??'cardigan';
 const poses=families.get(family)!;const style=mod(design?.hairstyle??look.hairStyle,8);
 const walkScale=Math.min(25/Math.max(...poses.slice(0,9).map(p=>p.height)),17/Math.max(...poses.slice(0,9).map(p=>p.width)));
 const sitScale=Math.min(37/Math.max(...poses.slice(9).map(p=>p.height)),29/Math.max(...poses.slice(9).map(p=>p.width)));
 const make=(index:number,mirror=false):HTMLCanvasElement=>{
  const p=poses[index],seated=index>=9,pet=index>=10,back=index>=3&&index<6,right=index>=6;
  const w=seated?34:24,h=seated?42:28,art=canvas(w*D,h*D),ctx=art.getContext('2d')!;
  const scale=seated?sitScale:walkScale;
  const headScale=CHARACTER_PROPORTIONS.headSize/(seated?1:CHARACTER_PROPORTIONS.standingScale)/150;
  const cushionX=p.cushion?(p.cushion[0]-p.box[0])-p.width*.03:p.width*.36;
  const dx=seated?13-cushionX*scale:12-p.width*scale/2,dy=(seated?41:27)-p.height*scale;
  const point=(q:number[]):Point=>({x:dx+(q[0]-p.box[0])*scale,y:dy+(q[1]-p.box[1])*scale});
  const body=recolour(p,look,role,false,seated);
  const neckY=seated&&p.head?p.head[1]-p.box[1]+p.height*.16:p.height*(seated?.405:.455);
  const neckX=p.head?p.head[0]-p.box[0]:p.width*(right?.55:.5);
  if(role!=='cook')removeSourceHead(p,body,seated,neckY);
  ctx.imageSmoothingEnabled=false;ctx.drawImage(body,dx*D,dy*D,p.width*scale*D,p.height*scale*D);
  const foreground=canvas(w*D,h*D),fg=foreground.getContext('2d')!;
  let collarY=neckY;
  if(role==='owner'&&!seated){
   // Anchor the replacement neck to the actual opaque collar, not a guessed crop percentage.
   const pixels=body.getContext('2d')!.getImageData(0,0,p.width,p.height).data;
   const cx=Math.round(neckX),radius=Math.max(2,Math.round(p.width*.055));
   for(let y=Math.floor(neckY);y<Math.min(p.height,neckY+p.height*.15);y++){
    let ink=0;for(let x=Math.max(0,cx-radius);x<=Math.min(p.width-1,cx+radius);x++)if(pixels[(y*p.width+x)*4+3]>100)ink++;
    if(ink>=radius){collarY=y+2;break;}
   }
  }
  const neck={x:dx+neckX*scale,y:dy+collarY*scale};
  const hand=p.hand?point(p.hand):{x:dx+p.width*scale*.87,y:dy+p.height*scale*.61};
  if(seated){
   fg.save();fg.setTransform(D,0,0,D,0,0);fg.beginPath();fg.moveTo(neck.x-5,neck.y-1);fg.lineTo(w,neck.y-1);fg.lineTo(w,hand.y+2);
   fg.lineTo(neck.x+2,Math.max(neck.y+7,hand.y+1));fg.lineTo(neck.x-5,neck.y+6);fg.closePath();
   fg.clip();fg.setTransform(1,0,0,1,0,0);fg.drawImage(art,0,0);fg.restore();
  }
  if(role!=='cook'){
   const hp=heads[style*3+(back?1:right?2:0)],head=recolour(hp,look,role,true,false);
   // The standing frame is published at 1.6x; its head must equal the seated head in world units.
   const hs=headScale;
   const hx=neck.x-(hp.neck![0]-hp.box[0])*hs,hy=neck.y-(hp.neck![1]-hp.box[1])*hs;
   ctx.drawImage(head,hx*D,hy*D,hp.width*hs*D,hp.height*hs*D);
   if(seated)fg.drawImage(head,hx*D,hy*D,hp.width*hs*D,hp.height*hs*D);
  }
  const accessory=(c:CanvasRenderingContext2D)=>{
   if(!design||back)return;c.save();c.scale(D,D);c.fillStyle=design.accent;c.strokeStyle='#554338';c.lineWidth=.6;
   const headFactor=seated?1:CHARACTER_PROPORTIONS.headSize/(11.7*CHARACTER_PROPORTIONS.standingScale);
   const faceX=neck.x+(right?2:0)*headFactor,faceY=neck.y-3.7*headFactor;
   if(design.accessory==='glasses'){c.strokeRect(faceX-2.7*headFactor,faceY,2.5*headFactor,1.9*headFactor);if(!right)c.strokeRect(faceX+.5*headFactor,faceY,2.5*headFactor,1.9*headFactor);}
   if(design.accessory==='bow'){c.fillRect(neck.x-5*headFactor,neck.y-9*headFactor,3.4*headFactor,1.8*headFactor);c.fillRect(neck.x-4*headFactor,neck.y-9.5*headFactor,1.4*headFactor,2.8*headFactor);}
   if(design.accessory==='headband'){c.fillRect(neck.x-4.8*headFactor,neck.y-9*headFactor,8*headFactor,.8*headFactor);}
   if(design.accessory==='satchel'){c.strokeStyle=design.accent;c.lineWidth=.8;c.beginPath();c.moveTo(neck.x-2,neck.y+1);c.lineTo(neck.x+3,neck.y+9);c.stroke();c.fillRect(neck.x+1,neck.y+7,4,3);}
   c.restore();
  };accessory(ctx);if(seated)accessory(fg);
  let final=art,front=foreground;const mirrored=(source:HTMLCanvasElement)=>{const c=canvas(source.width,source.height),x=c.getContext('2d')!;x.translate(c.width,0);x.scale(-1,1);x.drawImage(source,0,0);return c;};
  if(mirror){final=mirrored(art);front=mirrored(foreground);}
  const frame=publish(final),flip=(q:Point)=>({x:mirror?w-q.x:q.x,y:q.y});
  if(seated){
   const floor=flip({x:13,y:41}),hip=flip(p.hip?point(p.hip):{x:13,y:27}),petContact=pet?flip(hand):undefined;
   registerSeatingUnit(frame,{foreground:publish(front),floor,hip,...(petContact?{petContact}:{})});
   setContacts(frame,{foot:floor,headScale,bodyScale:scale,seatContact:hip,...(petContact?{petContact}:{})});
  }else setContacts(frame,{foot:{x:12,y:27},headScale,bodyScale:scale});
  return frame;
 };
 const down=[0,1,2].map(i=>make(i)),up=[3,4,5].map(i=>make(i)),right=[6,7,8].map(i=>make(i)),left=[6,7,8].map(i=>make(i,true));
 return {down,up,right,left,stand:down[0],sitRight:make(9),sitLeft:make(9,true),sitPetRight:[make(10),make(11)],sitPetLeft:[make(10,true),make(11,true)]};
}

