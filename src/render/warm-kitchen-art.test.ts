import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FURNITURE } from '../game/furniture';
import { BASE_EQUIPMENT, BENCH, type Equipment, type Station } from '../game/kitchen';
import { furnitureIcon, floorFurnitureBounds, FIG } from './furniture-art';
import { collectionSprite } from './furnishing-collection';
import { BENCH_RISE, BINS_RISE, DISH_PIT_RISE, FRIDGE_RISE, RACK_RISE, paintBench, paintBins, paintDishPit, paintKitchen, paintPastryFridge, paintRack } from './kitchen-art';

type Box = [number, number, number, number];
/** Small canvas rasterizer: production fills, clipped reflections and nearest-
 * neighbor scaling are all exercised without a GPU or golden-color snapshots. */
class PixelCanvas {
  width = 0; height = 0;
  pixels = new Map<string, string>();
  getContext() {
    const canvas = this;
    let clip: Box | null = null, path: Box | null = null;
    const stack: { clip: Box | null; alpha: number; color: string }[] = [];
    return {
      fillStyle: '', globalAlpha: 1, imageSmoothingEnabled: false,
      save() { stack.push({ clip, alpha: this.globalAlpha, color: this.fillStyle }); },
      restore() { const s = stack.pop()!; clip = s.clip; this.globalAlpha = s.alpha; this.fillStyle = s.color; },
      beginPath() { path = null; },
      rect(x: number, y: number, w: number, h: number) { path = [x, y, w, h]; },
      clip() { clip = path; },
      fillRect(x: number, y: number, w: number, h: number) {
        if (![x, y, w, h].every(Number.isFinite)) throw new Error('Non-finite art rectangle');
        for (let py = Math.ceil(y); py < y + h; py++) for (let px = Math.ceil(x); px < x + w; px++) {
          if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
          if (clip && (px < clip[0] || py < clip[1] || px >= clip[0] + clip[2] || py >= clip[1] + clip[3])) continue;
          if (this.globalAlpha > 0) canvas.pixels.set(`${px},${py}`, `${this.fillStyle}:${this.globalAlpha}`);
        }
      },
      drawImage(source: PixelCanvas, x: number, y: number, w = source.width, h = source.height) {
        for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
          const color = source.pixels.get(`${Math.floor(dx / w * source.width)},${Math.floor(dy / h * source.height)}`);
          if (color && x + dx >= 0 && y + dy >= 0 && x + dx < canvas.width && y + dy < canvas.height) canvas.pixels.set(`${x + dx},${y + dy}`, color);
        }
      },
    };
  }
}
const createCanvas = vi.fn(() => new PixelCanvas());
const pixels = (c: HTMLCanvasElement) => (c as unknown as PixelCanvas).pixels;
const signature = (c: HTMLCanvasElement) => [...pixels(c)].join('|');
function paint(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = new PixelCanvas(); c.width = w; c.height = h;
  draw(c.getContext() as unknown as CanvasRenderingContext2D);
  return c as unknown as HTMLCanvasElement;
}
const installed = new Set<Equipment>([...BASE_EQUIPMENT, 'mixer', 'proofer', 'kettle', 'deckOven', 'convection', 'fryer', 'pastryFridge', 'sheeter', 'standMixer']);
const kitchen = (active: ReadonlySet<Station> = new Set(), t = 0, locked = false, equipment = installed) => paint(320, 200, ctx => paintKitchen(ctx, 200, t, locked, equipment, active));

beforeAll(() => vi.stubGlobal('document', { createElement: createCanvas }));
afterAll(() => vi.unstubAllGlobals());

describe('reference A furniture coverage and registration', () => {
  it('provides distinct, nonempty cached icons for the entire 39-piece catalog', () => {
    expect(FURNITURE).toHaveLength(39);
    const signatures = new Set<string>();
    for (const def of FURNITURE) {
      const icon = furnitureIcon(def.id);
      expect([icon.width, icon.height], def.id).toEqual([28, 24]);
      expect(pixels(icon).size, def.id).toBeGreaterThan(20);
      expect(pixels(icon).size, def.id).toBeLessThan(28 * 24);
      expect(furnitureIcon(def.id)).toBe(icon);
      signatures.add(signature(icon));
    }
    expect(signatures.size).toBe(FURNITURE.length);
  });
  it('retains native ground anchors and transparent backgrounds after structural redraws', () => {
    const dimensions: Record<string, number[]> = {
      plant_fig: [16, 23], plant_snake: [9, 17], coatrack: [10, 28], lamp: [13, 24],
      aframe: [16, 19], bench: [32, 16], catbed: [18, 11], bookshelf: [32, 34],
      armchair: [24, 22], gramophone: [18, 22], piano: [40, 30],
      sideboard: [30, 26], sofa: [32, 26], round_stool: [14, 18], display_cabinet: [24, 36],
      magazine_rack: [16, 24], coffee_cart: [30, 28],
    };
    for (const [id, [w, h]] of Object.entries(dimensions)) expect(floorFurnitureBounds(id, 100, 140), id).toEqual({ x: 100 - w / 2, y: 141 - h, w, h });
    expect(pixels(FIG()).has('0,0')).toBe(false);
    expect([...pixels(FIG()).keys()].filter(key => Number(key.split(',')[1]) < 15).length).toBeGreaterThan(155);
  });
  it('does not allocate a new canvas after furniture and collection caches are warm', () => {
    for (const def of FURNITURE) furnitureIcon(def.id);
    const count = createCanvas.mock.calls.length;
    for (let tick = 0; tick < 30; tick++) for (const def of FURNITURE) {
      furnitureIcon(def.id); if (!def.id.startsWith('art_')) collectionSprite(def.id);
    }
    expect(createCanvas.mock.calls.length).toBe(count);
  });
});

describe('reference A kitchen states and unchanged geometry', () => {
  it('keeps locked, unfitted and installed artwork separate and deterministic', () => {
    expect(signature(kitchen(new Set(), 0, true))).toBe(signature(kitchen(new Set<Station>(['deckOven', 'mixer']), 30, true, new Set())));
    expect(signature(kitchen())).not.toBe(signature(kitchen(new Set(), 0, false, new Set(BASE_EQUIPMENT))));
    expect(signature(kitchen())).toBe(signature(kitchen(new Set(), 100)));
  });
  it.each(['cooler', 'dryStore', 'mixer', 'proofer', 'kettle', 'deckOven', 'convection', 'fryer'] as const)('shows %s work through local process detail', station => {
    expect(signature(kitchen(new Set([station]), 0.2))).not.toBe(signature(kitchen()));
    expect(signature(kitchen(new Set([station]), 0.2))).toBe(signature(kitchen(new Set([station]), 0.2)));
  });
  it.each(['mixer', 'proofer', 'kettle', 'deckOven', 'convection', 'fryer'] as const)('retains animated %s working marks', station => {
    expect(signature(kitchen(new Set([station]), 0))).not.toBe(signature(kitchen(new Set([station]), 0.95)));
  });
  it('gives all four prep-bench equipment combinations unique art at the same size', () => {
    const versions = [];
    for (const sheeter of [false, true]) for (const mixer of [false, true]) versions.push(paint(BENCH.w + 20, BENCH_RISE + 1, ctx => paintBench(ctx, 10 + BENCH.w / 2, BENCH_RISE, sheeter, mixer)));
    expect(new Set(versions.map(signature)).size).toBe(4);
    for (const version of versions) { expect(pixels(version).size).toBeGreaterThan(2000); expect(pixels(version).has('0,0')).toBe(false); }
  });
  it('keeps all floor fixtures composable and stock-bearing without new canvas allocation', () => {
    const rack = paint(42, RACK_RISE + 1, ctx => paintRack(ctx, 10, RACK_RISE, ['roll', 'croissant']));
    const emptyRack = paint(42, RACK_RISE + 1, ctx => paintRack(ctx, 10, RACK_RISE, []));
    const fridge = paint(40, FRIDGE_RISE + 1, ctx => paintPastryFridge(ctx, 10, FRIDGE_RISE, ['cake']));
    const emptyFridge = paint(40, FRIDGE_RISE + 1, ctx => paintPastryFridge(ctx, 10, FRIDGE_RISE, []));
    const bins = paint(60, BINS_RISE + 1, ctx => paintBins(ctx, 10, BINS_RISE));
    const pit = paint(94, DISH_PIT_RISE + 1, ctx => paintDishPit(ctx, 10, DISH_PIT_RISE));
    expect(signature(rack)).not.toBe(signature(emptyRack)); expect(signature(fridge)).not.toBe(signature(emptyFridge));
    for (const fixture of [rack, fridge, bins, pit]) { expect(pixels(fixture).size).toBeGreaterThan(200); expect(pixels(fixture).has('0,0')).toBe(false); }
    const allocated = createCanvas.mock.calls.length;
    kitchen(new Set(['mixer', 'deckOven'])); kitchen(new Set(['mixer', 'deckOven']), 3);
    expect(createCanvas.mock.calls.length).toBe(allocated);
  });
});
