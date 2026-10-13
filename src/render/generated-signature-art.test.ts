import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BASE_INGREDIENT, SIGNATURE_ADDONS, SIGNATURE_BASES, makeSignatureId, signatureDefinition, type SignatureRecipe } from '../game/signature-drinks';
import { createGeneratedSignatureArt, GENERATED_SIGNATURE_IDS, setGeneratedSignatureAdapter, signatureRequiredLayers, type GeneratedSignatureSources } from './generated-signature-art';
import { signatureDrinkCanvas, signatureDrinkIcon } from './signature-drink-art';
import { itemIcon, itemArtwork } from './sprites';
import { fineSpriteArt } from './fine-sprite-art';
import { clearGeneratedMainAssets } from './generated-main-art';
const require=createRequire(import.meta.url);
// Optional official authoring dependency, also used by pack-runtime-catalog.cjs.
// These tests are visibly skipped when the native raster engine is unavailable.
let native: {createCanvas:(w:number,h:number)=>HTMLCanvasElement;loadImage:(path:string)=>Promise<CanvasImageSource>}|undefined;
try { native=require('@napi-rs/canvas'); } catch { /* No implicit installation. */ }
const make=()=>native!.createCanvas(1,1);
const pixels=(c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;
const hash=(c:HTMLCanvasElement)=>createHash('sha256').update(pixels(c)).digest('hex');
let sources:GeneratedSignatureSources;
beforeAll(async()=>{if(native)sources=Object.fromEntries(await Promise.all(GENERATED_SIGNATURE_IDS.map(async id=>[id,await native!.loadImage(`public/art/generated/catalog-v1/signature/${id}.png`)])));});
afterEach(()=>{setGeneratedSignatureAdapter(null);vi.unstubAllGlobals();});
describe.skipIf(!native)('real PNG signature composition',()=>{
 it('keeps exact size, stable cache, fine backing and whole-recipe fallback',()=>{
  const adapter=createGeneratedSignatureArt(sources,{createCanvas:make});setGeneratedSignatureAdapter(adapter);
  const id='sig:coffee:beans=1,cream=2';const c=signatureDrinkIcon(id);expect([c.width,c.height]).toEqual([18,18]);expect(signatureDrinkIcon(id)).toBe(c);
  expect(signatureDrinkCanvas(id,3).width).toBe(96);expect(fineSpriteArt(c).canvas.width).toBe(72);
  const partial=createGeneratedSignatureArt({...sources,'topping-cream':undefined},{createCanvas:make});
  expect(partial.canvas(id)).toBeUndefined();expect(partial.canvas('sig:coffee:beans=1')).toBeDefined();
  expect(partial.canvas('sig:coffee:beans=1,fruit=1')).toBeUndefined();
  expect(createGeneratedSignatureArt({...sources,'cup-coffee':{complete:false,width:100,height:100} as unknown as CanvasImageSource},{createCanvas:make}).canvas('sig:coffee:beans=1')).toBeUndefined();
  expect(createGeneratedSignatureArt({...sources,'cup-coffee':{naturalWidth:0,naturalHeight:0,width:100,height:100} as unknown as CanvasImageSource},{createCanvas:make}).canvas('sig:coffee:beans=1')).toBeUndefined();
  clearGeneratedMainAssets();expect(partial.canvas(id)).toBeUndefined();
 });
 it('rejects full originals and mismatched rasters instead of silently sampling the top-left',async()=>{
  const original=await native!.loadImage('assets/generated/bulk-candidates/ui/cup-coffee.png');
  const wrong=createGeneratedSignatureArt({...sources,'cup-coffee':original},{createCanvas:make});
  expect(wrong.readyIds).not.toContain('cup-coffee');expect(wrong.canvas('sig:coffee:beans=1')).toBeUndefined();
  const stale=createGeneratedSignatureArt({...sources,'liquid-coffee':native!.createCanvas(127,70)},{createCanvas:make});
  expect(stale.readyIds).not.toContain('liquid-coffee');expect(stale.canvas('sig:coffee:beans=1')).toBeUndefined();
  expect(createGeneratedSignatureArt(sources,{createCanvas:make}).canvas('sig:coffee:beans=1')).toBeDefined();
 });
 it('switches missing-to-loaded and loaded-to-reset without stale icon or artwork cache hits',()=>{
  vi.stubGlobal('document',{createElement:make});const id='sig:tea:milk=1,spice=1,tea=2' as const;
  setGeneratedSignatureAdapter(createGeneratedSignatureArt({},{createCanvas:make}));
  const legacyIcon=itemIcon(id),legacyArt=itemArtwork(id);
  const loaded=createGeneratedSignatureArt(sources,{createCanvas:make});setGeneratedSignatureAdapter(loaded);
  const icon=itemIcon(id),art=itemArtwork(id);
  expect(icon).not.toBe(legacyIcon);expect(art).not.toBe(legacyArt);expect(icon).toBe(loaded.canvas(id,1,true));expect(art).toBe(loaded.canvas(id,3));
  expect(fineSpriteArt(icon).logicalWidth).toBe(18);expect(fineSpriteArt(art).logicalWidth).toBe(96);
  clearGeneratedMainAssets();expect(itemIcon(id)).toBe(legacyIcon);expect(itemArtwork(id)).toBe(legacyArt);
  const second=createGeneratedSignatureArt(sources,{createCanvas:make});setGeneratedSignatureAdapter(second);
  expect(itemIcon(id)).not.toBe(icon);expect(itemArtwork(id)).not.toBe(art);
 });
 it('preserves simulation input, random stream and transparent exterior while filling glass bodies',()=>{
  const a=createGeneratedSignatureArt(sources,{createCanvas:make}),random=vi.spyOn(Math,'random');
  for(const base of ['tea','milk','fruit'] as const){const id=makeSignatureId(base,{[BASE_INGREDIENT[base]]:1})!,def=signatureDefinition(id)!,before=JSON.stringify(def);
   const c=a.canvas(id,3)!,ctx=c.getContext('2d')!;
   expect(ctx.getImageData(48,50,1,1).data[3],base).toBeGreaterThan(240);
   expect(ctx.getImageData(0,0,1,1).data[3]).toBe(0);expect(JSON.stringify(def)).toBe(before);
  }expect(random).not.toHaveBeenCalled();random.mockRestore();
  const missing=createGeneratedSignatureArt(sources,{createCanvas:()=>{throw Error('unavailable');}});expect(missing.canvas('sig:coffee:beans=1')).toBeUndefined();
 });
 it('keeps every valid recipe distinct in actual 18px and 32px pixels',()=>{
  const a=createGeneratedSignatureArt(sources,{createCanvas:make});const nativeHashes=new Set<string>(),artHashes=new Set<string>();let count=0;
  for(const base of SIGNATURE_BASES){const additions=SIGNATURE_ADDONS.filter(k=>k!==BASE_INGREDIENT[base]);for(let primary=1;primary<=2;primary++)for(let code=0;code<3**additions.length;code++){
   const recipe:SignatureRecipe={[BASE_INGREDIENT[base]]:primary};let digits=code;for(const k of additions){const dose=digits%3;digits=Math.floor(digits/3);if(dose)recipe[k]=dose;}
   const id=makeSignatureId(base,recipe);if(!id)continue;const c=a.canvas(id,1,true)!,art=a.canvas(id)!;expect(c,id).toBeDefined();expect(art,id).toBeDefined();
   const h=hash(c);expect(nativeHashes.has(h),id).toBe(false);nativeHashes.add(h);artHashes.add(hash(art));count++;
  }}expect(nativeHashes.size).toBe(count);expect(artHashes.size).toBe(count);expect(count).toBeGreaterThan(500);if(process.env.SIGNATURE_RASTER_EVIDENCE){mkdirSync(process.env.SIGNATURE_RASTER_EVIDENCE,{recursive:true});writeFileSync(`${process.env.SIGNATURE_RASTER_EVIDENCE}/unique-count.json`,JSON.stringify({validRecipes:count,nativeUnique:nativeHashes.size,artUnique:artHashes.size}));}
 },120000);
 it('renders the 26-case acceptance matrix at 18, 32 and 96 with real alpha',()=>{
  const a=createGeneratedSignatureArt(sources,{createCanvas:make});const ids:string[]=[];
  for(const base of SIGNATURE_BASES)for(const dose of [1,2])ids.push(makeSignatureId(base,{[BASE_INGREDIENT[base]]:dose})!);
  for(const addon of SIGNATURE_ADDONS)for(const dose of [1,2]){const base=addon==='milk'?'coffee':'milk';ids.push(makeSignatureId(base,{[BASE_INGREDIENT[base]]:1,[addon]:dose})!);}
  ids.push(makeSignatureId('coffee',{beans:2,milk:1,cocoa:1,cream:2})!,makeSignatureId('tea',{tea:2,milk:1,matcha:1,cream:2})!,makeSignatureId('milk',{milk:2,fruit:1,sugar:1,cream:2})!,makeSignatureId('fruit',{fruit:2,milk:1,spice:1,sugar:2})!);
  expect(ids).toHaveLength(26);const out=process.env.SIGNATURE_RASTER_EVIDENCE;
  const sheet=native!.createCanvas(840,26*126),ctx=sheet.getContext('2d')!;ctx.fillStyle='#dfcfac';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.font='11px monospace';ctx.imageSmoothingEnabled=false;
  for(const [row,id]of ids.entries()){
   expect(signatureRequiredLayers(signatureDefinition(id)!)).not.toContain('topping-milk');
   const cs=[a.canvas(id,1,true)!,a.canvas(id,1)!,a.canvas(id,3)!];ctx.fillStyle='#38291e';ctx.fillText(id,8,row*126+14);
   for(const [col,c]of cs.entries()){const rgba=pixels(c);expect(rgba.some((v,i)=>i%4===3&&v===0),id).toBe(true);expect(rgba.some((v,i)=>i%4===3&&v>200),id).toBe(true);ctx.drawImage(c,10+col*115,row*126+24,96,96);}
   ctx.fillStyle='#322920';ctx.fillRect(370,row*126+23,340,98);for(const [col,c]of cs.entries())ctx.drawImage(c,372+col*110,row*126+24,96,96);
  }
  if(out){mkdirSync(out,{recursive:true});writeFileSync(`${out}/matrix.png`,(sheet as unknown as {toBuffer:(type:string)=>Buffer}).toBuffer('image/png'));writeFileSync(`${out}/matrix.json`,JSON.stringify({cases:ids,sizes:[18,32,96],status:'rendered-requires-visual-review'},null,2));}
 });
});
