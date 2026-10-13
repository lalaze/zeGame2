import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { MENU, INGREDIENTS, UPGRADES } from '../game/data';
import { CUSTOMER_CAST } from '../game/customer-cast';
import { CATS } from '../game/pets';
import { REGULAR_GUESTS } from '../game/regular-guests-content';
import { character, catFrames, itemIcon, itemArtwork, ingredientIcon, upgradeIcon } from './sprites';
import { menuMiniatureGrid, ingredientMiniatureGrid } from './menu-miniatures';
import { signatureRecipeGrid, signatureDrinkIcon, signatureDrinkCanvas } from './signature-drink-art';
import { BASE_INGREDIENT, SIGNATURE_BASES, SIGNATURE_ADDONS, makeSignatureId, signatureDefinition, type SignatureRecipe } from '../game/signature-drinks';

class RasterCanvas {
  width=0; height=0; pixels=new Map<string,string>();
  getContext(){const c=this;let tx=0,sx=1;return {fillStyle:'',imageSmoothingEnabled:false,
    fillRect(x:number,y:number,w:number,h:number){expect([x,y,w,h].every(Number.isInteger)).toBe(true);for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){expect(xx>=0&&yy>=0&&xx<c.width&&yy<c.height,`pixel overflow ${xx},${yy} / ${c.width},${c.height}`).toBe(true);c.pixels.set(`${xx},${yy}`,this.fillStyle);}},
    translate(x:number){tx+=x;},scale(x:number){sx*=x;},
    drawImage(source:RasterCanvas){for(const [key,color]of source.pixels){const [x,y]=key.split(',').map(Number);if(y<c.height)c.pixels.set(`${sx===-1?tx-x-1:tx+x},${y}`,color);}},
  };}
}
const pixels=(c:HTMLCanvasElement)=>(c as unknown as RasterCanvas).pixels;
const signature=(c:HTMLCanvasElement)=>[...pixels(c)].sort().join('|');
const create=vi.fn(()=>new RasterCanvas());
beforeAll(()=>vi.stubGlobal('document',{createElement:create}));afterAll(()=>vi.unstubAllGlobals());

describe('Warm Pixel A complete sprite redraw',()=>{
 it('authors every menu identity with material details at native and export density',()=>{
   expect(MENU).toHaveLength(55);const native=new Set(),large=new Set();for(const item of MENU){const master=menuMiniatureGrid(item.id);expect(new Set(master.cells.filter(Boolean)).size,item.id).toBeGreaterThanOrEqual(4);native.add(signature(itemIcon(item.id)));large.add(signature(itemArtwork(item.id)));}expect(native.size).toBe(55);expect(large.size).toBe(55);
 });
 it('redraws all twelve ingredient identities and six upgrade icons',()=>{const unique=new Set();for(const item of INGREDIENTS){expect(ingredientMiniatureGrid(item.id).cells.filter(Boolean).length).toBeGreaterThan(100);unique.add(signature(ingredientIcon(item.id)));}expect(unique.size).toBe(12);expect(new Set(UPGRADES.map(u=>signature(upgradeIcon(u.id)))).size).toBe(6);});
 it('keeps all twelve named regular guests inside the distinct thirty-person cast',()=>{expect(REGULAR_GUESTS).toHaveLength(12);const faces=REGULAR_GUESTS.map(g=>{const d=CUSTOMER_CAST[g.appearanceId];expect(d).toBeDefined();return signature(character(d.look,'customer',d.id).stand);});expect(new Set(faces).size).toBe(12);});
 it('gives raised cat poses broad shoulders and side haunches rather than repeated neck rows',()=>{
   for(const cat of CATS)for(const frame of [catFrames(cat.id).lookUp,...catFrames(cat.id).nuzzle]){
     const shoulder=[...pixels(frame).keys()].map(key=>key.split(',').map(Number)).filter(([,y])=>y===10).map(([x])=>x);
     expect(Math.max(...shoulder)-Math.min(...shoulder)+1,cat.id).toBeGreaterThanOrEqual(12);
   }
 });
 it('never consumes the gameplay random stream while drawing new assets',()=>{const random=vi.spyOn(Math,'random');MENU.forEach(item=>itemArtwork(item.id));CATS.forEach(cat=>catFrames(cat.id));CUSTOMER_CAST.forEach(d=>character(d.look,'customer',d.id));expect(random).not.toHaveBeenCalled();random.mockRestore();});
 it('composes all valid recipe and dosage combinations into deterministic prepared-drink art',()=>{
   const counts:Record<string,number>={};const all=new Set<string>(),artworks=new Set<string>(),nativeArtworks=new Set<string>();
   for(const base of SIGNATURE_BASES){counts[base]=0;const additions=SIGNATURE_ADDONS.filter(key=>key!==BASE_INGREDIENT[base]);
     for(let primary=1;primary<=2;primary++)for(let encoded=0;encoded<3**additions.length;encoded++){
       const recipe:SignatureRecipe={[BASE_INGREDIENT[base]]:primary};let digits=encoded;
       for(const key of additions){const n=digits%3;digits=Math.floor(digits/3);if(n)recipe[key]=n;}
       const id=makeSignatureId(base,recipe);if(!id)continue;const def=signatureDefinition(id)!;const g=signatureRecipeGrid(def);
       expect(g.cells.filter(Boolean).length,id).toBeGreaterThan(190);expect(g.cells).toEqual(signatureRecipeGrid(def).cells);counts[base]++;all.add(id);artworks.add(g.cells.join('|'));nativeArtworks.add(signature(signatureDrinkIcon(id)));
     }
     const id=makeSignatureId(base,{[BASE_INGREDIENT[base]]:2,milk:base==='milk'?2:1,sugar:1})!;
     const icon=signatureDrinkIcon(id),art=signatureDrinkCanvas(id,3);expect([icon.width,icon.height]).toEqual([18,18]);expect([art.width,art.height]).toEqual([96,96]);expect(signatureDrinkIcon(id)).toBe(icon);expect(signatureDrinkCanvas(id,3)).toBe(art);
   }
   expect(artworks.size).toBe(all.size);expect(nativeArtworks.size).toBe(all.size);expect(Object.values(counts).every(n=>n>100)).toBe(true);expect(all.size).toBe(Object.values(counts).reduce((a,b)=>a+b,0));
   if(process.env.ART_RASTER_EVIDENCE)writeFileSync('/tmp/sprite-signature-counts.json',JSON.stringify(counts));
 });
 it('keeps one versus two cream doses readable in the native 18px order icon',()=>{
   const one=signatureDrinkIcon('sig:coffee:beans=1,cream=1');const two=signatureDrinkIcon('sig:coffee:beans=1,cream=2');
   expect([one.width,one.height,two.width,two.height]).toEqual([18,18,18,18]);expect(signature(one)).not.toBe(signature(two));
   // Distinct cream silhouette above the rim plus a second dose drop below.
   const topping=(canvas:HTMLCanvasElement)=>[...pixels(canvas)].filter(([key])=>Number(key.split(',')[1])<=4).sort().join('|');
   expect(topping(one)).not.toBe(topping(two));expect(pixels(one).has('4,16')).toBe(false);expect(pixels(two).get('4,16')).toBe('#f9eaca');
 });
 it('caches staff portrait upgrades as well as equipment icons',()=>{for(const upgrade of UPGRADES){const first=upgradeIcon(upgrade.id);expect(upgradeIcon(upgrade.id)).toBe(first);}});
 it.runIf(!!process.env.ART_RASTER_EVIDENCE)('writes production raster evidence on request',()=>{
  const assets: {group:string;id:string;width:number;height:number;pixels:[string,string][]}[]=[];
  const add=(group:string,id:string,c:HTMLCanvasElement)=>assets.push({group,id,width:c.width,height:c.height,pixels:[...pixels(c)]});
  for(const role of ['owner','barista','server','cook'] as const)add('staff',role,character({skin:0,hair:0,hairStyle:1,shirt:2,pants:1},role).stand);
  for(const d of CUSTOMER_CAST)add('cast',String(d.id)+' '+d.name,character(d.look,'customer',d.id).stand);
  for(const cat of CATS){const f=catFrames(cat.id);for(const [pose,c]of Object.entries(f)){if(Array.isArray(c))c.forEach((frame,i)=>add('cats',`${cat.id}.${pose}.${i}`,frame));else add('cats',`${cat.id}.${pose}`,c as HTMLCanvasElement);}}
  for(const it of MENU){add('icon',it.id,itemIcon(it.id));add('menu',it.id,itemArtwork(it.id));}
  for(const ing of INGREDIENTS)add('ingredient',ing.id,ingredientIcon(ing.id));
  for(const u of UPGRADES)add('upgrade',u.id,upgradeIcon(u.id));
  for(const [base,recipe] of [
    ['coffee',{beans:1}],['coffee',{beans:2,milk:1,sugar:1}],['coffee',{beans:1,cream:2,cocoa:1}],['coffee',{beans:1,milk:2,spice:1}],
    ['tea',{tea:1}],['tea',{tea:2,milk:1,spice:1}],['tea',{tea:1,fruit:2,sugar:1}],['tea',{tea:1,matcha:1,cream:2}],
    ['milk',{milk:1}],['milk',{milk:2,cocoa:1,cream:1}],['milk',{milk:1,matcha:2,sugar:1}],['milk',{milk:1,fruit:2,cream:1}],
    ['fruit',{fruit:1}],['fruit',{fruit:2,milk:1,sugar:1}],['fruit',{fruit:1,cream:2,spice:1}],['fruit',{fruit:1,matcha:1,sugar:2}],
  ] as const){const id=makeSignatureId(base,recipe)!;add('signature-icon',id,signatureDrinkIcon(id));add('signature',id,signatureDrinkCanvas(id,3));}
  writeFileSync(process.env.ART_RASTER_EVIDENCE!,JSON.stringify(assets));
 });
});
