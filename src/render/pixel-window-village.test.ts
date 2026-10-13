import { describe, expect, it } from 'vitest';
import { paintPixelWindowVillage } from './pixel-window-village';

type Rect = { x: number; y: number; w: number; h: number; color: string };
function marks(x = 0, y = 0, w = 46, h = 38, darkness = 0): Rect[] {
  const result: Rect[] = [];
  const ctx = {
    fillStyle: '',
    fillRect(this: { fillStyle: string }, rx: number, ry: number, rw: number, rh: number) {
      result.push({ x: rx, y: ry, w: rw, h: rh, color: this.fillStyle });
    },
  } as unknown as CanvasRenderingContext2D;
  paintPixelWindowVillage(ctx, x, y, w, h, darkness);
  return result;
}

describe('refined pixel window village', () => {
  it('paints deterministic layered art with a small valid palette', () => {
    const actual = marks();
    expect(actual).toEqual(marks());
    expect(actual.length).toBeGreaterThan(300);
    expect(actual.length).toBeLessThan(600);
    const colors = new Set(actual.map(mark => mark.color));
    expect(colors.size).toBeGreaterThan(15);
    expect(colors.size).toBeLessThanOrEqual(23);
    for (const color of colors) expect(color).toMatch(/^#[\da-f]{6}$/);
  });

  it('uses crisp half-world-pixel detail and leaves the upper third transparent', () => {
    const actual = marks();
    for (const { x, y, w, h } of actual) {
      expect([x, y, w, h].every(value => Number.isInteger(value * 2))).toBe(true);
      expect(y).toBeGreaterThanOrEqual(38 / 3);
    }
    expect(actual.some(mark => mark.w === .5 || mark.h === .5)).toBe(true);
    // No opaque sky or full-window backdrop is hidden under the fine detail.
    expect(actual.some(mark => mark.w === 46 && mark.h === 38)).toBe(false);
  });

  for (const [x, y, w, h] of [[12, 12, 46, 38], [262, 12, 46, 38], [0, 0, 94, 41], [-7.25, 3.1, 15.7, 8.8], [1, 1, .1, .1]]) {
    it(`keeps every finite positive draw inside ${w} × ${h} bounds at ${x}, ${y}`, () => {
      for (const rect of marks(x, y, w, h)) {
        expect([rect.x, rect.y, rect.w, rect.h].every(Number.isFinite)).toBe(true);
        expect(rect.w).toBeGreaterThan(0);
        expect(rect.h).toBeGreaterThan(0);
        expect(rect.x).toBeGreaterThanOrEqual(x);
        expect(rect.y).toBeGreaterThanOrEqual(y);
        expect(rect.x + rect.w).toBeLessThanOrEqual(x + w + 1e-10);
        expect(rect.y + rect.h).toBeLessThanOrEqual(y + h + 1e-10);
      }
    });
  }

  it('changes day to night colors without moving any leaves or roofs', () => {
    const day = marks();
    const night = marks(0, 0, 46, 38, 1);
    expect(night).not.toEqual(day);
    const geometry = (rects: Rect[]) => rects.map(({ x, y, w, h }) => ({ x, y, w, h }));
    expect(geometry(day)).toEqual(geometry(night));
    expect(marks(0, 0, 46, 38, .47)).toEqual(marks(0, 0, 46, 38, .47));
    expect(marks(0, 0, 46, 38, .47)).not.toEqual(day);
    expect(marks(0, 0, 46, 38, .47)).not.toEqual(night);
  });

  it('clamps darkness and ignores invalid geometry without emitting invalid colors', () => {
    expect(marks(0, 0, 46, 38, -1)).toEqual(marks());
    expect(marks(0, 0, 46, 38, 2)).toEqual(marks(0, 0, 46, 38, 1));
    expect(marks(0, 0, 46, 38, NaN)).toEqual(marks());
    expect(marks(0, 0, 46, 38, Infinity)).toEqual(marks());
    for (const [x, y, w, h] of [[NaN, 0, 46, 38], [0, Infinity, 46, 38], [0, 0, Infinity, 38], [0, 0, 46, NaN], [0, 0, 0, 38], [0, 0, 46, -1]]) {
      expect(marks(x, y, w, h)).toEqual([]);
    }
  });
});
