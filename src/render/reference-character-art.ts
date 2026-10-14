import type { Look } from '../game/state';
import type { CharacterFrames, Role } from './sprites';
import { applyCozyCharacter, clearCozyCharacters, preloadCozyCharacters } from './cozy-character-art';
import { batchCharactersReady, clearBatchCharacters, makeBatchCharacter, preloadBatchCharacters } from './cozy-cast-art';

type Point = Readonly<{x:number;y:number}>;
type Contacts = Readonly<{foot:Point;seatContact?:Point;petContact?:Point}>;
const ZERO=Object.freeze({x:0,y:0});
const cache=new Map<string,CharacterFrames>();
let contacts=new WeakMap<HTMLCanvasElement,Contacts>();
let pending:Promise<void>|null=null,generation=0,ready=false;
/** Publish the two approved examples and the complete new family atomically. */
export function preloadReferenceCharacters():Promise<void>{
 if(ready&&batchCharactersReady())return Promise.resolve();
 if(pending)return pending;const epoch=generation;
 pending=Promise.all([preloadCozyCharacters(),preloadBatchCharacters()]).then(()=>{if(epoch===generation)ready=true;}).catch(error=>{if(epoch===generation)pending=null;throw error;});
 return pending;
}
export function clearReferenceCharacters():void{
 generation++;ready=false;pending=null;clearCozyCharacters();clearBatchCharacters();cache.clear();contacts=new WeakMap();
}
export function referenceCharacterOffset(_frame:HTMLCanvasElement):Point{return ZERO;}
export function referenceCharacterContacts(frame:HTMLCanvasElement):Contacts|null{return contacts.get(frame)??null;}
export function resolveReferenceCharacter(look:Look,role:Role='customer',appearanceId?:number):CharacterFrames|null{
 if(!ready||!batchCharactersReady())return null;
 const key=['v4',role,look.skin,look.hair,look.hairStyle,look.shirt,look.pants,appearanceId??-1].join('.');
 const old=cache.get(key);if(old)return old;
 const result=makeBatchCharacter(look,role,appearanceId,(frame,points)=>contacts.set(frame,points));
 if(!result)return null;
 // Sample identities retain their authored walking and finished table-chair units.
 applyCozyCharacter(result,look,role,appearanceId,(frame,points)=>contacts.set(frame,points));
 cache.set(key,result);if(cache.size>160)cache.delete(cache.keys().next().value!);
 return result;
}
