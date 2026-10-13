import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DECOR } from '../game/decor';
import { BACK_BAR, COUNTER, MAIN_CUPBOARDS, PASS, PASS_BELL, passSlot } from '../game/layout';
import { createInitialState, type GameState } from '../game/state';
import { clearGeneratedMainAssets, installGeneratedMainAsset, removeGeneratedMainSource, type GeneratedMainId } from './generated-main-art';
import { MACHINE_X, MACHINE_Y, RoomPainter, type CounterCup } from './room-art';
import { drawText } from './font';

vi.mock('./font', () => ({ drawText: vi.fn(), textWidth: (text: string) => text.length * 4 }));
vi.mock('./sprites', () => ({
  OUTLINE: '#39281f',
  itemIcon: (itemId: string) => ({ width: 12, height: 12, itemId }),
  pixelSprite: (rows: string[], palette: Record<string,string>, _outline?: string, density=1) => ({
    width: Math.max(...rows.map(row=>row.length))*density,
    height: rows.length*density,
    legacy: rows[0].includes('wwww') ? 'machine' : 'other', finish: palette.B,
    getContext: () => ({ fillStyle: '', fillRect() {} }),
  }),
}));

type Image = CanvasImageSource & { assetId?: string; legacy?: string; itemId?: string; finish?: string; width: number; height: number };
type Mark = { kind:'fill'; x:number; y:number; w:number; h:number; color:string };
type Draw = { kind:'image'; source:Image; args:number[]; smoothing:boolean; clip:number[][]|null };
function context() {
  const events:(Mark|Draw)[]=[];
  const stack:{fillStyle:string;globalAlpha:number;imageSmoothingEnabled:boolean;tx:number;ty:number;activeClip:number[][]|null}[]=[];
  let path:number[][]=[];
  const ctx={
    fillStyle:'#123456',globalAlpha:1,imageSmoothingEnabled:true,tx:0,ty:0,activeClip:null as number[][]|null,
    save(){stack.push({fillStyle:this.fillStyle,globalAlpha:this.globalAlpha,imageSmoothingEnabled:this.imageSmoothingEnabled,tx:this.tx,ty:this.ty,activeClip:this.activeClip});},
    restore(){Object.assign(this,stack.pop()!);},
    fillRect(x:number,y:number,w:number,h:number){events.push({kind:'fill',x:x+this.tx,y:y+this.ty,w,h,color:this.fillStyle});},
    drawImage(source:Image,...args:number[]){
      const destination=args.length===8?4:0;
      args[destination]+=this.tx;args[destination+1]+=this.ty;
      events.push({kind:'image',source,args,smoothing:this.imageSmoothingEnabled,clip:this.activeClip});
    },
    translate(x:number,y:number){this.tx+=x;this.ty+=y;},
    beginPath(){path=[];},rect(){},clip(){this.activeClip=path.map(point=>[...point]);},
    moveTo(x:number,y:number){path.push([x+this.tx,y+this.ty]);},
    lineTo(x:number,y:number){path.push([x+this.tx,y+this.ty]);},
    closePath(){},fill(){},scale(){},
    setTransform(){},clearRect(){},arc(){},strokeRect(){},setLineDash(){},
  };
  return {ctx:ctx as unknown as CanvasRenderingContext2D,events,stack,translation:()=>[ctx.tx,ctx.ty],clip:()=>ctx.activeClip,smoothing:()=>ctx.imageSmoothingEnabled};
}

const COUNTER_FINISHES = ['counter_oak', 'counter_walnut', 'counter_marble', 'counter_pink', 'counter_gold'] as const;
const serviceSizes={
  'service-machine':[488,433], 'service-cupboard':[536,389],
  'service-cups':[222,294], 'service-jars':[351,304], 'service-basket':[430,235],
  'service-pickup':[1297,1118],
} as const;
function installServices() {
  for (const [id,[width,height]] of Object.entries(serviceSizes)) installGeneratedMainAsset(id as GeneratedMainId,{assetId:id,width,height} as Image);
}
function renderCounter(level=0,cups:CounterCup[]=[],time=0,density=2,counter='counter_oak') {
  const record=context(),state=createInitialState(0);
  state.upgrades.machine=level;
  new RoomPainter(record.ctx,density,false).drawCounter(state,counter,time,cups);
  return record;
}
const images=(events:(Mark|Draw)[])=>events.filter((event):event is Draw=>event.kind==='image');
const fills=(events:(Mark|Draw)[])=>events.filter((event):event is Mark=>event.kind==='fill');
const at=(events:(Mark|Draw)[],x:number,y:number,w:number,h:number,color?:string)=>fills(events).filter(mark=>mark.x===x&&mark.y===y&&mark.w===w&&mark.h===h&&(color===undefined||mark.color===color));

beforeEach(()=>{
  vi.clearAllMocks();
  clearGeneratedMainAssets();
  vi.stubGlobal('document',{createElement:()=>({width:1,height:1,getContext:()=>context().ctx})});
});
afterEach(()=>vi.unstubAllGlobals());

it('covers every available counter finish',()=>{
  expect(COUNTER_FINISHES).toEqual(DECOR.filter(decor=>decor.slot==='counter').map(decor=>decor.id));
});

describe.each(COUNTER_FINISHES)('selected main-service bitmap integration (%s)',counter=>{
  const render=(level=0,cups:CounterCup[]=[],time=0,density=2)=>renderCounter(level,cups,time,density,counter);
  it('draws the actual machine bitmap at uniform scale and the original foot, without a second legacy machine/wand',()=>{
    installServices();
    const {events}=render();
    const draw=images(events).find(event=>event.source.assetId==='service-machine')!;
    expect(draw).toBeDefined();
    const [x,y,w,h]=draw.args;
    expect(w/488).toBeCloseTo(h/433,12);
    expect(w).toBeLessThanOrEqual(30);expect(h).toBeLessThanOrEqual(25);
    expect(x+w/2).toBeCloseTo(MACHINE_X+13,12);
    expect(y+h*425/433).toBeCloseTo(MACHINE_Y+24,12);
    expect(draw.smoothing).toBe(false);
    expect(images(events).some(event=>event.source.legacy==='machine')).toBe(false);
    expect(at(events,MACHINE_X-2,MACHINE_Y+10,1,8)).toHaveLength(0);
  });

  it('keeps missing-asset and low-density machine fallbacks',()=>{
    for(const mode of ['missing','low-density']){
      clearGeneratedMainAssets();
      if(mode!=='missing')installServices();
      const {events}=render(10,[],0,mode==='low-density'?1:2);
      expect(images(events).some(event=>event.source.assetId?.startsWith('service-'))).toBe(false);
      const legacy=images(events).find(event=>event.source.legacy==='machine');
      expect(legacy).toBeDefined();
      expect(legacy!.source.finish).toBe('#c9814f');
      expect(at(events,MACHINE_X-2,MACHINE_Y+10,1,8,'#c9d3d8')).toHaveLength(1);
    }
  });

  it('retains live brew status, two brew streams and cup fill above the bitmap',()=>{
    installServices();
    const idle=render(0,[],.3).events;
    const working=render(0,[{x:80,fill:.75}],.3).events;
    expect(at(idle,MACHINE_X+24,MACHINE_Y+9,2,2,'#e2434b')).toHaveLength(1);
    expect(at(working,MACHINE_X+24,MACHINE_Y+9,2,2,'#7fe36a')).toHaveLength(1);
    for(const dx of [5,21]){
      expect(at(idle,MACHINE_X+dx,MACHINE_Y+18,1,2)).toHaveLength(0);
      expect(at(working,MACHINE_X+dx,MACHINE_Y+18,1,2,'#c28f5a')).toHaveLength(1);
      expect(at(render(0,[{x:80,fill:.75}],.2).events,MACHINE_X+dx,MACHINE_Y+18,1,2,'#925b2f')).toHaveLength(1);
    }
    const liveCup=at(working,90,COUNTER.top+2,5,3,'#6e3f24')[0];
    expect(liveCup).toBeDefined();
    const machineIndex=working.findIndex(event=>event.kind==='image'&&event.source.assetId==='service-machine');
    expect(working.indexOf(liveCup)).toBeGreaterThan(machineIndex);
  });

  it('keeps each upgrade threshold and paints its cue after the machine bitmap',()=>{
    installServices();
    for(const [level,x,y,w,h,color] of [
      [5,MACHINE_X+4,MACHINE_Y+7,2,2,'#f4e6c7'],
      [10,MACHINE_X+1,MACHINE_Y+4,1,8,'#e4ad6a'],
      [15,MACHINE_X+10,MACHINE_Y+10,7,2,'#c8a15e'],
    ] as const){
      expect(at(render(level-1).events,x,y,w,h,color)).toHaveLength(0);
      const {events}=render(level);
      const cue=at(events,x,y,w,h,color)[0];
      expect(cue).toBeDefined();
      expect(events.indexOf(cue)).toBeGreaterThan(events.findIndex(event=>event.kind==='image'&&event.source.assetId==='service-machine'));
    }
  });

  it('fits the low cupboard uniformly at the existing contact point and retains the carafe',()=>{
    installServices();
    const {ctx,events}=context();
    new RoomPainter(ctx,2,false).drawServiceCupboards(counter);
    const draw=images(events).find(event=>event.source.assetId==='service-cupboard')!;
    expect(draw).toBeDefined();
    const [x,y,w,h]=draw.args;
    expect(w/536).toBeCloseTo(h/389,12);
    expect(x+w/2).toBeCloseTo(MAIN_CUPBOARDS[0].x+20,12);
    expect(y+h*381/389).toBeCloseTo(108,12);
    expect(at(events,MAIN_CUPBOARDS[0].x-1,80,42,27)).toHaveLength(0);
    expect(at(events,275,65,3,5,'#acc6af')).toHaveLength(1);
    clearGeneratedMainAssets();
    const fallback=context();
    new RoomPainter(fallback.ctx,2,false).drawServiceCupboards(counter);
    expect(at(fallback.events,MAIN_CUPBOARDS[0].x-1,80,42,27)).toHaveLength(1);
  });

  it('lowers only the generated cupboard attachments and restores the caller transform',()=>{
    for(const mode of ['generated','missing','low-density']){
      clearGeneratedMainAssets();
      if(mode!=='missing')installServices();
      const record=context(),offset=mode==='generated'?4:0;
      record.ctx.translate(3,7);
      new RoomPainter(record.ctx,mode==='low-density'?1:2,false)
        .drawServiceCupboards(counter);
      // Carafe, tray and both glasses move together only after a bitmap succeeds.
      expect(at(record.events,275+3,61+7+offset,3,5,'#acc6af')).toHaveLength(1);
      expect(at(record.events,286+3,76+7+offset,17,2,'#674b31')).toHaveLength(1);
      for(const x of [288,296])expect(at(record.events,x+3,70+7+offset,5,1,'#90a995')).toHaveLength(1);
      expect(record.translation()).toEqual([3,7]);
      expect(record.stack).toHaveLength(0);
      record.ctx.fillRect(1,2,3,4);
      expect(record.events.at(-1)).toMatchObject({kind:'fill',x:4,y:9,w:3,h:4});
    }
  });

  it('uses actual cup/jar bitmaps at existing worktop anchors without stretching them',()=>{
    installServices();
    const {ctx,events}=context();
    new RoomPainter(ctx,2,false).drawBackBar(createInitialState(0),counter);
    const cups=images(events).filter(event=>event.source.assetId==='service-cups');
    const jars=images(events).find(event=>event.source.assetId==='service-jars')!;
    expect(cups).toHaveLength(3);expect(jars).toBeDefined();
    for(const [i,draw] of cups.entries()){
      const [x,y,w,h]=draw.args;
      expect(w/222).toBeCloseTo(h/294,12);
      expect(x+w/2).toBeCloseTo(121+i*11,12);
      expect(y+h*286/294).toBeCloseTo(BACK_BAR.top+5,12);
      expect(draw.smoothing).toBe(false);
    }
    const [x,y,w,h]=jars.args;
    expect(w/351).toBeCloseTo(h/304,12);
    expect(x+w/2).toBeCloseTo(BACK_BAR.x+25.5,12);
    expect(y+h*296/304).toBeCloseTo(BACK_BAR.top+5,12);
  });

  it('layers the real empty basket behind unchanged menu bread and only its clipped front over the bread',()=>{
    const state:GameState=createInitialState(0);
    state.kitchen=true;state.onMenu=['espresso','roll','bagel'];
    state.items.roll=1;state.items.bagel=1;
    const before=JSON.stringify(state);
    const bare=context();new RoomPainter(bare.ctx,2,false).drawBackBar(state,counter);
    installServices();
    const loaded=context();new RoomPainter(loaded.ctx,2,false).drawBackBar(state,counter);
    const foods=(events:(Mark|Draw)[])=>images(events).filter(draw=>draw.source.itemId).map(draw=>({item:draw.source.itemId,args:draw.args}));
    expect(foods(loaded.events)).toEqual(foods(bare.events));
    expect(foods(loaded.events).map(food=>food.item)).toEqual(['roll','bagel']);
    const basket=images(loaded.events).filter(draw=>draw.source.assetId==='service-basket');
    const bread=images(loaded.events).filter(draw=>draw.source.itemId);
    expect(basket).toHaveLength(2);
    const [back,front]=basket;
    expect(back.args).toHaveLength(4);expect(back.clip).toBeNull();
    expect(front.args).toHaveLength(8);expect(front.clip).not.toBeNull();
    for(const food of bread){
      expect(loaded.events.indexOf(back)).toBeLessThan(loaded.events.indexOf(food));
      expect(loaded.events.indexOf(front)).toBeGreaterThan(loaded.events.indexOf(food));
    }
    const [x,y,w,h]=back.args;
    expect(w/430).toBeCloseTo(h/235,12);
    expect(x+w/2).toBe(174);
    expect(y+h*227/235).toBeCloseTo(BACK_BAR.top+5,12);
    expect(front.args.slice(0,4)).toEqual([0,65,430,170]);
    expect(front.args[6]/430).toBeCloseTo(front.args[7]/170,12);
    for(const [px,py] of front.clip!){
      expect(px).toBeGreaterThanOrEqual(x);expect(px).toBeLessThanOrEqual(x+w);
      expect(py).toBeGreaterThanOrEqual(y+h*65/235);expect(py).toBeLessThanOrEqual(y+h);
    }
    // The middle lip is lower than the left lip; no horizontal chop through food.
    expect(front.clip![4][1]).toBeGreaterThan(front.clip![0][1]);
    expect(front.smoothing).toBe(false);
    expect(loaded.clip()).toBeNull();expect(loaded.stack).toHaveLength(0);
    expect(loaded.smoothing()).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('never paints basket food when the menu has no bread and retains the old fallback choices',()=>{
    installServices();
    const state=createInitialState(0);
    state.kitchen=true;state.items.roll=1;state.onMenu=['espresso'];
    const empty=context();new RoomPainter(empty.ctx,2,false).drawBackBar(state,counter);
    expect(images(empty.events).some(draw=>draw.source.itemId)).toBe(false);
    expect(images(empty.events).some(draw=>draw.source.assetId==='service-basket')).toBe(false);
    state.onMenu=['espresso','roll'];
    for(const mode of ['missing','low-density']){
      clearGeneratedMainAssets();if(mode!=='missing')installServices();
      const record=context();
      new RoomPainter(record.ctx,mode==='low-density'?1:2,false).drawBackBar(state,counter);
      expect(images(record.events).some(draw=>draw.source.assetId?.startsWith('service-'))).toBe(false);
      expect(images(record.events).filter(draw=>draw.source.itemId).map(draw=>draw.source.itemId)).toEqual(['roll']);
      expect(record.clip()).toBeNull();expect(record.stack).toHaveLength(0);
    }
  });

  it('fits the corrected pickup visible bbox at native aspect without altering the six slots or bell',()=>{
    installServices();
    const slots=Array.from({length:6},(_,i)=>passSlot(i)), bell={...PASS_BELL};
    const {ctx,events}=render();
    const draw=images(events).find(event=>event.source.assetId==='service-pickup')!;
    expect(draw).toBeDefined();
    expect(draw.args.slice(0,4)).toEqual([8,8,1281,1102]);
    const [,,, ,x,y,w,h]=draw.args;
    expect([x,y,w]).toEqual([PASS.x,PASS.top+2,40]);
    expect(w/1281).toBeCloseTo(h/1102,12);
    expect(h).toBeCloseTo(34.410617,5);
    expect(draw.smoothing).toBe(false);
    // Visual ledges from the selected v2 source manifest, not game geometry.
    expect(y+(648-42)*w/1281).toBeCloseTo(80.922717,5);
    expect(y+(1063-42)*w/1281).toBeCloseTo(93.881343,5);
    expect(Array.from({length:6},(_,i)=>passSlot(i))).toEqual(slots);
    expect(PASS_BELL).toEqual(bell);
    expect(drawText).toHaveBeenCalledWith(ctx,'PICKUP',PASS.x+7,PASS.top+1,'#f5e6c4');
    const header=at(events,PASS.x-2,PASS.top-1,PASS.w+4,8,'#39281f')[0];
    expect(events.indexOf(header)).toBeGreaterThan(events.indexOf(draw));
    expect(at(events,PASS.x+1,PASS.top+21,38,3,'#39281f')).toHaveLength(0);
  });

  it.each(Object.keys(serviceSizes) as (keyof typeof serviceSizes)[])(
    'falls back only for the unavailable %s source',missing=>{
      installServices();
      const state=createInitialState(0);
      state.kitchen=true;state.items.roll=1;state.onMenu=['espresso','roll'];
      const paint=()=>{
        const record=context(),painter=new RoomPainter(record.ctx,2,false);
        painter.drawBackBar(state,counter);
        painter.drawServiceCupboards(counter);
        painter.drawCounter(state,counter,0,[]);
        return record;
      };
      const complete=paint();
      expect(removeGeneratedMainSource(missing)).toBe(true);
      const partial=paint();
      const serviceCounts={
        'service-machine':1,'service-cupboard':MAIN_CUPBOARDS.length,
        'service-cups':3,'service-jars':1,'service-basket':2,'service-pickup':1,
      };
      for(const [id,count] of Object.entries(serviceCounts)){
        const matching=(record:ReturnType<typeof context>)=>images(record.events).filter(draw=>draw.source.assetId===id);
        expect(matching(complete)).toHaveLength(count);
        expect(matching(partial)).toEqual(id===missing?[]:matching(complete));
      }
      // An unavailable source restores real fallback artwork rather than a gap.
      expect(fills(partial.events).length).toBeGreaterThan(fills(complete.events).length);
      expect(images(partial.events).filter(draw=>draw.source.itemId).map(draw=>draw.source.itemId)).toEqual(['roll']);
      expect(partial.clip()).toBeNull();expect(partial.stack).toHaveLength(0);
    },
  );

  it.each([false,true])('keeps pastry stock live across prep, open and closing (generated display: %s)',generatedDisplay=>{
    installServices();
    if(generatedDisplay)installGeneratedMainAsset('display',{assetId:'display',width:1941,height:521} as Image);
    const state=createInitialState(0),record=context(),painter=new RoomPainter(record.ctx,2,false);
    state.kitchen=true;state.items.roll=1;state.onMenu=['espresso','roll'];
    let fixedProps:Draw[]|undefined;
    for(const [phase,planned,remaining,count] of [
      ['prep',8,0,2],['prep',0,8,0],['open',8,0,0],['open',8,1,1],
      ['open',0,8,2],['closing',8,0,0],['closing',0,8,2],
    ] as const){
      state.phase=phase;state.bakePlan.roll=planned;state.shelf.roll=remaining;
      const before=JSON.stringify(state);
      record.events.length=0;
      painter.drawCounter(state,counter,0,[]);
      expect(images(record.events).filter(draw=>draw.source.itemId==='roll')).toHaveLength(count);
      const props=images(record.events).filter(draw=>draw.source.assetId?.startsWith('service-'));
      expect(props.map(draw=>draw.source.assetId)).toEqual(['service-machine','service-pickup']);
      if(fixedProps)expect(props).toEqual(fixedProps);else fixedProps=props;
      expect(JSON.stringify(state)).toBe(before);
      expect(record.clip()).toBeNull();expect(record.stack).toHaveLength(0);
    }
  });

  it('refreshes basket contents from the current menu without retaining removed bread',()=>{
    installServices();
    const state=createInitialState(0),record=context(),painter=new RoomPainter(record.ctx,2,false);
    state.kitchen=true;state.items.roll=1;state.items.bagel=1;
    for(const breads of [['roll','bagel'],['bagel'],[]] as const){
      state.onMenu=['espresso',...breads];
      const before=JSON.stringify(state);
      record.events.length=0;
      painter.drawBackBar(state,counter);
      expect(images(record.events).filter(draw=>draw.source.itemId).map(draw=>draw.source.itemId)).toEqual(breads);
      expect(images(record.events).filter(draw=>draw.source.assetId==='service-basket')).toHaveLength(breads.length?2:0);
      expect(JSON.stringify(state)).toBe(before);
      expect(record.clip()).toBeNull();expect(record.stack).toHaveLength(0);
    }
  });

  it('retains the procedural pickup geometry on missing assets, low density and invalid padding',()=>{
    for(const mode of ['missing','low-density','invalid-padding']){
      clearGeneratedMainAssets();
      if(mode!=='missing')installServices();
      if(mode==='invalid-padding')installGeneratedMainAsset('service-pickup',{assetId:'service-pickup',width:16,height:16} as Image);
      const {events}=render(0,[],0,mode==='low-density'?1:2);
      expect(images(events).some(draw=>draw.source.assetId==='service-pickup')).toBe(false);
      expect(at(events,PASS.x+1,PASS.top+21,38,3,'#39281f')).toHaveLength(1);
      expect(at(events,PASS.x-1,COUNTER.top-2,PASS.w+2,3,'#39281f')).toHaveLength(1);
    }
  });
});
