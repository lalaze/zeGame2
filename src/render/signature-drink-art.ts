import type { IngredientId } from '../game/data';
import { signatureDefinition, BASE_INGREDIENT, type SignatureDefinition } from '../game/signature-drinks';
import { MiniGrid, ingredientMiniatureGrid, menuMiniatureGrid, miniatureCanvas } from './menu-miniatures';

export type SignatureArtKey = IngredientId | 'coffee';
const ink = '#39281f', cream = '#f4e6c7', white = '#fff5dc', brass = '#c8a15e';
const svgCache = new Map<SignatureArtKey,string>();
/** Original pixel ingredient cutouts, shared with the pantry art. Horizontal
 * runs keep the SVG small; every coordinate is an integer and font-free. */
export function signatureDrinkArt(key: SignatureArtKey): string {
  const existing=svgCache.get(key);if(existing)return existing;
  const grid=key==='coffee'?menuMiniatureGrid('espresso'):ingredientMiniatureGrid(key);
  let art='';
  for(let y=0;y<24;y++)for(let x=0;x<24;){
    const at=(xx:number)=>grid.cells[Math.floor((y+.5)/24*32)*32+Math.min(31,Math.floor((xx+.5)/24*32))];
    const color=at(x);let end=x+1;while(end<24&&at(end)===color)end++;
    if(color)art+=`<rect x="${x}" y="${y}" width="${end-x}" height="1" fill="${color}"/>`;
    x=end;
  }
  const url=`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" shape-rendering="crispEdges">${art}</svg>`)}`;
  svgCache.set(key,url);return url;
}

const ADDON_COLOR:Partial<Record<IngredientId,string>>={milk:cream,sugar:white,spice:'#a1683f',cocoa:'#69402e',cream:'#f9eaca',fruit:'#bb6258',matcha:'#627451'};
/** A complete prepared drink, not an ingredient carton. Composition is tied to
 * validated recipe amounts: layers, toppings, sticks, berries and dose pips. */
export function signatureRecipeGrid(def:SignatureDefinition):MiniGrid {
  const g=new MiniGrid();const drink={coffee:'#70472f',tea:'#b78042',milk:cream,fruit:'#d28b75'}[def.base];
  const side={coffee:'#493124',tea:'#90603a',milk:'#c9b799',fruit:'#ad5e52'}[def.base];
  // Distinct vessels: ceramic coffee, handled tea glass, tall milk and fruit.
  const tall=def.base==='milk'||def.base==='fruit';const top=tall?5:9;const bottom=26;
  g.oval(4,25,24,4,ink);g.oval(5,25,22,2,'#ccb797');g.line(8,25,21,25,white);
  if(!tall){g.oval(23,top+3,7,10,ink);g.oval(24,top+4,5,7,cream);g.oval(25,top+5,3,5,undefined);}
  g.poly([[5,top],[25,top],[23,bottom],[8,bottom]],ink);
  g.poly([[6,top+1],[24,top+1],[22,bottom-1],[9,bottom-1]],def.base==='coffee'?cream:'#a6bdb3');
  g.poly([[8,top+3],[22,top+3],[21,bottom-2],[10,bottom-2]],drink);
  g.line(21,top+4,21,bottom-3,side);g.line(7,top+3,9,bottom-3,white);
  g.oval(5,top-1,20,5,def.base==='coffee'?'#d5bea0':'#b5cec3');g.oval(7,top,16,3,drink);g.line(8,top,17,top,white);
  if(def.base==='coffee'){g.line(8,17,9,23,cream);g.r(10,22,10,2,cream);g.oval(12,18,5,3,brass);}
  if(def.base==='tea'){g.line(21,top+1,24,20,brass);g.r(23,20,4,4,'#627451');g.p(24,21,cream);}
  if(def.base==='fruit'){g.line(25,1,19,18,'#627451',2);g.oval(11,17,4,3,'#e9b28a');g.oval(17,21,3,3,'#bb6258');}
  if(def.base==='milk'){g.line(11,top+5,12,top+10,white);g.line(11,22,20,22,'#e5d3b0');}
  const additions=(Object.keys(def.recipe) as IngredientId[]).filter(key=>key!==BASE_INGREDIENT[def.base]).sort();
  additions.forEach((key,index)=>{
    const n=def.recipe[key]??1;
    switch(key){
      case 'milk':g.r(10,bottom-4-n*2,11,n*2,cream);g.line(10,bottom-5-n*2,20,bottom-4-n*2,'#dfc295');break;
      case 'sugar':for(let i=0;i<n+1;i++){const x=10+i*4;g.r(x,top+3+i%2,2,2,white);g.p(x+1,top+2+i%2,cream);}break;
      case 'spice':for(let i=0;i<n;i++){g.line(23+i*3,2,19+i*2,top+8,ink,2);g.line(23+i*3,2,19+i*2,top+7,'#bc8150');}break;
      case 'cocoa':g.line(9,top+6,21,top+10,'#69402e',n);g.line(10,top+12,20,top+16,'#69402e',n);g.p(13,top+4,'#a97450');break;
      case 'cream':g.oval(6,top-3,18,7,'#dfc9a4');g.oval(7,top-4,16,6,white);if(n===2){g.oval(9,top-7,13,7,cream);g.oval(11,Math.max(0,top-10),9,6,white);}else{g.oval(11,top-6,9,5,cream);g.oval(13,Math.max(0,top-8),5,4,white);}g.line(14,top-3,20,top-3,'#d8c3a2');break;
      case 'fruit':for(let i=0;i<n;i++){const x=4+i*4,y=top-3-i;g.oval(x,y,6,7,'#b95e52');g.r(x+1,y+1,2,2,'#e89c81');g.p(x+3,y+4,cream);g.line(x,y-1,x+4,y-1,'#627451');}break;
      case 'matcha':g.r(10,top+6,11,2+n,'#627451');g.r(10,top+5,10,2,'#94ad65');g.line(12,top+3,19,top+4,'#738851');break;
    }
    // One or two ingredient-colored dose drops, each with a dark bottom.
    // The 2×2 fill includes sampled master rows 29 and columns 4/8 etc.,
    // so both count and separation survive the 32→18 native reduction.
    // They supplement the actual drink/garnish; no ingredient stickers.
    const x=3+index*9;
    for(let dose=0;dose<n;dose++){const dx=x+dose*4;g.r(dx,29,3,3,ink);g.r(dx,29,2,2,ADDON_COLOR[key]??brass);}
  });
  // Primary double-dose is visible in the drink itself and in its foot label.
  if(def.recipe[BASE_INGREDIENT[def.base]]===2){g.line(11,bottom-5,20,bottom-5,side);g.r(14,27,4,1,brass);}
  return g;
}
const canvasCache = new Map<string, HTMLCanvasElement>();
export function signatureDrinkCanvas(id: string, density = 1): HTMLCanvasElement {return paintSignature(id,density,false);}
/** Order bubbles retain their fixed 18px envelope. */
export function signatureDrinkIcon(id: string): HTMLCanvasElement {return paintSignature(id,1,true);}
function paintSignature(id:string,density:number,compact:boolean):HTMLCanvasElement {
 const def=signatureDefinition(id);const scale=Number.isFinite(density)?Math.max(1,Math.min(16,Math.floor(density))):1;
 const key=`${def?.id??'invalid'}.${scale}.${compact?'icon':'art'}`;const prior=canvasCache.get(key);if(prior)return prior;
 const canvas=miniatureCanvas(def?signatureRecipeGrid(def):new MiniGrid(),compact?18:32,compact?18:32,false,scale);canvasCache.set(key,canvas);return canvas;
}
