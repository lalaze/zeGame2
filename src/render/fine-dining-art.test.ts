import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fineChairCanvas, fineTableCanvas } from './fine-dining-art';

type Rect = { x: number; y: number; w: number; h: number; color: string };
class RasterCanvas {
  width = 0;
  height = 0;
  readonly pixels = new Map<string, string>();
  readonly rects: Rect[] = [];
  getContext() {
    const canvas = this;
    return {
      fillStyle: '',
      imageSmoothingEnabled: false,
      fillRect(x: number, y: number, w: number, h: number) {
        canvas.rects.push({ x, y, w, h, color: this.fillStyle });
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
          canvas.pixels.set(`${xx},${yy}`, this.fillStyle);
        }
      },
    };
  }
}
const raster = (canvas: HTMLCanvasElement) => canvas as unknown as RasterCanvas;
const signature = (canvas: HTMLCanvasElement) => [...raster(canvas).pixels].sort();
const create = vi.fn(() => new RasterCanvas());
beforeAll(() => vi.stubGlobal('document', { createElement: create }));
afterAll(() => vi.unstubAllGlobals());

describe('independently authored fine dining furniture', () => {
  it('keeps the exact 2× backing dimensions and cached identities', () => {
    const table = fineTableCanvas();
    const right = fineChairCanvas('right');
    const left = fineChairCanvas('left');
    expect([table.width, table.height]).toEqual([66, 54]);
    expect([right.width, right.height]).toEqual([30, 52]);
    expect([left.width, left.height]).toEqual([30, 52]);
    const creations = create.mock.calls.length;
    for (let i = 0; i < 20; i++) {
      expect(fineTableCanvas()).toBe(table);
      expect(fineChairCanvas('right')).toBe(right);
      expect(fineChairCanvas('left')).toBe(left);
    }
    expect(create.mock.calls.length).toBe(creations);
  });

  it('uses only positive finite integer rectangles within each native canvas', () => {
    for (const sprite of [fineTableCanvas(), fineChairCanvas('right'), fineChairCanvas('left')]) {
      const { rects } = raster(sprite);
      expect(rects.length).toBeGreaterThan(100);
      for (const { x, y, w, h, color } of rects) {
        expect([x, y, w, h].every(value => Number.isFinite(value) && Number.isInteger(value))).toBe(true);
        expect(w).toBeGreaterThan(0); expect(h).toBeGreaterThan(0);
        expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(sprite.width);
        expect(y + h).toBeLessThanOrEqual(sprite.height);
        expect(color).toMatch(/^#[\da-f]{6}$/);
      }
    }
  });

  it('keeps transparent surroundings, original foot baselines and open chair-back gaps', () => {
    for (const sprite of [fineTableCanvas(), fineChairCanvas('right'), fineChairCanvas('left')]) {
      const { pixels } = raster(sprite);
      for (const x of [0, sprite.width - 1]) for (let y = 0; y < sprite.height; y++) {
        expect(pixels.has(`${x},${y}`)).toBe(false);
      }
      for (let x = 0; x < sprite.width; x++) expect(pixels.has(`${x},0`)).toBe(false);
      expect([...pixels.keys()].some(key => Number(key.split(',')[1]) === sprite.height - 1)).toBe(true);
      expect(pixels.size).toBeLessThan(sprite.width * sprite.height * .75);
    }
    const chair = raster(fineChairCanvas('right')).pixels;
    for (const [x, y] of [[7, 9], [8, 19], [8, 28], [16, 42], [16, 49]]) {
      expect(chair.has(`${x},${y}`)).toBe(false);
    }
    // Pedestal remains inside its existing 15-world-pixel foot footprint.
    for (const [key] of raster(fineTableCanvas()).pixels) {
      const [x, y] = key.split(',').map(Number);
      if (y >= 44) { expect(x).toBeGreaterThanOrEqual(18); expect(x).toBeLessThanOrEqual(47); }
    }
  });

  it('mirrors every chair pixel exactly without moving the foot or the seat', () => {
    const right = raster(fineChairCanvas('right')).pixels;
    const left = raster(fineChairCanvas('left')).pixels;
    expect(left.size).toBe(right.size);
    for (const [key, color] of right) {
      const [x, y] = key.split(',').map(Number);
      expect(left.get(`${29 - x},${y}`)).toBe(color);
    }
  });

  it('contains fine native-pixel geometry, material ramps and rich cloth detail', () => {
    for (const sprite of [fineTableCanvas(), fineChairCanvas('right')]) {
      const { pixels, rects } = raster(sprite);
      expect(new Set(pixels.values()).size).toBeGreaterThan(sprite.width === 66 ? 30 : 15);
      expect(rects.some(rect => rect.x % 2 === 1 && rect.w === 1)).toBe(true);
      // Authored neighboring backing pixels often differ within a 2×2 cell;
      // this cannot be produced by enlarging the legacy rows with nearest-neighbor.
      let fineCells = 0;
      for (let y = 0; y < sprite.height; y += 2) for (let x = 0; x < sprite.width; x += 2) {
        const colors = new Set([pixels.get(`${x},${y}`), pixels.get(`${x + 1},${y}`), pixels.get(`${x},${y + 1}`), pixels.get(`${x + 1},${y + 1}`)]);
        if (colors.size > 1) fineCells++;
      }
      expect(fineCells).toBeGreaterThan(80);
    }
  });

  it('rebuilds deterministic artwork without consulting the gameplay random stream', async () => {
    const before = [signature(fineTableCanvas()), signature(fineChairCanvas('right')), signature(fineChairCanvas('left'))];
    const random = vi.spyOn(Math, 'random');
    vi.resetModules();
    const fresh = await import('./fine-dining-art');
    const after = [signature(fresh.fineTableCanvas()), signature(fresh.fineChairCanvas('right')), signature(fresh.fineChairCanvas('left'))];
    expect(after).toEqual(before);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });
});
