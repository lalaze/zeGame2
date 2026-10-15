import { clearOwnerCompanion, makeOwnerCompanion, preloadOwnerCompanion } from './cozy-owner-companion-art';
import { CHARACTER_PROPORTIONS } from './character-proportions';
import { fineSpriteArt, registerFineSpriteArt } from './fine-sprite-art';
import type { Look } from '../game/state';
import type { CharacterFrames, Role } from './sprites';
import { applyCozyCharacter, clearCozyCharacters, preloadCozyCharacters } from './cozy-character-art';
import { batchCharactersReady, clearBatchCharacters, makeBatchCharacter, preloadBatchCharacters } from './cozy-cast-art';

type Point = Readonly<{x:number;y:number}>;
type Contacts = Readonly<{foot:Point;head?:Point;headScale?:number;bodyScale?:number;legStart?:number;legEnd?:number;legExtension?:number;seatContact?:Point;petContact?:Point}>;
export const STANDING_CHARACTER_SCALE = CHARACTER_PROPORTIONS.standingScale;
export const STANDING_LEG_EXTENSION = CHARACTER_PROPORTIONS.straightLegExtension;
const ZERO=Object.freeze({x:0,y:0});
const cache=new Map<string,CharacterFrames>();
let contacts=new WeakMap<HTMLCanvasElement,Contacts>();
let pending:Promise<void>|null=null,generation=0,ready=false;
/** Publish the two approved examples and the complete new family atomically. */
export function preloadReferenceCharacters():Promise<void>{
 if(ready&&batchCharactersReady())return Promise.resolve();
 if(pending)return pending;const epoch=generation;
 pending=Promise.all([preloadCozyCharacters(),preloadBatchCharacters(),preloadOwnerCompanion()]).then(()=>{if(epoch===generation)ready=true;}).catch(error=>{if(epoch===generation)pending=null;throw error;});
 return pending;
}
export function clearReferenceCharacters():void{
 generation++;ready=false;pending=null;clearCozyCharacters();clearBatchCharacters();clearOwnerCompanion();cache.clear();contacts=new WeakMap();
}
export function referenceCharacterOffset(_frame:HTMLCanvasElement):Point{return ZERO;}
export function referenceCharacterContacts(frame:HTMLCanvasElement):Contacts|null{return contacts.get(frame)??null;}
export function resolveReferenceCharacter(look:Look,role:Role='customer',appearanceId?:number):CharacterFrames|null{
 if(!ready||!batchCharactersReady())return null;
 const key=['v4',role,look.skin,look.hair,look.hairStyle,look.shirt,look.pants,appearanceId??-1].join('.');
 const old=cache.get(key);if(old)return old;
 const result=role==='owner'?makeOwnerCompanion(look,(frame,points)=>contacts.set(frame,points)):makeBatchCharacter(look,role,appearanceId,(frame,points)=>contacts.set(frame,points));
 if(!result)return null;
 // Sample identities retain their authored walking and finished table-chair units.
 if(role!=='owner')applyCozyCharacter(result,look,role,appearanceId,(frame,points)=>contacts.set(frame,points));
 // Match the room's furniture scale without resizing the authored seated-chair units.
 const enlarged=new Map<HTMLCanvasElement,HTMLCanvasElement>();
 const standing=(frame:HTMLCanvasElement)=>{
  const old=enlarged.get(frame);if(old)return old;
  const scale=STANDING_CHARACTER_SCALE,source=fineSpriteArt(frame),density=source.density;
  const point=contacts.get(frame);
  const foot=point?.foot ?? {x:frame.width/2,y:frame.height-1};
  // Standing legs include the thigh and shin; sitting units bend the thigh onto the cushion.
  // Extend only below the hip, never the head, torso, furniture or simulation position.
  const hipY=point?.legStart??foot.y-6,ankleY=point?.legEnd??foot.y-2.5;
  // Owner and companion use the same scene normalization; owner contacts keep the apron above the trouser-only extension.
  // The staff atlas already has longer trouser legs than the owner/customer art.
  // Keep the server's head and torso unchanged while matching their standing height.
  const legExtension=role==='server'?3:STANDING_LEG_EXTENSION;
  const target=document.createElement('canvas');target.width=Math.ceil(frame.width*scale);target.height=Math.ceil(frame.height*scale+legExtension);
  const art=document.createElement('canvas');art.width=target.width*density;art.height=target.height*density;
  const ctx=art.getContext('2d')!;ctx.imageSmoothingEnabled=false;
  const cut=hipY*density,ankle=ankleY*density;
  ctx.drawImage(source.canvas,0,0,source.canvas.width,cut,0,0,frame.width*scale*density,cut*scale);
  ctx.drawImage(source.canvas,0,cut,source.canvas.width,ankle-cut,0,cut*scale,frame.width*scale*density,(ankle-cut)*scale+legExtension*density);
  ctx.drawImage(source.canvas,0,ankle,source.canvas.width,source.canvas.height-ankle,0,ankle*scale+legExtension*density,frame.width*scale*density,(source.canvas.height-ankle)*scale);
  target.getContext('2d')!.drawImage(art,0,0,target.width,target.height);registerFineSpriteArt(target,art,density);
  const pixels=ctx.getImageData(0,0,art.width,art.height).data;
  let headY=0;while(headY<art.height&&!pixels.subarray(headY*art.width*4,(headY+1)*art.width*4).some((v,i)=>i%4===3&&v>100))headY++;
  if(point)contacts.set(target,{legExtension,...(point.headScale?{headScale:point.headScale*scale}:{}),...(point.bodyScale?{bodyScale:point.bodyScale*scale}:{}),foot:{x:foot.x*scale,y:foot.y*scale+legExtension},head:{x:foot.x*scale,y:headY/density}});
  enlarged.set(frame,target);return target;
 };
 result.down=result.down.map(standing);result.up=result.up.map(standing);
 result.left=result.left.map(standing);result.right=result.right.map(standing);result.stand=standing(result.stand);
 cache.set(key,result);if(cache.size>160)cache.delete(cache.keys().next().value!);
 return result;
}
