import { describe, expect, it } from 'vitest';
import palette from '../../docs/art-grid/palette.json';
import { DECOR } from '../game/decor';
import { FLOOR_Y } from '../game/layout';
import { mainCabinet, mainCarpet, mainFloor, mainRug, mainSillPlant, mainSkyDisc, mainWall } from './main-room-surfaces';

type Rect = [number, number, number, number, string];
function record(paint: (ctx: CanvasRenderingContext2D) => void) {
  const rects: Rect[] = [];
  const ctx = { fillStyle: '', fillRect(this: {fillStyle:string},x:number,y:number,w:number,h:number) {rects.push([x,y,w,h,this.fillStyle]);} } as unknown as CanvasRenderingContext2D;
  paint(ctx); return rects;
}
const signature = (rects: Rect[]) => JSON.stringify(rects);
describe('native main-room artwork', () => {
  it('keeps all finishes distinct, deterministic, on-palette and on the half-room-pixel grid', () => {
    const colors = new Set(palette.colors.map(c => c.hex));
    for (const slot of ['wallpaper', 'floor', 'counter', 'sill', 'rug'] as const) {
      const signatures = new Set<string>();
      for (const def of DECOR.filter(d => d.slot === slot)) {
        const paint = (ctx:CanvasRenderingContext2D) => {
          if (slot === 'wallpaper') mainWall(ctx,def.id);
          if (slot === 'floor') mainFloor(ctx,def.id,240);
          if (slot === 'counter') mainCabinet(ctx,def.id,64,96,168,12,19);
          if (slot === 'sill') mainSillPlant(ctx,def.id,50,58);
          if (slot === 'rug') {mainCarpet(ctx,240,def.id==='rug_none');if(def.id!=='rug_none')mainRug(ctx,def.id,133,150,54,70);}
        };
        const rects=record(paint);
        expect(signature(rects),def.id).toBe(signature(record(paint)));
        for(const [x,y,w,h,color] of rects) {
          expect([x,y,w,h].every(v => Number.isFinite(v) && Number.isInteger(v*2)),def.id).toBe(true);
          expect(w,def.id).toBeGreaterThan(0);expect(h,def.id).toBeGreaterThan(0);
          expect(colors.has(color),def.id+' '+color).toBe(true);
        }
        signatures.add(signature(rects));
      }
      expect(signatures.size,slot).toBe(DECOR.filter(d=>d.slot===slot).length);
    }
  });
  it('clips floor materials to the original ground at both supported room heights', () => {
    for (const h of [240,360]) for (const def of DECOR.filter(d=>d.slot==='floor')) {
      for (const [x,y,w,height] of record(ctx=>mainFloor(ctx,def.id,h))) {
        expect(x).toBeGreaterThanOrEqual(0);expect(x+w).toBeLessThanOrEqual(320);
        expect(y).toBeGreaterThanOrEqual(FLOOR_Y);expect(y+height).toBeLessThanOrEqual(h);
      }
    }
  });
  it('uses circular sun contours and a carved crescent with varying scanline widths', () => {
    const sun=record(ctx=>mainSkyDisc(ctx,0,0,false)), moon=record(ctx=>mainSkyDisc(ctx,0,0,true));
    expect(moon.length).toBeLessThan(sun.length);expect(moon.length).toBeGreaterThan(20);
    for(const shape of [sun,moon]) {
      const rows=new Map<number,number>();for(const [,y] of shape)rows.set(y,(rows.get(y)??0)+1);
      expect(new Set(rows.values()).size).toBeGreaterThan(3);
      expect(shape.every(([, ,w,h])=>w===.5&&h===.5)).toBe(true);
    }
  });
});
