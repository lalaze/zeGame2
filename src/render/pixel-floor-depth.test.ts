import { describe, expect, it } from 'vitest';
import { paintPixelFloorDepth, type PixelFloorDepthOptions } from './pixel-floor-depth';

interface Fill { x: number; y: number; w: number; h: number; color: string }

function recordingContext() {
  const fills: Fill[] = [];
  const styles: string[] = [];
  const mock = {
    fillStyle: '#123456',
    save() { styles.push(this.fillStyle); },
    restore() { this.fillStyle = styles.pop()!; },
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push({ x, y, w, h, color: this.fillStyle });
    },
  };
  return { fills, mock, ctx: mock as unknown as CanvasRenderingContext2D };
}

function render(seed = 17, options: PixelFloorDepthOptions = {}) {
  const record = recordingContext();
  paintPixelFloorDepth(record.ctx, 8, 80, 304, 152, seed, options);
  return record;
}

describe('source-painted perspective limestone floor', () => {
  it('is deterministic for the same rectangle and seed', () => {
    expect(render().fills).toEqual(render().fills);
    expect(render(123).fills).toEqual(render(123).fills);
    expect(render(123).fills).not.toEqual(render(17).fills);
    // A material seed must not move the perspective grid.
    const joints = (seed: number) => render(seed).fills.filter(fill => fill.color === '#d2bc98');
    expect(joints(123)).toEqual(joints(17));
  });

  it('covers the exact requested floor and never draws outside it', () => {
    const { fills } = render();
    expect(fills[0]).toMatchObject({ x: 8, y: 80, w: 304, h: 152 });
    for (const fill of fills) {
      expect([fill.x, fill.y, fill.w, fill.h].every(Number.isFinite)).toBe(true);
      expect(fill.w).toBeGreaterThan(0);
      expect(fill.h).toBeGreaterThan(0);
      expect(fill.x).toBeGreaterThanOrEqual(8);
      expect(fill.y).toBeGreaterThanOrEqual(80);
      expect(fill.x + fill.w).toBeLessThanOrEqual(312);
      expect(fill.y + fill.h).toBeLessThanOrEqual(232);
      expect(Number.isInteger(fill.x) && Number.isInteger(fill.y)).toBe(true);
      expect(Number.isInteger(fill.w) && Number.isInteger(fill.h)).toBe(true);
    }
  });

  it('compresses distant rows and converges the column seams toward the back', () => {
    const { fills } = render();
    const joints = fills.filter(fill => fill.color === '#d2bc98');
    const courses = joints.filter(fill => fill.w === 304).map(fill => fill.y);
    const firstRowHeight = courses[0] - 80;
    const lastRowHeight = 232 - courses.at(-1)!;
    expect(firstRowHeight).toBeLessThan(lastRowHeight);
    const seamsAt = (y: number) => joints.filter(fill => fill.y === y && fill.w === 1).map(fill => fill.x);
    const back = seamsAt(80), front = seamsAt(231);
    const backPitch = back[2] - back[1], frontPitch = front[2] - front[1];
    expect(backPitch).toBeLessThan(frontPitch);
    expect(backPitch / frontPitch).toBeCloseTo(0.8, 1);
  });

  it('supports a finer art pixel without adding smoothing or changing course count', () => {
    const coarse = render();
    const fine = render(17, { pixelSize: 0.5 });
    expect(fine.fills.some(fill => fill.w === 0.5)).toBe(true);
    const courses = (fills: Fill[]) => fills.filter(fill => fill.w === 304 && fill.color === '#d2bc98');
    expect(courses(fine.fills)).toHaveLength(courses(coarse.fills).length);
    for (const fill of fine.fills) {
      expect([fill.x, fill.y, fill.w, fill.h].every(n => Number.isInteger(n * 2))).toBe(true);
    }
  });

  it('restores caller state after painting', () => {
    expect(render().mock.fillStyle).toBe('#123456');
  });

  it('keeps tiny and fractional rectangles bounded with positive geometry', () => {
    for (const [x, y, w, h] of [[0, 0, 1, 1], [-8.25, 2.5, 0.25, 0.75], [5.2, 9.7, 30.3, 16.8]]) {
      const { ctx, fills } = recordingContext();
      paintPixelFloorDepth(ctx, x, y, w, h);
      expect(fills[0]).toMatchObject({ x, y, w, h });
      for (const fill of fills) {
        expect(fill.w).toBeGreaterThan(0);
        expect(fill.h).toBeGreaterThan(0);
        expect(fill.x).toBeGreaterThanOrEqual(x);
        expect(fill.y).toBeGreaterThanOrEqual(y);
        expect(fill.x + fill.w).toBeLessThanOrEqual(x + w + 1e-10);
        expect(fill.y + fill.h).toBeLessThanOrEqual(y + h + 1e-10);
      }
    }
  });

  it('rejects invalid rectangles and bounds work for pathological options', () => {
    for (const rect of [[0, 0, 0, 4], [0, 0, -1, 4], [0, 0, 4, -1], [NaN, 0, 4, 4], [0, 0, Infinity, 4]]) {
      const { ctx, fills } = recordingContext();
      paintPixelFloorDepth(ctx, rect[0], rect[1], rect[2], rect[3]);
      expect(fills).toHaveLength(0);
    }
    const { ctx, fills } = recordingContext();
    paintPixelFloorDepth(ctx, 0, 0, 100_000, 100_000, Infinity, { pixelSize: 1e-9, columns: 1e9, rows: 1e9 });
    expect(fills.length).toBeLessThan(175_000);
    expect(fills.every(fill => [fill.x, fill.y, fill.w, fill.h].every(Number.isFinite) && fill.w > 0 && fill.h > 0)).toBe(true);
    expect(render(NaN, { pixelSize: NaN, columns: NaN, rows: NaN }).fills).toEqual(render().fills);
  });
});
