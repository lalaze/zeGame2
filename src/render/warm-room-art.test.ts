import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DECOR } from '../game/decor';
import { REGIONS } from '../game/regions';
import { createInitialState } from '../game/state';
import { COUNTER, FLOOR_Y, MIN_SCENE_H } from '../game/layout';
import { decorIcon, paintFloor, paintNeon, paintWall, plantSprite } from './decor-art';
import { beam, lightingAt } from './lighting';
import { cabinetPanel, timberBeam, treeLine } from './materials';
import { paintRegion } from './region-art';
import * as colors from './color';
import { CHAIR_LEFT, CHAIR_RIGHT, RoomPainter, TABLE, paintSunbeam } from './room-art';

type Draw = [number, number, number, number, string, number];
class ArtCanvas {
  width = 320;
  height = 260;
  draws: Draw[] = [];
  images: string[] = [];
  getContext() {
    const canvas = this;
    const stack: [string, number][] = [];
    return {
      measureText:(text:string)=>({width:[...text].length*5}),fillText() {},
      fillStyle: '', globalAlpha: 1, imageSmoothingEnabled: false,
      fillRect(x: number, y: number, w: number, h: number) {
        canvas.draws.push([x, y, w, h, this.fillStyle, this.globalAlpha]);
      },
      drawImage(source: ArtCanvas, ...args: number[]) {
        canvas.images.push(`${source.width}x${source.height}:${source.draws.length}:${args.join(',')}`);
      },
      save() { stack.push([this.fillStyle, this.globalAlpha]); },
      restore() { const prev = stack.pop(); if (prev) [this.fillStyle, this.globalAlpha] = prev; },
      beginPath() {}, arc() {}, rect() {}, clip() {}, moveTo() {}, lineTo() {}, fill() {},
      setLineDash() {}, strokeRect() {}, translate() {}, scale() {},
    };
  }
}
const create = vi.fn(() => new ArtCanvas());
beforeAll(() => vi.stubGlobal('document', { createElement: create }));
afterAll(() => vi.unstubAllGlobals());
const context = (c: ArtCanvas) => c.getContext() as unknown as CanvasRenderingContext2D;
const record = (paint: (ctx: CanvasRenderingContext2D) => void) => {
  const c = new ArtCanvas(); paint(context(c)); return c;
};
const signature = (c: ArtCanvas) => JSON.stringify([c.draws, c.images]);

describe('direction A material and room coverage', () => {
  it('renders every catalog finish and keeps its thumbnail cached', () => {
    const looks = new Set<string>();
    for (const def of DECOR) {
      const icon = decorIcon(def.id) as unknown as ArtCanvas;
      expect([icon.width, icon.height]).toEqual([28, 24]);
      expect(decorIcon(def.id)).toBe(icon);
      expect(icon.draws.length + icon.images.length, def.id).toBeGreaterThan(0);
      if (!def.id.endsWith('_none')) looks.add(signature(icon));
    }
    expect(looks.size).toBe(DECOR.filter(d => !d.id.endsWith('_none')).length);
  });

  it('mixes hot-path palettes once per repaint rather than per pixel', () => {
    const mix = vi.spyOn(colors, 'mix');
    try {
      record(ctx => paintWall(ctx, 'wall_cream', 0, 0, 320, 80));
      expect(mix.mock.calls.length).toBe(8);
      mix.mockClear();
      record(ctx => paintFloor(ctx, 'floor_herringbone', 0, 80, 320, 164));
      expect(mix.mock.calls.length).toBe(2);
      mix.mockClear();
      record(ctx => treeLine(ctx, 0, 28, 320, 52, 0.137));
      expect(mix.mock.calls.length).toBe(15);
    } finally { mix.mockRestore(); }
  });

  it('keeps authored wood joinery deterministic and inside its panel footprint', () => {
    for (const paint of [
      (ctx: CanvasRenderingContext2D) => timberBeam(ctx, 10, 12, 80, 8),
      (ctx: CanvasRenderingContext2D) => cabinetPanel(ctx, 10, 12, 80, 24, '#865332', true),
    ]) {
      const first = record(paint), second = record(paint);
      expect(first.draws).toEqual(second.draws);
      expect(new Set(first.draws.map(d => d[4])).size).toBeGreaterThan(5);
      expect(first.draws.every(([x, y, w, h]) => x >= 10 && y >= 12 && x + w <= 90 && y + h <= 36)).toBe(true);
    }
  });

  it('retains native plant, chair and table canvas dimensions and transparent sprites', () => {
    for (const [id, w, h] of [['plant_fern', 16, 15], ['plant_monstera', 22, 19], ['plant_lemon', 21, 22]] as const) {
      const sprite = plantSprite(id) as unknown as ArtCanvas;
      expect([sprite.width, sprite.height], id).toEqual([w, h]);
      expect(plantSprite(id)).toBe(sprite);
      expect(sprite.draws.some(([x, y, rw, rh]) => x <= 0 && y <= 0 && x + rw >= w && y + rh >= h)).toBe(false);
      expect(sprite.draws.every(([x, y, rw, rh]) => x >= 0 && y >= 0 && x + rw <= w && y + rh <= h), id).toBe(true);
    }
    expect([CHAIR_LEFT().width, CHAIR_LEFT().height]).toEqual([15, 26]);
    expect([CHAIR_RIGHT().width, CHAIR_RIGHT().height]).toEqual([15, 26]);
    expect([TABLE().width, TABLE().height]).toEqual([33, 27]);
  });

  it('authors each region in both owned/locked and day/night states without allocations after warmup', () => {
    const images = new Set<string>();
    const paintAll = () => {
      for (const { id } of REGIONS) for (const hour of [10, 22]) for (const locked of [true, false]) {
        const c = record(ctx => paintRegion(ctx, id, MIN_SCENE_H, 0, lightingAt(hour), locked));
        expect(c.draws.length, id).toBeGreaterThan(500);
        images.add(signature(c));
      }
    };
    paintAll(); const allocations = create.mock.calls.length; paintAll();
    expect(create.mock.calls.length).toBe(allocations);
    expect(images.size).toBe(REGIONS.length * 4);
  });

  it('keeps all floor materials deterministic, including stone chips and parquet joins', () => {
    for (const { id } of DECOR.filter(d => d.slot === 'floor')) {
      const paint = (ctx: CanvasRenderingContext2D) => paintFloor(ctx, id, 0, 80, 64, 64);
      expect(signature(record(paint)), id).toBe(signature(record(paint)));
    }
  });

  it('gives daylight panes enough reach to escape the counter but emits no night beam', () => {
    const sun = lightingAt(10).sun, shape = beam(sun);
    const c = record(ctx => paintSunbeam(ctx, sun, 12, 58, FLOOR_Y, shape.lean, shape.length));
    expect(c.draws.some(([, y]) => y > COUNTER.bottom)).toBe(true);
    expect(c.draws.every(([, , , , , a]) => a > 0 && a <= 0.44)).toBe(true);
    expect(record(ctx => paintSunbeam(ctx, lightingAt(22).sun, 12, 58, FLOOR_Y, 0, 100)).draws).toEqual([]);
  });

  it('caches sign glyphs and makes machine upgrade and brewing hardware visibly distinct', () => {
    const state = createInitialState(0), ctx = context(new ArtCanvas());
    const painter = new RoomPainter(ctx);
    painter.drawMenuBoard(state); paintNeon(ctx, 'neon_cafe', 30, 10, 0);
    const allocations = create.mock.calls.length;
    for (let i = 0; i < 12; i++) { painter.drawMenuBoard(state); paintNeon(ctx, 'neon_cafe', 30, 10, i); }
    expect(create.mock.calls.length).toBe(allocations);
    const signatures = new Set<string>();
    for (const level of [0, 5, 10, 15]) for (const working of [false, true]) {
      state.upgrades.machine = level;
      signatures.add(signature(record(ctx => new RoomPainter(ctx).drawCounter(state, 'counter_oak', 0, working ? [{ x: 120, fill: 0.5 }] : []))));
    }
    expect(signatures.size).toBe(8);
  });
});
