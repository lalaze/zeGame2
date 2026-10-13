import { describe, expect, it } from 'vitest';
import { paintFinePottedPlant, paintFineTrailingPlant } from './fine-plant-art';

interface Fill { x: number; y: number; w: number; h: number; color: string }
function record(painter: typeof paintFinePottedPlant, width=24, height=32, seed=17, x=4, y=6) {
  const fills: Fill[] = [], styles: string[] = [];
  const mock = {
    fillStyle: '#123456',
    save() { styles.push(this.fillStyle); },
    restore() { this.fillStyle=styles.pop()!; },
    fillRect(x: number,y: number,w: number,h: number) { fills.push({x,y,w,h,color:this.fillStyle}); },
  };
  painter(mock as unknown as CanvasRenderingContext2D,x,y,width,height,seed);
  return {fills,mock};
}

describe('fine main-room botanical art', () => {
  for (const [name,painter,width,height] of [
    ['door pot',paintFinePottedPlant,16,23], ['trailing pot',paintFineTrailingPlant,15,34],
  ] as const) {
    it(`${name} stays on a half-world-pixel grid inside its declared bounds`, () => {
      const {fills,mock}=record(painter,width,height);
      expect(fills.length).toBeGreaterThan(100);
      expect(mock.fillStyle).toBe('#123456');
      for (const fill of fills) {
        expect([fill.x,fill.y,fill.w,fill.h].every(Number.isFinite)).toBe(true);
        expect([fill.x,fill.y,fill.w,fill.h].every(n=>Number.isInteger(n*2))).toBe(true);
        expect(fill.w).toBeGreaterThan(0);
        expect(fill.h).toBe(.5);
        expect(fill.x).toBeGreaterThanOrEqual(4);
        expect(fill.y).toBeGreaterThanOrEqual(6);
        expect(fill.x+fill.w).toBeLessThanOrEqual(4+width);
        expect(fill.y+fill.h).toBeLessThanOrEqual(6+height);
      }
    });

    it(`${name} is deterministic and seed-dependent without filling its transparent background`, () => {
      const a=record(painter,width,height,17).fills;
      expect(a).toEqual(record(painter,width,height,17).fills);
      expect(a).not.toEqual(record(painter,width,height,93).fills);
      const area=a.reduce((sum,fill)=>sum+fill.w*fill.h,0);
      expect(area).toBeGreaterThan(width*height*.18);
      expect(area).toBeLessThan(width*height*.8);
      expect(a.some(fill=>fill.x===4&&fill.y===6)).toBe(false);
    });

    it(`${name} includes leaf shade/facet/veins, soil, rim and warm clay tones`, () => {
      const colors=new Set(record(painter,width,height).fills.map(fill=>fill.color));
      for (const color of ['#344832','#5e773d','#7c934b','#a2b15e','#aeb76a','#4e402c','#e5aa6d','#ba6d41','#914f32']) expect(colors.has(color)).toBe(true);
      expect(colors.size).toBeGreaterThanOrEqual(13);
    });

    it(`${name} safely handles tiny/fractional bounds and rejects invalid geometry`, () => {
      for (const [w,h] of [[.2,.3],[3.25,4.75],[16,23]]) {
        for (const fill of record(painter,w,h,17,-2.25,1.2).fills) {
          expect(fill.w).toBeGreaterThan(0); expect(fill.h).toBeGreaterThan(0);
          expect(fill.x).toBeGreaterThanOrEqual(-2.25); expect(fill.y).toBeGreaterThanOrEqual(1.2);
          expect(fill.x+fill.w).toBeLessThanOrEqual(-2.25+w+1e-9);
          expect(fill.y+fill.h).toBeLessThanOrEqual(1.2+h+1e-9);
        }
      }
      for (const [w,h] of [[0,10],[-1,10],[10,NaN],[Infinity,10]]) expect(record(painter,w,h).fills).toHaveLength(0);
    });
  }
});
