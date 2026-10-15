import runtimeSignature from '../../assets/generated/runtime-catalog-v1/signature.json';
import { COZY_SIGNATURE_VESSELS } from './cozy-signature-registration';
import { BASE_INGREDIENT, SIGNATURE_ADDONS, signatureDefinition, type SignatureBase, type SignatureDefinition } from '../game/signature-drinks';
import type { IngredientId } from '../game/data';
import { registerFineSpriteArt } from './fine-sprite-art';

export const GENERATED_SIGNATURE_IDS = ['cup-coffee','cup-tea','cup-milk','cup-fruit','liquid-coffee','liquid-tea','liquid-milk','liquid-fruit','topping-sugar','topping-spice','topping-cocoa','topping-cream','topping-fruit','topping-matcha'] as const;
export type GeneratedSignatureId = typeof GENERATED_SIGNATURE_IDS[number];
export type GeneratedSignatureSources = Readonly<Partial<Record<GeneratedSignatureId, CanvasImageSource>>>;
export const generatedSignatureKey = (id: GeneratedSignatureId) => `signature-${id}` as const;
export const GENERATED_SIGNATURE_ASSETS = Object.fromEntries(GENERATED_SIGNATURE_IDS.map(id => [generatedSignatureKey(id), `catalog-v1/signature/${id}.png`])) as Record<`signature-${GeneratedSignatureId}`,string>;
type Vessel = { size: readonly [number,number]; rim: readonly [number,number,number,number]; body?: readonly (readonly [number,number])[] };
/** Explicit proposed source-local geometry, not color-derived masks. Requires rendered visual review. */
export const SIGNATURE_VESSELS: Readonly<Record<SignatureBase,Vessel>> = COZY_SIGNATURE_VESSELS;
const META: Record<GeneratedSignatureId,{size:readonly[number,number];anchor:readonly[number,number];width:number}> = {
 'cup-coffee':{size:[415,369],anchor:[221,336],width:368},'cup-tea':{size:[357,369],anchor:[183,331],width:332},
 'cup-milk':{size:[250,374],anchor:[118,353],width:220},'cup-fruit':{size:[310,374],anchor:[150.5,357],width:241},
 'liquid-coffee':{size:[368,199],anchor:[195.5,102.5],width:313},'liquid-tea':{size:[336,199],anchor:[168,102],width:308},
 'liquid-milk':{size:[336,199],anchor:[163.5,100.5],width:303},'liquid-fruit':{size:[340,199],anchor:[162,100.5],width:308},
 'topping-sugar':{size:[315,214],anchor:[156,210],width:250},'topping-spice':{size:[311,214],anchor:[150,209],width:280},
 'topping-cocoa':{size:[327,224],anchor:[162,207],width:264},'topping-cream':{size:[361,274],anchor:[181,241],width:318},
 'topping-fruit':{size:[320,265],anchor:[144,224],width:264},'topping-matcha':{size:[351,239],anchor:[168.5,194],width:323},
};
const COLORS: Partial<Record<IngredientId,string>> = {beans:'#70472f',tea:'#b78042',milk:'#f4e6c7',sugar:'#fff5dc',spice:'#a1683f',cocoa:'#69402e',cream:'#f9eaca',fruit:'#bb6258',matcha:'#627451'};
export interface GeneratedSignatureAdapter { readonly ready: boolean; readonly readyIds: readonly GeneratedSignatureId[]; canvas(id:string,density?:number,compact?:boolean):HTMLCanvasElement|undefined }
let installed: GeneratedSignatureAdapter|null=null;
export const setGeneratedSignatureAdapter=(adapter:GeneratedSignatureAdapter|null):void=>{installed=adapter;};
export const getGeneratedSignatureAdapter=():GeneratedSignatureAdapter|null=>installed;
function dimensions(source:CanvasImageSource):[number,number] {
 const s=source as unknown as {complete?:boolean;naturalWidth?:number;naturalHeight?:number;width?:number;height?:number};
 if(s.complete===false)return [0,0];
 if(s.naturalWidth!==undefined||s.naturalHeight!==undefined)return [s.naturalWidth??0,s.naturalHeight??0];
 return [s.width??0,s.height??0];
}
export function signatureRequiredLayers(def:SignatureDefinition):GeneratedSignatureId[] {
 return [`cup-${def.base}`,`liquid-${def.base}`,...SIGNATURE_ADDONS.filter(id=>id!==BASE_INGREDIENT[def.base]&&id!=='milk'&&def.recipe[id]).map(id=>`topping-${id}`)] as GeneratedSignatureId[];
}
/** Only this small, bounded set of runtime rasters is retained. Each recipe bakes lazily once.
 * Milk is a native liquid band, never the unrelated peaked milk-foam candidate.
 * Sugar/spice represent grouped portion garnishes, not literal object counts.
 */
export function createGeneratedSignatureArt(sources:GeneratedSignatureSources,options:{createCanvas?:()=>HTMLCanvasElement}={}):GeneratedSignatureAdapter {
 const make=options.createCanvas??(()=>document.createElement('canvas'));
 const available=new Map<GeneratedSignatureId,CanvasImageSource>();
 for(const id of GENERATED_SIGNATURE_IDS){
  const source=sources[id],meta=runtimeSignature[id];if(!source||!meta)continue;const size=dimensions(source);
  // Runtime-only contract: reject originals, CSS-sized failures and stale exports.
  // Ceil canvas padding is not painted content. Export metadata owns the scale.
  if(size.every((n,i)=>Number.isFinite(n)&&n>0&&n===meta.size[i])&&meta.originalSize.every((n,i)=>n===META[id].size[i])&&meta.productionContentSize.every((n,i)=>n>0&&n<=meta.size[i]&&Math.abs(n-meta.originalSize[i]*meta.scale)<1e-7))available.set(id,source);
 }
 const readyIds=Object.freeze([...available.keys()]);const cache=new Map<string,HTMLCanvasElement>();const failed=new Set<string>();
 const allocate=(n:number)=>{const c=make();c.width=n;c.height=n;const ctx=c.getContext('2d');if(!ctx)throw Error('Missing signature canvas context');ctx.imageSmoothingEnabled=false;return {c,ctx};};
 function render(def:SignatureDefinition,n:number):HTMLCanvasElement {
  const {c,ctx}=allocate(n);const unit=n/18,v=SIGNATURE_VESSELS[def.base],s=Math.min(16/v.size[0],12/v.size[1]);
  const ox=9-v.size[0]*s/2,oy=15.8-v.size[1]*s; const [cx,cy,rx,ry]=v.rim;
  ctx.save();ctx.scale(unit*s,unit*s);ctx.translate(ox/s,oy/s);
  const ellipse=()=>{ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);};
  const image=(id:GeneratedSignatureId,x:number,y:number,scale:number)=>{const m=META[id],src=available.get(id)!;const content=runtimeSignature[id].productionContentSize;ctx.drawImage(src,0,0,content[0],content[1],x,y,m.size[0]*scale,m.size[1]*scale);};
  ctx.save();ellipse();if(v.body){ctx.moveTo(...v.body[0]);for(const p of v.body.slice(1))ctx.lineTo(...p);ctx.closePath();}ctx.clip();
  ctx.fillStyle=COLORS[BASE_INGREDIENT[def.base]]!;ctx.fillRect(0,0,...v.size);
  const milk=def.base==='milk'?0:def.recipe.milk??0;if(milk){ctx.fillStyle=COLORS.milk!;ctx.fillRect(cx-rx,cy+ry+65-milk*15,rx*2,35+milk*15);}
  if(def.recipe[BASE_INGREDIENT[def.base]]===2){ctx.fillStyle={coffee:'#493124',tea:'#90603a',milk:'#c9b799',fruit:'#ad5e52'}[def.base];ctx.fillRect(cx-rx,cy+ry+55,rx*2,14);}
  ctx.restore();
  ctx.save();ellipse();ctx.clip();const liquid=`liquid-${def.base}` as GeneratedSignatureId,lm=META[liquid],ls=rx*2/lm.width;image(liquid,cx-lm.anchor[0]*ls,cy-lm.anchor[1]*ls,ls);
  // Liquid milk remains visible even in opaque ceramic vessels. This is a native
  // quantity-driven surface band, not the peaked foam source or a recolored bitmap.
  if(milk){ctx.fillStyle=COLORS.milk!;ctx.fillRect(cx-rx,cy+ry*.16,rx*2,ry*(.22+milk*.16));}
  ctx.restore();
  image(`cup-${def.base}`,0,0,1);
  // Surface coatings first, standing garnishes last. Lower garnish portions sit inside the aperture.
  for(const key of ['matcha','cocoa','cream','sugar','spice','fruit'] as const){if(key===BASE_INGREDIENT[def.base]||!def.recipe[key])continue;
   const id=`topping-${key}` as GeneratedSignatureId,m=META[id],dose=def.recipe[key]!;
   const width=rx*2*({matcha:.78,cocoa:.63,cream:dose===2?.9:.68,sugar:.36,spice:.52,fruit:.46}[key]);const gs=width/m.width;
   const dx=key==='sugar'?-rx*.37:key==='fruit'?rx*.46:key==='spice'?rx*.35:0;
   const by=key==='matcha'||key==='cocoa'?cy+ry*.5:cy+ry*.15;
   image(id,cx+dx-m.anchor[0]*gs,by-m.anchor[1]*gs,gs);
  }
  ctx.restore();
  // Fixed ingredient slots survive native 18px reduction and keep all recipe IDs distinct.
  // Each row is one actual portion; no claim that the grouped garnish counts objects.
  SIGNATURE_ADDONS.forEach((key,i)=>{if(key===BASE_INGREDIENT[def.base])return;for(let d=0;d<(def.recipe[key]??0);d++){ctx.fillStyle=COLORS[key]!;ctx.fillRect((1+i*2)*unit,(16+d)*unit,unit,unit);}});
  for(let d=0;d<(def.recipe[BASE_INGREDIENT[def.base]]??0);d++){ctx.fillStyle=COLORS[BASE_INGREDIENT[def.base]]!;ctx.fillRect(16*unit,(16+d)*unit,unit,unit);}
  return c;
 }
 return Object.freeze({ready:readyIds.length>0,readyIds,canvas(id:string,density=1,compact=false){
  const def=signatureDefinition(id);if(!def||signatureRequiredLayers(def).some(id=>!available.has(id)))return undefined;
  const scale=Number.isFinite(density)?Math.max(1,Math.min(16,Math.floor(density))):1;const key=`${def.id}.${scale}.${compact}`;
  if(failed.has(key))return undefined;const prior=cache.get(key);if(prior)return prior;
  try{const n=compact?18:32*scale,backing=render(def,n*4),{c,ctx}=allocate(n);ctx.drawImage(backing,0,0,n,n);registerFineSpriteArt(c,backing,4);cache.set(key,c);return c;}catch{failed.add(key);return undefined;}
 }});
}
