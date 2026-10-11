import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MENU } from '../game/data';
import { CATS } from '../game/pets';
import { mix, edge } from './color';
import { ITEM_ART, catFrames, itemArtwork, itemIcon } from './sprites';

// Record the production painter's native pixels. No browser or GPU is needed
// to check that each merged asset is complete, distinct, and correctly sized.
class PixelCanvas {
  width = 0;
  height = 0;
  pixels = new Map<string, string>();
  getContext() {
    const canvas = this;
    return {
      fillStyle: '',
      fillRect(x: number, y: number, w: number, h: number) {
        if (x < 0 || y < 0 || x + w > canvas.width || y + h > canvas.height) {
          throw new Error(`Artwork overflow: ${x},${y},${w},${h} in ${canvas.width}×${canvas.height}`);
        }
        for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
          canvas.pixels.set(`${x + dx},${y + dy}`, this.fillStyle);
        }
      },
    };
  }
}
const pixels = (canvas: HTMLCanvasElement) => (canvas as unknown as PixelCanvas).pixels;
const signature = (canvas: HTMLCanvasElement) => [...pixels(canvas)].sort().join('|');
const missingColors = [
  '#ff00ff', edge('#ff00ff'),
  mix('#ff00ff', '#fff1cf', 0.13), mix('#ff00ff', '#493951', 0.16),
];

beforeAll(() => vi.stubGlobal('document', { createElement: () => new PixelCanvas() }));
afterAll(() => vi.unstubAllGlobals());

describe('expanded menu artwork', () => {
  it('has authored art and complete palettes for every menu item', () => {
    expect(Object.keys(ITEM_ART).sort()).toEqual(MENU.map(item => item.id).sort());
    for (const item of MENU) {
      const art = ITEM_ART[item.id];
      expect(art.rows.length, item.id).toBeGreaterThan(0);
      for (const row of art.rows) for (const symbol of row) {
        if (symbol !== '.') expect(art.palette[symbol], `${item.id}: ${symbol}`).toMatch(/^#[\da-f]{6}$/i);
      }
    }
  });

  it('keeps game icons at native scale and produces separately cached 3× menu art', () => {
    const signatures = new Set<string>();
    for (const item of MENU) {
      const icon = itemIcon(item.id), artwork = itemArtwork(item.id), bare = itemIcon(item.id, false);
      expect([artwork.width, artwork.height]).toEqual([icon.width * 3, icon.height * 3]);
      expect([bare.width, bare.height]).toEqual([icon.width - 2, icon.height - 2]);
      expect(pixels(artwork).size).toBeGreaterThan(pixels(icon).size * 8);
      expect(itemIcon(item.id)).toBe(icon);
      expect(itemArtwork(item.id)).toBe(artwork);
      expect(artwork).not.toBe(icon);
      signatures.add(signature(icon));
    }
    expect(signatures.size).toBe(MENU.length);
  });
});

describe('adoptable cat artwork', () => {
  it('retains the original visiting ginger cat and gives every breed distinct cached art', () => {
    expect(catFrames()).toBe(catFrames('ginger'));
    const signatures = new Set<string>();
    for (const cat of CATS) {
      const frames = catFrames(cat.id);
      expect(catFrames(cat.id)).toBe(frames);
      signatures.add(signature(frames.idle));
      expect(new Set(Object.values(frames).map(signature)).size, cat.id).toBe(4);
      for (const frame of Object.values(frames)) {
        expect([frame.width, frame.height]).toEqual([18, 14]);
        expect(pixels(frame).size).toBeGreaterThan(100);
        for (const color of pixels(frame).values()) expect(missingColors).not.toContain(color);
      }
    }
    expect(signatures.size).toBe(CATS.length);
  });
});
