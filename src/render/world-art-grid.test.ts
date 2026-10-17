import { describe, expect, it, vi } from 'vitest';
import { gridSafeContext, resampleRgba, WORLD_ART_DENSITY } from './world-art-grid';

type Rgba = readonly [number, number, number, number];
const CLEAR: Rgba = [0, 0, 0, 0];
const INK: Rgba = [62, 38, 30, 255];
const CREAM: Rgba = [242, 226, 196, 255];
const SAGE: Rgba = [124, 150, 110, 255];

function image(width: number, height: number, paint: (x: number, y: number) => Rgba): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(paint(x, y), (y * width + x) * 4);
  return data;
}
const pixel = (data: Uint8ClampedArray, width: number, x: number, y: number) => [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 4)];
const colours = (data: Uint8ClampedArray) => new Set(Array.from({ length: data.length / 4 }, (_, i) => data.slice(i * 4, i * 4 + 4).join()));

describe('world art grid', () => {
  it('uses two art pixels per room pixel', () => {
    expect(WORLD_ART_DENSITY).toBe(2);
  });

  it('halves art authored in 2×2 blocks without losing or inventing a colour', () => {
    const source = image(8, 8, (x, y) => [CREAM, SAGE, INK][(Math.floor(x / 2) + Math.floor(y / 2)) % 3]);
    const out = resampleRgba(source, 8, 8, 4, 4);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) expect(pixel(out, 4, x, y)).toEqual([...[CREAM, SAGE, INK][(x + y) % 3]]);
  });

  it('keeps the dominant colour of each cell instead of blending', () => {
    // Each 3×3 cell is mostly cream with one sage pixel: the output stays pure cream.
    const source = image(9, 9, (x, y) => x % 3 === 1 && y % 3 === 1 ? SAGE : CREAM);
    const out = resampleRgba(source, 9, 9, 3, 3);
    expect(colours(out)).toEqual(new Set([CREAM.join()]));
  });

  it('turns a cell transparent only when most of it is transparent', () => {
    const source = image(4, 2, x => x === 0 ? CLEAR : x === 1 ? CREAM : x === 2 ? CREAM : CLEAR);
    // Cells [0,1] and [2,3] are each half covered: covered wins ties so silhouettes do not shrink.
    expect(pixel(resampleRgba(source, 4, 2, 2, 1), 2, 0, 0)).toEqual([...CREAM]);
    const sparse = image(4, 4, (x, y) => x === 0 && y === 0 ? CREAM : CLEAR);
    expect(pixel(resampleRgba(sparse, 4, 4, 2, 2), 2, 0, 0)[3]).toBe(0);
  });

  it('restores a dark outline around a 4× silhouette resampled to 3/4 size', () => {
    // A 12×12 cream disc-ish square with a one-pixel ink outline, on transparency.
    const source = image(16, 16, (x, y) => {
      if (x < 2 || y < 2 || x > 13 || y > 13) return CLEAR;
      return x === 2 || y === 2 || x === 13 || y === 13 ? INK : CREAM;
    });
    const out = resampleRgba(source, 16, 16, 12, 12);
    for (let i = 2; i < 10; i++) {
      expect(pixel(out, 12, i, 2), `top ${i}`).toEqual([...INK]);
      expect(pixel(out, 12, 2, i), `left ${i}`).toEqual([...INK]);
    }
    expect(pixel(out, 12, 6, 6)).toEqual([...CREAM]);
    expect(pixel(out, 12, 0, 0)[3]).toBe(0);
  });

  it('does not draw a contour at the edge of a fully opaque region', () => {
    const source = image(8, 8, (x, y) => x === 0 || y === 0 ? INK : CREAM);
    const out = resampleRgba(source, 8, 8, 2, 2);
    expect(pixel(out, 2, 1, 1)).toEqual([...CREAM]);
    expect(pixel(out, 2, 1, 0)).toEqual([...CREAM]);
  });

  it('keeps translucent glass translucent', () => {
    const glass: Rgba = [210, 236, 240, 90];
    const out = resampleRgba(image(4, 4, () => glass), 4, 4, 2, 2);
    expect(pixel(out, 2, 1, 1)).toEqual([...glass]);
  });

  it('passes every context call through except grid-snapped image draws', () => {
    const drawImage = vi.fn(), fillRect = vi.fn();
    const raw = { fillStyle: '#000', drawImage, fillRect } as unknown as CanvasRenderingContext2D;
    const grid = gridSafeContext(raw);
    expect(gridSafeContext(raw)).toBe(grid);
    grid.fillStyle = '#123456';
    grid.fillRect(1, 2, 3, 4);
    // Without a pixel-addressable source the draw is untouched.
    const source = { width: 10, height: 10 } as unknown as HTMLCanvasElement;
    grid.drawImage(source, 0, 0, 10, 10, 1, 1, 5, 5);
    expect(raw.fillStyle).toBe('#123456');
    expect(fillRect).toHaveBeenCalledWith(1, 2, 3, 4);
    expect(drawImage).toHaveBeenCalledWith(source, 0, 0, 10, 10, 1, 1, 5, 5);
  });
});
