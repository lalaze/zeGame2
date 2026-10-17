import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MENU } from '../game/data';
import { menuItems } from '../game/economy';
import { FLOOR_Y, WINDOWS } from '../game/layout';
import { createInitialState } from '../game/state';
const nativeText = vi.fn();
import { clearGeneratedMainAssets, installGeneratedMainAsset, type GeneratedMainId } from './generated-main-art';
import { lightingAt } from './lighting';
import { RoomPainter } from './room-art';

vi.mock('./font',async(importOriginal)=>({
  ...await importOriginal<typeof import('./font')>(),
  textWidth:(text:string)=>text.length*5,
  drawText:vi.fn((ctx:{canvas?:{label?:string}},text:string)=>{if(ctx.canvas)ctx.canvas.label=text;}),
}));
vi.mock('./sprites',()=>({
  OUTLINE:'#39281f',
  pixelSprite:(rows:string[])=>({width:rows[0].length,height:rows.length}),
  itemIcon:(itemId:string)=>({width:12,height:12,itemId}),
}));

type Image=CanvasImageSource&{width:number;height:number;assetId?:string;itemId?:string;label?:string};
type Clip=readonly[number,number,number,number];
type Fill={kind:'fill';x:number;y:number;w:number;h:number;color:string;alpha:number;clip:Clip|null};
type Draw={kind:'image';source:Image;args:number[];smoothing:boolean;clip:Clip|null};
type Event=Fill|Draw;
function recording(canvas?:{label?:string}){
  const events:Event[]=[],clips:Clip[]=[],stack:{fillStyle:string;globalAlpha:number;imageSmoothingEnabled:boolean;activeClip:Clip|null}[]=[];
  let pending:Clip|null=null;
  const ctx={
    measureText:(text:string)=>({width:[...text].length*5}),fillText:nativeText,
    canvas,fillStyle:'#123456',globalAlpha:1,imageSmoothingEnabled:true,activeClip:null as Clip|null,
    save(){stack.push({fillStyle:this.fillStyle,globalAlpha:this.globalAlpha,imageSmoothingEnabled:this.imageSmoothingEnabled,activeClip:this.activeClip});},
    restore(){Object.assign(this,stack.pop()!);},
    fillRect(x:number,y:number,w:number,h:number){events.push({kind:'fill',x,y,w,h,color:this.fillStyle,alpha:this.globalAlpha,clip:this.activeClip});},
    drawImage(source:Image,...args:number[]){events.push({kind:'image',source,args,smoothing:this.imageSmoothingEnabled,clip:this.activeClip});},
    beginPath(){pending=null;},rect(x:number,y:number,w:number,h:number){pending=[x,y,w,h];},
    clip(){this.activeClip=pending;if(pending)clips.push(pending);},
    moveTo(){},lineTo(){},closePath(){},fill(){},translate(){},scale(){},setTransform(){},clearRect(){},arc(){},strokeRect(){},setLineDash(){},
  };
  return {events,clips,stack,ctx:ctx as unknown as CanvasRenderingContext2D,state:ctx};
}
function canvas(){
  const source={width:1,height:1,label:undefined as string|undefined,getContext:()=>record.ctx};
  const record=recording(source);return source;
}
const images=(events:Event[])=>events.filter((event):event is Draw=>event.kind==='image');
const fills=(events:Event[])=>events.filter((event):event is Fill=>event.kind==='fill');
const sizes={'wall-window':[633,514],'wall-board':[818,412],'wall-lamp':[206,294]} as const;
function installWalls(){
  for(const[id,[width,height]]of Object.entries(sizes))installGeneratedMainAsset(id as GeneratedMainId,{width,height,assetId:id} as Image);
}
function windowRecord(hour=12,time=0,sign:boolean|null=null,density=2){
  const record=recording();new RoomPainter(record.ctx,density,false).drawWindow(WINDOWS[0],lightingAt(hour),time,sign);return record;
}
beforeEach(()=>{clearGeneratedMainAssets();vi.clearAllMocks();vi.stubGlobal('document',{createElement:()=>canvas()});});
afterEach(()=>vi.unstubAllGlobals());

describe('selected main-wall bitmaps and live overlays',()=>{
  it('keeps the window native aspect, sill attachment and transparent-aperture coordinates',()=>{
    installWalls();const record=windowRecord();
    const draw=images(record.events).find(event=>event.source.assetId==='wall-window')!;
    expect(draw.args.slice(0,4)).toEqual([10,10,613,494]);
    const[,,,,x,y,w,h]=draw.args,scale=62/613;
    expect(x).toBe(WINDOWS[0].x-8);expect(w).toBe(62);
    expect(w/613).toBeCloseTo(h/494,12);
    expect(y+410*scale).toBeCloseTo(WINDOWS[0].y+WINDOWS[0].h+1,12);
    expect(record.clips[0]).toEqual([x+115*scale,y+77*scale,386*scale,296*scale]);
    expect(draw.smoothing).toBe(false);
    expect(record.state.activeClip).toBeNull();expect(record.state.imageSmoothingEnabled).toBe(true);
    expect(record.stack).toHaveLength(0);
  });

  it('draws live day/night sky, sun/moon and moving clouds behind the same hollow frame',()=>{
    installWalls();const day=windowRecord(12,0),later=windowRecord(12,7),night=windowRecord(23,0);
    const frame=(events:Event[])=>images(events).find(draw=>draw.source.assetId==='wall-window')!;
    expect(frame(day.events).args).toEqual(frame(night.events).args);
    expect(fills(day.events).some(fill=>fill.color===lightingAt(12).sky[0])).toBe(true);
    expect(fills(night.events).some(fill=>fill.color===lightingAt(23).sky[0])).toBe(true);
    const sun=fills(day.events).find(fill=>fill.color==='#fee69a'&&fill.w===.5&&fill.h===.5)!;
    const moon=fills(night.events).find(fill=>fill.color==='#efdfbe'&&fill.w===.5&&fill.h===.5)!;
    expect(sun).toBeDefined();expect(moon).toBeDefined();
    expect(day.events.indexOf(sun)).toBeLessThan(day.events.indexOf(frame(day.events)));
    expect(night.events.indexOf(moon)).toBeLessThan(night.events.indexOf(frame(night.events)));
    expect(moon.clip).not.toBeNull();
    expect(moon.x+moon.w).toBeLessThanOrEqual(moon.clip![0]+moon.clip![2]+1);
    const clouds=(record:ReturnType<typeof recording>)=>fills(record.events).filter(fill=>fill.color===lightingAt(12).cloud&&fill.w===14).map(fill=>[fill.x,fill.y]);
    expect(clouds(day)).not.toEqual(clouds(later));
  });

  it('keeps pixel OPEN/CLOSED lettering and the equipped plant at the original anchors',()=>{
    for(const sign of [false,true]){
      clearGeneratedMainAssets();const legacy=windowRecord(12,0,sign);
      installWalls();const generated=windowRecord(12,0,sign);
      expect(generated.clips.at(-1)).toEqual(legacy.clips.at(-1));
      const pixels=(record:ReturnType<typeof recording>)=>fills(record.events).filter(fill=>fill.w===.5&&fill.h===.5&&fill.clip?.[3]===6);
      expect(pixels(generated).length).toBeGreaterThan(0);
      expect(pixels(generated)).toEqual(pixels(legacy));
      expect(nativeText).not.toHaveBeenCalled();
      const plant=recording();new RoomPainter(plant.ctx,2,false).drawSill('sill_bonsai',WINDOWS[0].x+WINDOWS[0].w-8,WINDOWS[0].y+WINDOWS[0].h+1);
      expect(fills(plant.events).every(mark=>mark.y+mark.h<=51)).toBe(true);
      expect(fills(plant.events).some(mark=>mark.x===46.5&&mark.y===48&&mark.w===7&&mark.h===3)).toBe(true);
    }
  });

  it('retains the complete procedural window when the image is missing or density is one',()=>{
    for(const density of [2,1]){
      clearGeneratedMainAssets();if(density===1)installWalls();
      const record=windowRecord(12,0,null,density);
      expect(images(record.events).some(draw=>draw.source.assetId==='wall-window')).toBe(false);
      expect(record.clips[0]).toEqual([12,12,46,38]);
      expect(fills(record.events).some(fill=>fill.x===34&&fill.y===12&&fill.w===3&&fill.h===38)).toBe(true);
    }
  });

  it('fits the full blank board at native aspect and keeps all ten real menu icons within the writing area',()=>{
    installWalls();const state=createInitialState(0);state.kitchen=true;
    state.onMenu=MENU.slice(0,10).map(item=>item.id);for(const id of state.onMenu)state.items[id]=1;
    const before=JSON.stringify(state),record=recording();
    new RoomPainter(record.ctx,2,false).drawMenuBoard(state);
    const draw=images(record.events).find(event=>event.source.assetId==='wall-board')!;
    expect(draw.args.slice(0,4)).toEqual([10,10,798,392]);
    const[,,,,x,y,w,h]=draw.args;
    expect([x,y,w]).toEqual([110,7,100]);expect(w/798).toBeCloseTo(h/392,12);expect(y+h).toBeLessThan(57);
    const actual=images(record.events).filter(image=>image.source.itemId);
    expect(actual.map(image=>image.source.itemId)).toEqual(menuItems(state).slice(0,10).map(item=>item.id));
    expect(actual).toHaveLength(10);
    for(const image of actual){
      const[ix,iy,iw,ih]=image.args,[cx,cy,cw,ch]=image.clip!;
      expect(iw/12).toBeCloseTo(ih/12,12);expect(Math.max(iw,ih)).toBeLessThanOrEqual(9);
      expect(ix).toBeGreaterThanOrEqual(cx);expect(iy).toBeGreaterThanOrEqual(cy);
      expect(ix+iw).toBeLessThanOrEqual(cx+cw);expect(iy+ih).toBeLessThanOrEqual(cy+ch);
      expect(record.events.indexOf(image)).toBeGreaterThan(record.events.indexOf(draw));
    }
    expect(nativeText).not.toHaveBeenCalled();
    expect(fills(record.events).filter(fill=>fill.w===.5&&fill.h===.5&&fill.y>=20&&fill.y<26).length).toBeGreaterThan(0);
    expect(JSON.stringify(state)).toBe(before);
    expect(record.state.activeClip).toBeNull();expect(record.state.imageSmoothingEnabled).toBe(true);expect(record.stack).toHaveLength(0);
  });

  it('does not bake menu contents and keeps the legacy board fallback',()=>{
    const state=createInitialState(0);state.onMenu=[];
    installWalls();const blank=recording();new RoomPainter(blank.ctx,2,false).drawMenuBoard(state);
    expect(images(blank.events).some(image=>image.source.itemId)).toBe(false);
    for(const density of [1,2]){
      if(density===2)clearGeneratedMainAssets();
      const legacy=recording();new RoomPainter(legacy.ctx,density,false).drawMenuBoard(state);
      expect(images(legacy.events).some(image=>image.source.assetId==='wall-board')).toBe(false);
      expect(fills(legacy.events).some(fill=>fill.x===113&&fill.y===10&&fill.w===94&&fill.h===38&&fill.color==='#28463e')).toBe(true);
    }
  });

  it('uses native-aspect brass lamp bitmaps at both existing fixture anchors',()=>{
    installWalls();const record=recording();new RoomPainter(record.ctx,2,false).drawWall('wall_cream',0);
    const lamps=images(record.events).filter(draw=>draw.source.assetId==='wall-lamp');expect(lamps).toHaveLength(2);
    for(const[i,lamp]of lamps.entries()){
      expect(lamp.args.slice(0,4)).toEqual([10,10,186,274]);const[,,,,x,y,w,h]=lamp.args;
      expect(w/186).toBeCloseTo(h/274,12);expect(h).toBe(15);
      expect(x+w/2).toBeCloseTo([80.5,223.5][i],12);expect(y).toBe([10,8][i]);expect(lamp.smoothing).toBe(false);
    }
    clearGeneratedMainAssets();const legacy=recording();new RoomPainter(legacy.ctx,2,false).drawWall('wall_cream',0);
    expect(images(legacy.events).some(draw=>draw.source.assetId==='wall-lamp')).toBe(false);
    expect(fills(legacy.events).some(fill=>fill.x===77&&fill.y===15&&fill.w===7&&fill.h===9)).toBe(true);
  });

  it('uses the actual new window aperture for floor sunlight, with dynamic night suppression',()=>{
    const snap=(value:number)=>Math.round(value*2)/2;
    const beamMarks=(hour:number)=>{const record=recording();new RoomPainter(record.ctx,2,false).drawFloor('floor_checker','rug_none',lightingAt(hour),240);return fills(record.events).filter(fill=>fill.color==='#fee8ac'&&fill.y===FLOOR_Y&&fill.h===.5&&fill.alpha>.2);};
    const legacy=beamMarks(12);expect(legacy).toHaveLength(4);
    installWalls();const actual=beamMarks(12);expect(actual).toHaveLength(4);
    const apertureX=4+115*62/613,apertureW=386*62/613;
    expect(actual[0].x).toBe(snap(apertureX));expect(actual[0].w).toBe(snap(apertureW/2-2));
    expect(actual[0].w).toBeLessThan(legacy[0].w);
    expect(beamMarks(23)).toHaveLength(0);
  });
});
