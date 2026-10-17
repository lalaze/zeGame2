/** Main café architecture, authored in half-room-pixel cells on the master palette.
 * Flat floor motifs are >=2 room px so the row projection cannot turn them into noise. */
import palette from '../../docs/art-grid/palette.json';
import { DOOR_W, DOOR_X, FLOOR_Y, PASS, PASS_COLUMNS, PASS_SLOT_W, COUNTER, passageY } from '../game/layout';
type Ctx = CanvasRenderingContext2D;
const ramps = new Map<string, string[]>();
for (const c of palette.colors) { const ramp = ramps.get(c.ramp) ?? []; ramp.push(c.hex); ramps.set(c.ramp, ramp); }
export const artRamp = (name: string): readonly string[] => ramps.get(name)!;
const oak = artRamp('oak'), walnut = artRamp('walnut'), floor = artRamp('floor');
const cream = artRamp('cloth-7'), sage = artRamp('sage'), rose = artRamp('cloth-5');
export function artRect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color; ctx.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, Math.round(w * 2) / 2, Math.round(h * 2) / 2);
}
export function mainTimber(ctx: Ctx, x: number, y: number, w: number, h: number, vertical = false) {
  const r = (a:number,b:number,c:number,d:number,col:string) => artRect(ctx,x+a,y+b,c,d,col);
  r(0,0,w,h,walnut[0]); r(.5,.5,w-1,h-1,oak[2]);
  r(1,1,Math.max(.5,w-2),Math.max(.5,h-2),oak[3]);
  r(.5,.5,vertical ? .5 : w-1,vertical ? h-1 : .5,oak[4]);
  r(w-1,1,.5,h-1,walnut[0]); r(1,h-1,w-1,.5,walnut[0]);
  if(!vertical && h>=4) {r(1,h-2,w-2,1,oak[2]);r(1,h-1.5,w-2,.5,walnut[2]);}
  if(vertical && w>=4) {r(w-2,1,1,h-2,oak[2]);r(w-1.5,1,.5,h-2,walnut[2]);}
  if (vertical) for(let yy=3;yy<h-3;yy+=11) r(2,yy,.5,Math.min(7,h-yy-2),oak[3]);
  else for(let xx=4;xx<w-5;xx+=19) r(xx,2,Math.min(11,w-xx-2),.5,oak[3]);
}
/** Six-value joinery ramps: shadow, recess, molding, field, lit bevel, gleam. */
export function counterMaterial(id: string): readonly string[] {
  if (id === 'counter_walnut') return [walnut[0], walnut[0], walnut[1], walnut[2], walnut[3], oak[2]];
  if (id === 'counter_pink') return [walnut[0], rose[0], rose[0], rose[1], rose[2], cream[2]];
  if (id === 'counter_marble') return [walnut[0], cream[0], artRamp('steel')[3], cream[1], cream[2], floor[5]];
  if (id === 'counter_gold') return [walnut[0], oak[0], oak[2], artRamp('wall')[1], artRamp('wall')[3], artRamp('wall')[4]];
  return [walnut[0], walnut[1], walnut[2], walnut[3], oak[2], oak[4]];
}
function brassPull(ctx: Ctx, cx: number, y: number) {
  const r = (x:number,dy:number,w:number,h:number,c:string) => artRect(ctx,cx+x,y+dy,w,h,c);
  r(-2.5,.5,5,1.5,walnut[0]);
  r(-2.5,0,1,1.5,oak[2]); r(1.5,0,1,1.5,oak[2]);
  r(-2,0,.5,1,oak[5]); r(1.5,0,.5,1,oak[5]);
  r(-1.5,1,3,.5,oak[3]); r(-1.5,.5,3,.5,oak[5]);
}
function raisedPanel(ctx: Ctx, x:number,y:number,w:number,h:number,m:readonly string[],pull=true) {
  const r = (a:number,b:number,c:number,d:number,col:string) => artRect(ctx,x+a,y+b,c,d,col);
  r(0,0,w,h,m[0]); r(.5,.5,w-1,h-1,m[2]);
  r(.5,.5,w-1,.5,m[5]); r(.5,1,.5,h-1.5,m[4]);
  r(w-1,1,.5,h-1.5,m[1]); r(1,h-1,w-1,.5,m[1]);
  if(h>=8) {
    // A dark cove, a bright inner bevel and a raised central field.
    r(2,2,w-4,h-4,m[1]);
    r(2.5,2.5,w-5,h-5,m[0]);
    r(3,3,w-6,h-6,m[3]);
    r(3,3,w-6,.5,m[4]); r(3,3.5,.5,h-6.5,m[4]);
    r(w-3.5,3.5,.5,h-6.5,m[1]); r(3.5,h-3.5,w-7,.5,m[1]);
    if(h>=11) {
      r(4,h-5,w-8,1,m[2]);
      // Restrained long fibres, not a noisy grain or a second contour.
      r(5,5,Math.max(1,(w-10)*.45),.5,m[4]);
      r(w-8,h-6,3,.5,m[3]);
    }
  }
  if(pull) brassPull(ctx,x+w/2,y+1.5);
}
export function mainCabinet(ctx: Ctx, id: string, x:number,y:number,w:number,topH:number,frontH:number, drawers=false) {
  const body=counterMaterial(id), top=id==='counter_marble'?cream:oak;
  const r=(a:number,b:number,c:number,d:number,col:string)=>artRect(ctx,x+a,y+b,c,d,col);
  r(0,0,w,topH+frontH,walnut[0]);
  r(.5,.5,w-1,topH-1,top[Math.min(3,top.length-1)]);
  r(.5,.5,w-1,.5,top.at(-1)!); r(.5,1,.5,topH-2,top.at(-1)!);
  for(let xx=5;xx<w-10;xx+=23) {
    r(xx,1.5,12,.5,top[Math.min(4,top.length-1)]);
    if(topH>5) {r(xx+3,topH-3,8,.5,top[Math.min(2,top.length-1)]);r(xx+4,topH-3.5,4,.5,top[Math.min(3,top.length-1)]);}
  }
  r(0,topH-1,w,.5,oak[4]); r(0,topH-.5,w,1,walnut[0]);
  r(.5,topH+.5,w-1,frontH-1,body[1]);
  r(.5,topH+.5,w-1,.5,body[4]);
  const count=Math.max(1,Math.round(w/27)), step=w/count;
  for(let i=0;i<count;i++) {
    const px=Math.round((i*step+1.5)*2)/2, pw=Math.floor((step-3)*2)/2;
    const py=topH+1.5, ph=frontH-3.5;
    if(drawers && ph>=12) {
      raisedPanel(ctx,x+px,y+py,pw,4,body);
      raisedPanel(ctx,x+px,y+py+4.5,pw,ph-4.5,body,false);
      // Small vertical brass latch on the lower raised door.
      r(px+pw-3,py+7,.5,2,oak[5]);r(px+pw-2.5,py+7,.5,2.5,oak[2]);
    } else raisedPanel(ctx,x+px,y+py,pw,ph,body);
  }
  r(0,topH+frontH-1.5,w,1.5,body[0]);
  r(.5,topH+frontH-1.5,w-1,.5,body[4]);
}
export function mainWall(ctx: Ctx,id:string) {
  const colors=id==='wall_mint'?artRamp('cloth-2'):id==='wall_rose'?rose:id==='wall_dots'?artRamp('cloth-1'):id==='wall_brick'?artRamp('terracotta'):id==='wall_walnut'?walnut:id==='wall_stars'?artRamp('pants-0'):cream;
  const r=(x:number,y:number,w:number,h:number,c:string)=>artRect(ctx,x,y,w,h,c);
  r(0,6,320,55,colors.at(-1)!);
  for(let x=0;x<320;x+=10) { r(x,7,1.5,53,id==='wall_cream'?floor[3]:colors[1]); r(x+1.5,7,.5,53,colors.at(-1)!); }
  if(id==='wall_brick') for(let y=7;y<59;y+=7) {r(0,y,320,.5,cream[1]);for(let x=(y%2)*9;x<320;x+=18)r(x,y,.5,7,cream[1]);}
  if(id==='wall_dots'||id==='wall_stars') for(let y=12;y<56;y+=12)for(let x=7;x<318;x+=16){r(x,y,2,.5,cream[2]);r(x+.5,y-.5,.5,2,id==='wall_stars'?oak[5]:rose[1]);}
  if(id==='wall_walnut') for(let x=5;x<320;x+=24){r(x,11,18,.5,oak[3]);r(x,11,.5,44,oak[3]);r(x+18,11,.5,44,walnut[0]);}
  const panel=id==='wall_mint'?'counter_marble':id==='wall_rose'?'counter_pink':'counter_oak';
  mainCabinet(ctx,panel,0,59,320,3,18);
  mainTimber(ctx,0,0,320,8); mainTimber(ctx,0,76,320,4);
  for(const x of [0,313]) mainTimber(ctx,x,0,7,79,true);
}
export function mainFloor(ctx: Ctx, id:string, height:number) {
  const r=(x:number,y:number,w:number,h:number,c:string)=>{const left=Math.max(0,x),top=Math.max(FLOOR_Y,y);artRect(ctx,left,top,Math.min(320,x+w)-left,Math.min(height,y+h)-top,c);};
  r(0,FLOOR_Y,320,height-FLOOR_Y,floor[2]);
  const planks=id==='floor_planks'||id==='floor_herringbone', size=planks?9:22;
  for(let y=FLOOR_Y,row=0;y<height;y+=size,row++)for(let x=-32;x<320;x+=planks?48:26){
    const xx=x+(row%2)*(planks?24:0), w=planks?48:26;
    const tones=id==='floor_mint'?artRamp('cloth-2'):id==='floor_marble'?cream:planks?oak:floor;
    const alternating=(row+Math.floor(x/w)+40)%2;
    const c=id==='floor_checker'||id==='floor_wood' ? (alternating?cream[2]:cream[1]) : tones[planks?3:Math.min(tones.length-1,2+alternating)];
    r(xx,y,w,size,c); r(xx+.5,y+.5,w-1,.5,planks?oak[4]:floor[5]); r(xx+.5,y+.5,.5,size-1,planks?oak[4]:floor[4]);
    r(xx,y+size-.5,w,.5,planks?walnut[2]:floor[0]);r(xx+w-.5,y,.5,size,planks?walnut[2]:floor[1]);
    if(!planks && id!=='floor_mint') {
      r(xx+2,y+2,2,size-5,cream[2]);
      r(xx+4,y+2,w-8,2,cream[2]);
    }
    if(planks) for(let n=0;n<2;n++) r(xx+4+n*12,y+3+n*2,9,.5,oak[n?4:2]);
    if(id==='floor_herringbone') for(let n=0;n<3;n++) {r(xx+8+n*12,y+1,2,6,walnut[2]);r(xx+10+n*12,y+1,7,2,oak[4]);}
    if(id==='floor_terrazzo') {r(xx+5,y+7,2,2,cream[2]);r(xx+16,y+15,3,2,rose[1]);r(xx+18,y+4,2,2,sage[3]);}
    if(id==='floor_marble') {r(xx+7,y+3,2,5,floor[2]);r(xx+9,y+8,2,4,floor[2]);r(xx+11,y+12,3,2,floor[3]);}
  }
}
/** Joined flatweave: layered binding follows the T perimeter, with broad woven
 * diamonds and finished end embroidery. All motif cells are >=4 art pixels. */
export function mainCarpet(ctx:Ctx,height:number,entryStem:boolean) {
  const top=passageY()-7, bottom=height-8;
  const r=(x:number,y:number,w:number,h:number,c:string)=>artRect(ctx,x,y,w,h,c);
  const shape=(inset:number,color:string)=>{
    r(64+inset,top+inset,248-2*inset,14-2*inset,color);
    if(entryStem)r(145+inset,top+7,30-2*inset,bottom-top-7-inset,color);
  };
  shape(0,sage[0]); shape(.5,floor[0]); shape(1,cream[1]);
  shape(1.5,sage[3]); shape(2,floor[1]); shape(2.5,cream[2]); shape(3,sage[2]);
  const diamond=(cx:number,cy:number,color:string)=>{
    r(cx-1,cy-3,2,2,color);r(cx-3,cy-1,2,2,color);
    r(cx+1,cy-1,2,2,color);r(cx-1,cy+1,2,2,color);
  };
  // Generous spacing keeps the projected floor calm; this is woven pattern,
  // not a fine dither or an isolated dot grid.
  for(let cx=88;cx<300;cx+=24)diamond(cx,top+7,artRamp('cloth-2')[0]);
  for(let x=69;x<307;x+=8){r(x,top+1,2,2,floor[2]);if(!entryStem||x<143||x>175)r(x,top+11,2,2,floor[2]);}
  const flower=(cx:number,cy:number)=>{
    for(const [dx,dy] of [[0,-2],[-2,0],[2,0],[0,2]])r(cx+dx-1,cy+dy-1,2,2,cream[2]);
    r(cx-1,cy-1,2,2,artRamp('gingham')[1]);
  };
  flower(72,top+7);flower(304,top+7);
  if(entryStem){
    for(let yy=top+24;yy<bottom-12;yy+=20)diamond(160,yy,artRamp('cloth-2')[0]);
    for(let yy=top+16;yy<bottom-4;yy+=8){r(146,yy,2,2,floor[2]);r(172,yy,2,2,floor[2]);}
    r(148,bottom-8,24,2,floor[1]);r(148,bottom-6,24,2,cream[1]);
    flower(160,bottom-14);
  } else {
    // Separate welcome mat stays within its original footprint for paid rugs.
    const x=DOOR_X+2,y=height-16,w=DOOR_W-4;
    r(x,y,w,8,sage[0]);r(x+.5,y+.5,w-1,7,floor[1]);r(x+1.5,y+1.5,w-3,5,sage[2]);
    r(x+2,y+1,w-4,.5,cream[2]);r(x+2,y+6.5,w-4,.5,cream[1]);
  }
  return true;
}

/** Empty pickup pass. One recessed cavity, never vertical door panels. Shelves
 * and ticks retain the existing six plate anchors; all food and bell stay live. */
export function mainPickup(ctx:Ctx,counter:string) {
  const {x,w,top}=PASS, base=COUNTER.top, shelf=top+21;
  const inner=x+2, innerW=PASS_COLUMNS*PASS_SLOT_W, metal=artRamp('steel');
  const material=counterMaterial(counter);
  const r=(a:number,b:number,c:number,d:number,color:string)=>artRect(ctx,a,b,c,d,color);
  r(x,top+6,w,base-top-6,walnut[0]);
  r(inner,top+8,innerW,base-top-10,walnut[1]);
  // Horizontal depth bands under the header and shelf, no door-like stiles.
  r(inner,top+7,innerW,2,walnut[0]);
  r(inner,shelf+2,innerW,2,walnut[0]);
  r(inner+1,top+10,innerW-2,.5,walnut[2]);
  for(const sy of [shelf,base-2]) {
    r(x-1,sy,w+2,3,walnut[0]);
    r(x-.5,sy,w+1,.5,cream[2]);r(x,sy+.5,w,1,metal[4]);
    r(x,sy+1.5,w,.5,metal[2]);r(x+.5,sy+2,w-1,.5,metal[0]);
    for(let col=1;col<PASS_COLUMNS;col++)r(inner+col*PASS_SLOT_W,sy-1,.5,1,oak[4]);
  }
  for(const px of [x,x+w-2]) {
    mainTimber(ctx,px,top+5,2,base-top-5,true);
    r(px+.5,top+7,.5,base-top-8,material[4]);
  }
  mainTimber(ctx,x-2,top-1,w+4,8);
  r(x,top+.5,w,5.5,sage[0]);
  for(const lx of [inner+4,inner+innerW-11]) {
    r(lx+3,top+6,.5,1.5,metal[0]);
    r(lx+2,top+7,3,.5,oak[4]);r(lx+1,top+7.5,5,.5,metal[3]);
    r(lx,top+8,7,1,walnut[0]);r(lx+.5,top+8,6,.5,oak[3]);
    r(lx+1,top+9,5,.5,floor[5]);
  }
}
export function mainRug(ctx:Ctx,id:string,x:number,y:number,w:number,h:number) {
  const colors=id==='rug_blue'?artRamp('cloth-1'):id==='rug_round'?sage:artRamp('gingham');
  const r=(a:number,b:number,c:number,d:number,col:string)=>{
    if(id!=='rug_round'){artRect(ctx,a,b,c,d,col);return;}
    for(let row=Math.round(b*2)/2;row<b+d;row+=.5){const half=Math.round(Math.sqrt(Math.max(0,1-((row+.25-y-h/2)/(h/2))**2))*w)/2;const left=Math.max(a,x+w/2-half),right=Math.min(a+c,x+w/2+half);artRect(ctx,left,row,right-left,.5,col);}
  };
  r(x,y,w,h,colors[0]);r(x+1,y+1,w-2,h-2,cream[2]);r(x+2,y+2,w-4,h-4,colors[1]);
  for(let yy=y+5;yy<y+h-4;yy+=8)for(let xx=x+5;xx<x+w-4;xx+=8){r(xx,yy,2,2,colors[2]);}
  r(x+4,y+4,w-8,1,cream[1]);r(x+4,y+h-5,w-8,1,cream[1]);
}
/** Crisp herb silhouettes, not scaled painterly sprigs. */
export function mainSillPlant(ctx:Ctx,id:string,cx:number,foot:number) {
  if(id==='sill_none')return;
  const r=(x:number,y:number,w:number,h:number,c:string)=>artRect(ctx,cx+x,foot+y,w,h,c);
  r(-3.5,-3,7,3,walnut[0]);r(-3,-3,6,2.5,artRamp('terracotta')[2]);r(-3,-3,.5,2,oak[5]);r(-4,-4,8,1,oak[4]);r(-3,-3.5,6,.5,walnut[0]);
  const leaf=artRamp('leaf');
  if(id==='sill_cactus') {r(-1.5,-11,3,7,leaf[0]);r(-1,-11,1,7,leaf[2]);r(-3,-8,2,1,leaf[1]);r(-3,-10,1,3,leaf[2]);r(1,-7,2,1,leaf[1]);r(2,-9,1,3,leaf[2]);}
  else for(const [dx,dy] of [[-3,-8],[2,-10],[0,-7],[-1,-11]]){r(dx,dy, .5,-4-dy,leaf[0]);r(dx-1.5,dy,3,1.5,leaf[1]);r(dx-1,dy-.5,2,1,leaf[2]);if(id==='sill_tulips'){r(dx-1,dy-2,2,2,rose[1]);r(dx-1,dy-2,1,1,rose[2]);}}
}
/** Discrete circular silhouettes; crescent is carved row-by-row, never a square cutout. */
export function mainSkyDisc(ctx:Ctx,x:number,y:number,moon:boolean) {
  x=Math.round(x*2)/2;y=Math.round(y*2)/2;
  for(let row=0;row<12;row++){const dy=row-5.5, half=Math.floor(Math.sqrt(36-dy*dy));for(let col=6-half;col<6+half;col++){
    if(moon&&(col-8)**2+(row-4)**2<28)continue;
    artRect(ctx,x+col/2,y+row/2,.5,.5,moon?cream[2]:artRamp('wall')[row<6?4:3]);
  }}
}
