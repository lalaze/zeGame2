import { CHARACTER_PROPORTIONS } from './character-proportions';
import { clearSeatingEnsemble, preloadSeatingEnsemble, seatingGeometry, seatingUnit } from './cozy-seating-art';
import type { Look } from '../game/state';
import type { CharacterFrames, Role } from './sprites';
import { registerFineSpriteArt } from './fine-sprite-art';

// An explicit preset, never a migration of the player's saved appearance.
export const COZY_OWNER_LOOK: Readonly<Look> = Object.freeze({skin:0,hair:0,hairStyle:1,shirt:2,pants:1});
type Pose = { source: HTMLCanvasElement; width: number; height: number };
export const COZY_GUEST_APPEARANCE_ID = 1;
const seatedGeometry = new WeakMap<HTMLCanvasElement, {hip:{x:number;y:number}; upperBody:number}>();
export function cozySeatedGeometry(frame:HTMLCanvasElement) { return seatedGeometry.get(frame); }
const sheets = new Map<'owner'|'guest', Pose[]>();
let pending: Promise<void> | null = null;
let epoch = 0;
function canvas(w:number,h:number) { const c=document.createElement('canvas');c.width=w;c.height=h;return c; }
export function isCozyOwner(look:Look,role:Role):boolean {
  return role==='owner' && (Object.keys(COZY_OWNER_LOOK) as (keyof Look)[]).every(key=>look[key]===COZY_OWNER_LOOK[key]);
}
export function clearCozyCharacters():void { epoch++;sheets.clear();clearSeatingEnsemble();pending=null; }
export function preloadCozyCharacters():Promise<void> {
  if(sheets.size===2)return preloadSeatingEnsemble();
  if(pending)return pending;
  const current=epoch;
  pending=(async()=>{
    await preloadSeatingEnsemble();
    const base=import.meta.env.BASE_URL+'art/generated/cozy-character-sample-v1/';
    const response=await fetch(base+'manifest.json');
    if(!response.ok)throw Error('Could not load cozy character manifest');
    const manifest=await response.json();
    const loaded=await Promise.all((['owner','guest'] as const).map(async key=>{
    const image=new Image();image.src=base+key+'.png';await image.decode();
    const bounds:unknown=manifest[key]?.bounds;
    if(!Array.isArray(bounds)||bounds.length!==15)throw Error('Invalid cozy character poses');
    const decoded=bounds.map((box:unknown)=>{
      if(!Array.isArray(box)||box.length!==4||!box.every(Number.isInteger))throw Error('Invalid cozy pose bounds');
      const [x,y,r,b]=box as number[];
      if(x<0||y<0||r<=x||b<=y||r>image.naturalWidth||b>image.naturalHeight)throw Error('Cozy pose outside atlas');
      const source=canvas(r-x,b-y),ctx=source.getContext('2d')!;
      ctx.drawImage(image,x,y,source.width,source.height,0,0,source.width,source.height);
      const pixels=ctx.getImageData(0,0,source.width,source.height);
      for(let p=3;p<pixels.data.length;p+=4)if(pixels.data[p]<100)pixels.data[p]=0;
      ctx.putImageData(pixels,0,0);return {source,width:source.width,height:source.height};
    });
    return [key,decoded] as const;
    }));
    if(current===epoch)for(const [key,decoded] of loaded)sheets.set(key,decoded);
  })().catch(error=>{if(current===epoch)pending=null;throw error;});
  return pending;
}
/** Paint approved art into newly-created frames before any consumer caches textures. */
type Contacts = { foot: {x:number;y:number}; seatContact?: {x:number;y:number}; petContact?: {x:number;y:number} };
export function applyCozyCharacter(frames:CharacterFrames,look:Look,role:Role,appearanceId:number|undefined,setContacts:(frame:HTMLCanvasElement,contacts:Contacts)=>void):void {
  const key=isCozyOwner(look,role)?'owner':role==='customer'&&appearanceId===COZY_GUEST_APPEARANCE_ID?'guest':null;
  const poses=key?sheets.get(key):null;
  if(!poses)return;
  const scale=Math.min(25/Math.max(...poses.slice(0,9).map(p=>p.height)),16/Math.max(...poses.slice(0,9).map(p=>p.width)));
  const paint=(target:HTMLCanvasElement,index:number,mirror=false)=>{
    const seated=index>=9,left=index>=12,pet=[10,11,13,14].includes(index);
    const redesigned=false;
    const p=poses[index];
    if(seated){target.width=24;target.height=34;}else{target.width=18;target.height=28;}
    const art=canvas(target.width*3,target.height*3),ctx=art.getContext('2d')!;
    ctx.imageSmoothingEnabled=false;
    // Match the sample's authored seated head/shoulder size before straight-leg extension.
    const fit=Math.min(scale*3*(seated?1.2:CHARACTER_PROPORTIONS.sampleUpperScale),(art.width-4)/p.width,(art.height-4)/p.height);
    const w=Math.round(p.width*fit),h=Math.round(p.height*fit);
    const hipX=redesigned?(left?.68:.32):(left?.65:.35),hipY=redesigned?.76:.79;
    const ax=seated?Math.round(art.width/2-w/2):Math.round(27-w/2);
    const ay=seated?3:81-h;
    const x=Math.max(2,Math.min(art.width-w-2,ax)),y=Math.max(2,Math.min(art.height-h-2,ay));
    if(mirror){ctx.translate(art.width,0);ctx.scale(-1,1);}
    ctx.drawImage(p.source,x,y,w,h);
    const logical=target.getContext('2d')!;logical.clearRect(0,0,target.width,target.height);
    logical.drawImage(art,0,0,target.width,target.height);registerFineSpriteArt(target,art,3);
    // Recompute geometry-dependent contacts instead of retaining the old atlas's pixels.
    const offsetX=pet?-2:0;
    const hip={x:(x+w*hipX)/3,y:(y+h*hipY)/3};
    if(seated)seatedGeometry.set(target,{hip,upperBody:(y+h*(redesigned?.65:.57))/3});
    setContacts(target,{
      foot:seated?{x:9-offsetX,y:(y+h)/3}:{x:9,y:27},
      ...(seated?{seatContact:hip}:{}),
      ...(pet?{petContact:{x:(x+w*(left?.08:.9))/3,y:(y+h*.78)/3}}:{}),
    });
  };
  frames.down.forEach((f,i)=>paint(f,i));frames.up.forEach((f,i)=>paint(f,i+3));
  frames.right.forEach((f,i)=>paint(f,i+6));frames.left.forEach((f,i)=>paint(f,i+6,true));
  // Sitting is authored together with its chair, on one registered floor baseline.
  const seatedFrame=(mirror:boolean,petFrame?:number)=>{
    const frame=seatingUnit(key!,mirror,petFrame)!;
    const geometry=seatingGeometry(frame)!;
    setContacts(frame,{foot:geometry.floor,seatContact:geometry.hip,...(geometry.petContact?{petContact:geometry.petContact}:{})});
    return frame;
  };
  frames.sitRight=seatedFrame(false);frames.sitLeft=seatedFrame(true);
  frames.sitPetRight=[seatedFrame(false,0),seatedFrame(false,1)];
  frames.sitPetLeft=[seatedFrame(true,0),seatedFrame(true,1)];
}
