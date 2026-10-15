import type { Look } from '../game/state';
import type { CharacterFrames } from './sprites';
import { CHARACTER_PROPORTIONS } from './character-proportions';
import { registerFineSpriteArt } from './fine-sprite-art';
import { registerSeatingUnit } from './cozy-seating-art';

type Point={x:number;y:number};
type Pose={canvas:HTMLCanvasElement;width:number;height:number;groupHeight?:number};
type Manifest={families:{file:string;bounds:number[][]}[];seated?:{file:string;bounds:number[][]}[]};
type Contacts={foot:Point;headScale?:number;bodyScale?:number;legStart?:number;legEnd?:number;seatContact?:Point;petContact?:Point};
const D=3;
const SKIN=['#f4cfad','#dfaa7d','#b67c55','#80533f'],HAIR=['#594237','#976546','#dfb96f','#b9674e','#626782','#cc8c9f'];
const CLOTH=['#bb6b58','#799ba7','#8ba477','#d3a453','#9b87af','#cf929e','#69a295','#e5d7ba'],PANTS=['#53637b','#85664f','#585464'];
let families:Pose[][]=[],sits:Pose[]=[],pending:Promise<void>|null=null,epoch=0;
const canvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const mod=(n:number,l:number)=>((Math.trunc(n)%l)+l)%l;
const rgb=(h:string)=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
function decode(image:HTMLImageElement,box:number[]):Pose{
 const [x,y,r,b]=box,c=canvas(r-x,b-y),ctx=c.getContext('2d')!;ctx.drawImage(image,x,y,c.width,c.height,0,0,c.width,c.height);
 const p=ctx.getImageData(0,0,c.width,c.height);for(let i=3;i<p.data.length;i+=4)if(p.data[i]<100)p.data[i]=0;ctx.putImageData(p,0,0);return {canvas:c,width:c.width,height:c.height};
}
export function clearOwnerCompanion(){epoch++;families=[];sits=[];pending=null;}
export function preloadOwnerCompanion():Promise<void>{
 if(families.length===8)return Promise.resolve();if(pending)return pending;
 const generation=epoch,base=import.meta.env.BASE_URL+'art/generated/cozy-owner-v6/';
 pending=(async()=>{const response=await fetch(base+'manifest.json');if(!response.ok)throw Error('Missing matched owner manifest');const m:Manifest=await response.json();
 if(m.families.length!==8||m.families.some(f=>f.bounds.length!==15)||m.seated?.length!==2||m.seated.some(g=>g.bounds.length!==12))throw Error('Incomplete matched owner poses');
 const load=async(file:string)=>{const i=new Image();i.src=base+file;await i.decode();return i;};
 const frames=await Promise.all(m.families.map(async f=>{const image=await load(f.file);return f.bounds.map(b=>decode(image,b));}));
 const seated=await Promise.all((m.seated??[]).map(async group=>{const image=await load(group.file),groupHeight=Math.max(...group.bounds.map(b=>b[3]-b[1]));return group.bounds.map(b=>({...decode(image,b),groupHeight}));}));
 if(generation===epoch){families=frames;sits=seated.flat();}
 })().catch(e=>{if(generation===epoch)pending=null;throw e;});return pending;
}
function palette(p:Pose,look:Look,sit=false):HTMLCanvasElement{
 const c=canvas(p.width,p.height),ctx=c.getContext('2d')!;ctx.drawImage(p.canvas,0,0);const image=ctx.getImageData(0,0,c.width,c.height),d=image.data;
 const skin=rgb(SKIN[mod(look.skin,4)]),hair=rgb(HAIR[mod(look.hair,6)]),cloth=rgb(CLOTH[mod(look.shirt,8)]),pants=rgb(PANTS[mod(look.pants,3)]);
 for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const r=d[i],g=d[i+1],b=d[i+2],x=(i/4%c.width)/c.width,y=Math.floor(i/4/c.width)/c.height,l=r*.299+g*.587+b*.114;let color:number[]|undefined,base=1;
  // Chair wood/cushion stay source-authored. Palette masks apply only to this owner.
  const furniture=sit&&((y>.35&&x<.34)||(y>.72&&x<.61))&&((r>g*1.25&&g>b*1.35)||(g>r*1.1));
  if(furniture)continue;
  if(!sit&&y>.72&&y<.93&&r>g&&g>b&&g>90&&g/r>.70&&b/r>.42){color=pants;base=190;}
  else if(r>185&&g>105&&b>60&&r-g>35&&g-b>20&&r-g<130){color=skin;base=205;}
  else if(y<(sit?.51:.62)&&r>g*1.15&&g>b*1.12&&l>40){color=hair;base=90;}
  else if(g>r*.88&&g>b*1.2&&r<190&&y>(sit?.30:.39)&&y<(sit?.73:.82)){color=cloth;base=91;}
  else if(!sit&&y>.68&&y<.92&&r>g&&g>b&&g>95&&g/r>.72&&b/r>.44){color=pants;base=190;}
  else if(sit&&y>.54&&y<.89&&x>.34&&r>g*1.06&&g>b*1.08&&g/r>.60&&b/r>.32&&b/r<.66){color=pants;base=76;}
  if(color){const light=Math.max(.40,Math.min(1.32,l/base));for(let k=0;k<3;k++)d[i+k]=Math.max(15,Math.min(250,Math.round(color[k]*light)));}
 }
 ctx.putImageData(image,0,0);return c;
}
function publish(a:HTMLCanvasElement){const c=canvas(a.width/D,a.height/D);c.getContext('2d')!.drawImage(a,0,0,c.width,c.height);registerFineSpriteArt(c,a,D);return c;}
function mirrored(a:HTMLCanvasElement){const c=canvas(a.width,a.height),x=c.getContext('2d')!;x.translate(c.width,0);x.scale(-1,1);x.drawImage(a,0,0);return c;}
/** Whole authored figures, in the same visual family and normalization as the companion customer. */
export function makeOwnerCompanion(look:Look,set:(c:HTMLCanvasElement,p:Contacts)=>void):CharacterFrames|null{
 if(families.length!==8||sits.length!==24)return null;const style=mod(look.hairStyle,8),poses=families[style];
 const scale=Math.min(25/Math.max(...poses.slice(0,9).map(p=>p.height)),16/Math.max(...poses.slice(0,9).map(p=>p.width)))*CHARACTER_PROPORTIONS.sampleUpperScale;
 const make=(index:number,mirror=false)=>{const p=poses[index],a=canvas(18*D,28*D),x=a.getContext('2d')!,w=p.width*scale*D,h=p.height*scale*D;
  x.imageSmoothingEnabled=false;x.drawImage(palette(p,look),27-w/2,81-h,w,h);const frame=publish(mirror?mirrored(a):a);
  set(frame,{foot:{x:9,y:27},headScale:scale,bodyScale:scale,legStart:23.6,legEnd:25.2});return frame;};
 const seat=(index:number,mirror=false)=>{
  const p=sits[style*3+index],scale=37/(p.groupHeight??p.height),a=canvas(34*D,42*D),x=a.getContext('2d')!;
  const dx=Math.min(13-p.width*.32*scale,33-p.width*scale),dy=41-p.height*scale;x.imageSmoothingEnabled=false;x.drawImage(palette(p,look,true),dx*D,dy*D,p.width*scale*D,p.height*scale*D);
  const seatX=dx+p.width*.32*scale,hip={x:seatX,y:dy+p.height*.64*scale};
  const pixels=p.canvas.getContext('2d')!.getImageData(0,0,p.width,p.height).data;let tipX=p.width*.80,tipY=p.height*.58;
  for(let yy=Math.floor(p.height*.40);yy<p.height*.78;yy++)for(let xx=Math.floor(p.width*.55);xx<p.width;xx++){const i=(yy*p.width+xx)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];if(pixels[i+3]>100&&r>185&&g>105&&b>60&&r-g>35&&g-b>20&&xx>=tipX){tipX=xx;tipY=yy;}}
  const hand={x:dx+tipX*scale,y:dy+tipY*scale},neck={x:dx+p.width*.52*scale,y:dy+p.height*.38*scale};
  const front=canvas(34*D,42*D),f=front.getContext('2d')!;f.scale(D,D);f.beginPath();f.moveTo(neck.x-7,0);f.lineTo(34,0);f.lineTo(34,hand.y+1.5);f.lineTo(neck.x+3,hand.y+1.5);f.lineTo(neck.x-4,neck.y+2);f.lineTo(neck.x-7,neck.y);f.closePath();f.clip();f.drawImage(a,0,0,34,42);
  const frame=publish(mirror?mirrored(a):a),flip=(q:Point)=>({x:mirror?34-q.x:q.x,y:q.y}),floor=flip({x:seatX,y:41}),pet=index?flip(hand):undefined;
  registerSeatingUnit(frame,{foreground:publish(mirror?mirrored(front):front),floor,hip:flip(hip),...(pet?{petContact:pet}:{})});
  set(frame,{foot:floor,seatContact:flip(hip),headScale:scale,bodyScale:scale,...(pet?{petContact:pet}:{})});return frame;
 };
 const down=[0,1,2].map(i=>make(i)),up=[3,4,5].map(i=>make(i)),right=[6,7,8].map(i=>make(i)),left=[6,7,8].map(i=>make(i,true));
 return {down,up,right,left,stand:down[0],sitRight:seat(0),sitLeft:seat(0,true),sitPetRight:[seat(1),seat(2)],sitPetLeft:[seat(1,true),seat(2,true)]};
}
