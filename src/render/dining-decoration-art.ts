import { SEATING_LAYOUT, seatingFurniture } from './cozy-seating-art';
import { extensionTable } from './extension-table-art';
import { centerpieceSprite } from './table-centerpiece-art';
import { worldSpriteArt } from './world-art-grid';
import { registerFineSpriteArt } from './fine-sprite-art';

const previews=new WeakMap<HTMLCanvasElement,Map<string,HTMLCanvasElement>>();

/** The catalog uses the game's actual table, mat, ornament and surface contact. */
export function diningDecorationPreview(mat:string,ornament:string):HTMLCanvasElement|undefined {
  const source=seatingFurniture('table');if(!source)return;
  const key=mat+':'+ornament,cache=previews.get(source)??new Map<string,HTMLCanvasElement>();
  const old=cache.get(key);if(old)return old;
  const art=document.createElement('canvas');art.width=80;art.height=68;
  const ctx=art.getContext('2d')!;ctx.scale(2,2);ctx.imageSmoothingEnabled=false;
  const draw=(f:HTMLCanvasElement,x:number,y:number)=>ctx.drawImage(worldSpriteArt(f).canvas,x,y,f.width,f.height);
  const table=extensionTable(source,'main',mat),floor=30;
  draw(table,20-table.width/2,floor-table.height+1+SEATING_LAYOUT.tableFloorY);
  const prop=centerpieceSprite(ornament);
  if(prop)draw(prop,20-prop.width/2,floor+SEATING_LAYOUT.surfaceY-prop.height);
  const frame=document.createElement('canvas');frame.width=40;frame.height=34;
  frame.getContext('2d')!.drawImage(art,0,0,40,34);registerFineSpriteArt(frame,art,2);
  cache.set(key,frame);previews.set(source,cache);return frame;
}
