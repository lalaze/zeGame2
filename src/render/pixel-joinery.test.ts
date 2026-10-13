import { describe, expect, it, vi } from 'vitest';
import * as color from './color';
import { paintFineBeam, paintFineCabinet } from './pixel-joinery';

type Rect = [number, number, number, number, string];
type Painter = (ctx: CanvasRenderingContext2D) => void;

function record(paint: Painter) {
  const rects: Rect[] = [];
  const stack: string[] = [];
  const ctx = {
    fillStyle: '#initial', globalAlpha: 0.73, imageSmoothingEnabled: false,
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push([x, y, w, h, this.fillStyle]);
    },
    save() { stack.push(this.fillStyle); },
    restore() { this.fillStyle = stack.pop()!; },
  };
  paint(ctx as unknown as CanvasRenderingContext2D);
  return { rects, ctx, stack };
}

function signature(rects: Rect[]): string {
  let hash = 2166136261;
  for (const char of JSON.stringify(rects)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}

function assertBounds(rects: Rect[], x: number, y: number, w: number, h: number) {
  expect(rects.length).toBeGreaterThan(0);
  for (const [rx, ry, rw, rh] of rects) {
    expect([rx, ry, rw, rh].every(n => Number.isFinite(n) && Number.isInteger(n * 2))).toBe(true);
    expect(rw).toBeGreaterThan(0); expect(rh).toBeGreaterThan(0);
    expect(rx).toBeGreaterThanOrEqual(x); expect(ry).toBeGreaterThanOrEqual(y);
    expect(rx + rw).toBeLessThanOrEqual(x + w);
    expect(ry + rh).toBeLessThanOrEqual(y + h);
  }
}

describe('fine-pixel walnut joinery', () => {
  const footprints = [
    [0.5, 0.5], [1, 4], [3, 25], [6.5, 8], [10, 10],
    [17, 18], [22, 11], [80, 24], [640, 8],
  ];

  for (const [w, h] of footprints) it(`keeps all detail inside a ${w}×${h} footprint`, () => {
    for (const paint of [
      (ctx: CanvasRenderingContext2D) => paintFineCabinet(ctx, -3.5, 12, w, h, '#865332', true),
      (ctx: CanvasRenderingContext2D) => paintFineBeam(ctx, -3.5, 12, w, h),
      (ctx: CanvasRenderingContext2D) => paintFineBeam(ctx, -3.5, 12, w, h, true),
    ]) {
      const first = record(paint), second = record(paint);
      assertBounds(first.rects, -3.5, 12, w, h);
      expect(first.rects).toEqual(second.rects);
      expect(first.ctx.fillStyle).toBe('#initial');
      expect(first.ctx.globalAlpha).toBe(0.73);
      expect(first.ctx.imageSmoothingEnabled).toBe(false);
      expect(first.stack).toEqual([]);
    }
  });

  it('snaps off-grid caller bounds inward rather than bleeding outside the footprint', () => {
    for (const paint of [
      (ctx: CanvasRenderingContext2D) => paintFineCabinet(ctx, 0.13, -0.28, 17.35, 18.67, '#91603e', true),
      (ctx: CanvasRenderingContext2D) => paintFineBeam(ctx, 0.13, -0.28, 17.35, 18.67, true),
    ]) assertBounds(record(paint).rects, 0.13, -0.28, 17.35, 18.67);
  });

  it('authors half-pixel seams and material detail, rather than only increasing texture size', () => {
    for (const paint of [
      (ctx: CanvasRenderingContext2D) => paintFineCabinet(ctx, 0, 0, 17, 18, '#865332', true),
      (ctx: CanvasRenderingContext2D) => paintFineBeam(ctx, 0, 0, 80, 8),
    ]) {
      const { rects } = record(paint);
      expect(rects.filter(([x, y, w, h]) => [x, y, w, h].some(n => n % 1 === 0.5)).length).toBeGreaterThan(12);
      expect(new Set(rects.map(r => r[4])).size).toBeGreaterThanOrEqual(8);
    }
  });

  it('gives the optional brass fitting distinct light, return and contact-shadow marks', () => {
    const plain = record(ctx => paintFineCabinet(ctx, 0, 0, 17, 18));
    const handled = record(ctx => paintFineCabinet(ctx, 0, 0, 17, 18, undefined, true));
    expect(handled.rects.slice(0, plain.rects.length)).toEqual(plain.rects);
    expect(handled.rects.length - plain.rects.length).toBe(7);
    expect(handled.rects.some(r => r[4] === '#ffe0a0')).toBe(true);
    const narrow = record(ctx => paintFineCabinet(ctx, 0, 0, 6, 18, undefined, true));
    expect(narrow.rects.some(r => r[4] === '#ffe0a0')).toBe(false);
    const drawer = record(ctx => paintFineCabinet(ctx, 0, 0, 22, 11, undefined, true));
    const drawerGlint = drawer.rects.find(r => r[4] === '#ffe0a0')!;
    expect(drawerGlint[2]).toBeGreaterThan(drawerGlint[3]);
    expect(drawerGlint[0] + drawerGlint[2] / 2).toBe(11);
  });

  it('transposes the same beam construction for upright posts', () => {
    const horizontal = record(ctx => paintFineBeam(ctx, 0, 0, 80, 8)).rects;
    const vertical = record(ctx => paintFineBeam(ctx, 0, 0, 8, 80, true)).rects;
    expect(vertical).toEqual(horizontal.map(([x, y, w, h, c]) => [y, x, h, w, c]));
  });

  it('mixes one fixed palette and caps grain work independently of footprint area', () => {
    const mix = vi.spyOn(color, 'mix');
    try {
      for (const [w, h] of [[17, 18], [40000, 30000]]) {
        for (const paint of [
          (ctx: CanvasRenderingContext2D) => paintFineCabinet(ctx, 0, 0, w, h, '#99704e', true),
          (ctx: CanvasRenderingContext2D) => paintFineBeam(ctx, 0, 0, w, h),
        ]) {
          mix.mockClear();
          const { rects } = record(paint);
          expect(mix).toHaveBeenCalledTimes(9);
          expect(rects.length).toBeLessThan(400);
          assertBounds(rects, 0, 0, w, h);
        }
      }
    } finally { mix.mockRestore(); }
  });

  it('ignores empty, nonfinite and sub-grid surfaces', () => {
    for (const [x, y, w, h] of [
      [0, 0, 0, 20], [0, 0, 20, -1], [NaN, 0, 20, 20],
      [0, Infinity, 20, 20], [0, 0, Infinity, 20], [0.1, 0.1, 0.1, 0.1],
    ]) {
      expect(record(ctx => paintFineCabinet(ctx, x, y, w, h)).rects).toEqual([]);
      expect(record(ctx => paintFineBeam(ctx, x, y, w, h)).rects).toEqual([]);
    }
  });

  it('retains authored small and large material signatures', () => {
    const samples = [
      record(ctx => paintFineCabinet(ctx, 0, 0, 6, 8)).rects,
      record(ctx => paintFineCabinet(ctx, 0, 0, 17, 18, '#865332', true)).rects,
      record(ctx => paintFineCabinet(ctx, 0, 0, 80, 24, '#ad7850', true)).rects,
      record(ctx => paintFineBeam(ctx, 0, 0, 30, 4)).rects,
      record(ctx => paintFineBeam(ctx, 0, 0, 320, 8)).rects,
    ];
    expect(samples.map(signature)).toMatchInlineSnapshot(`
      [
        "de634541",
        "addf8187",
        "d15d3331",
        "7f9e4b44",
        "321d76e2",
      ]
    `);
  });
});
