import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { CUSTOMER_CAST } from '../game/customer-cast';
import { CATS } from '../game/pets';
import { catFrames, character, CHAR_H, itemIcon, type CharacterFrames, type Role } from './sprites';
import { fineSpriteArt, logicalCrop, registerFineSpriteArt } from './fine-sprite-art';

class RasterCanvas {
  width = 0;
  height = 0;
  pixels = new Map<string, string>();
  getContext() {
    const canvas = this;
    let tx = 0, sx = 1;
    return {
      fillStyle: '', imageSmoothingEnabled: false,
      fillRect(x: number, y: number, w: number, h: number) {
        if (![x, y, w, h].every(Number.isInteger) || x < 0 || y < 0 || x + w > canvas.width || y + h > canvas.height) {
          throw new Error(`Fine sprite mark outside canvas: ${x},${y},${w},${h} / ${canvas.width},${canvas.height}`);
        }
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) canvas.pixels.set(`${xx},${yy}`, this.fillStyle);
      },
      translate(x: number) { tx += x; }, scale(x: number) { sx *= x; },
      drawImage(source: RasterCanvas) {
        for (const [key, color] of source.pixels) {
          const [x, y] = key.split(',').map(Number);
          canvas.pixels.set(`${sx === -1 ? tx - x - 1 : tx + x},${y}`, color);
        }
      },
    };
  }
}
const create = vi.fn(() => new RasterCanvas());
beforeAll(() => vi.stubGlobal('document', { createElement: create }));
afterAll(() => vi.unstubAllGlobals());
const pixels = (canvas: HTMLCanvasElement) => (canvas as unknown as RasterCanvas).pixels;
const signature = (canvas: HTMLCanvasElement) => [...pixels(canvas)].sort().join('|');
const allFrames = (f: CharacterFrames) => [...f.down, ...f.up, ...f.right, ...f.left, f.sitRight, f.sitLeft, ...f.sitPetRight, ...f.sitPetLeft];
const look = { skin: 0, hair: 1, hairStyle: 0, shirt: 0, pants: 0 };
const bounds = (canvas: HTMLCanvasElement) => {
  const points = [...pixels(canvas).keys()].map(key => key.split(',').map(Number));
  return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
    Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
};

describe('independent fine-grid character artwork', () => {
  it('keeps every legacy pose dimension and attaches exactly doubled artwork', () => {
    for (const role of ['owner', 'barista', 'server', 'cook', 'customer'] as const) {
      const frames = character(look, role);
      expect(frames.stand).toBe(frames.down[0]);
      for (const frame of [...frames.down, ...frames.up, ...frames.right, ...frames.left]) expect([frame.width, frame.height]).toEqual([18, CHAR_H]);
      for (const frame of [frames.sitLeft, frames.sitRight]) expect([frame.width, frame.height]).toEqual([18, 26]);
      for (const frame of [...frames.sitPetLeft, ...frames.sitPetRight]) expect([frame.width, frame.height]).toEqual([18, 34]);
      for (const frame of allFrames(frames)) {
        const art = fineSpriteArt(frame);
        expect(art.canvas).not.toBe(frame);
        expect(art).toMatchObject({ density: 2, logicalWidth: frame.width, logicalHeight: frame.height });
        expect([art.canvas.width, art.canvas.height]).toEqual([frame.width * 2, frame.height * 2]);
        expect([...pixels(art.canvas).values()]).not.toContain('#ff00ff');
      }
    }
  });

  it('preserves the original transparent envelope, silhouette extrema and foot baseline', () => {
    for (const design of CUSTOMER_CAST) for (const frame of allFrames(character(design.look, 'customer', design.id))) {
      const art = fineSpriteArt(frame).canvas;
      for (const key of pixels(art).keys()) {
        const [x, y] = key.split(',').map(Number);
        expect(pixels(frame).has(`${Math.floor(x / 2)},${Math.floor(y / 2)}`)).toBe(true);
      }
      const [x0, y0, x1, y1] = bounds(frame);
      expect(bounds(art)).toEqual([x0 * 2, y0 * 2, (x1 + 1) * 2 - 1, (y1 + 1) * 2 - 1]);
    }
  });

  it('authors half-grid contour turns and interior details beyond a 2× enlargement', () => {
    const frame = character(look, 'owner').stand, art = fineSpriteArt(frame).canvas;
    let partialContour = 0, variedInterior = 0;
    for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
      const block = [0, 1].flatMap(dy => [0, 1].map(dx => pixels(art).get(`${x * 2 + dx},${y * 2 + dy}`)));
      const filled = block.filter(Boolean).length;
      if (filled > 0 && filled < 4) partialContour++;
      if (filled === 4 && new Set(block).size > 1) variedInterior++;
    }
    expect(partialContour).toBeGreaterThan(12);
    expect(variedInterior).toBeGreaterThan(40);
    // Distinct fine values exist in the face, hair, garment and shoe regions.
    for (const [from, to] of [[2, 14], [16, 27], [30, 44], [46, 54]]) {
      const region = [...pixels(art)].filter(([key]) => {
        const y = Number(key.split(',')[1]); return y >= from && y < to;
      });
      expect(new Set(region.map(([, c]) => c)).size).toBeGreaterThan(5);
    }
  });

  it('mirrors every fine walking, seated and petting frame with its legacy source', () => {
    for (const design of CUSTOMER_CAST) {
      const f = character(design.look, 'customer', design.id);
      const pairs = [...f.right.map((r, i) => [r, f.left[i]]), [f.sitRight, f.sitLeft],
        ...f.sitPetRight.map((r, i) => [r, f.sitPetLeft[i]])];
      for (const [right, left] of pairs) {
        const r = fineSpriteArt(right), l = fineSpriteArt(left);
        expect(pixels(r.canvas).size).toBe(pixels(l.canvas).size);
        for (const [key, color] of pixels(r.canvas)) {
          const [x, y] = key.split(',').map(Number);
          expect(pixels(l.canvas).get(`${r.canvas.width - 1 - x},${y}`)).toBe(color);
        }
      }
    }
  });

  it('keeps thirty distinct appearances, three gait frames, and both petting gestures', () => {
    const fronts = new Set<string>(), seats = new Set<string>(), pets = new Set<string>();
    for (const design of CUSTOMER_CAST) {
      const f = character(design.look, 'customer', design.id);
      fronts.add(signature(fineSpriteArt(f.stand).canvas));
      seats.add(signature(fineSpriteArt(f.sitRight).canvas));
      pets.add(signature(fineSpriteArt(f.sitPetRight[0]).canvas));
      for (const direction of [f.down, f.up, f.right, f.left]) expect(new Set(direction.map(frame => signature(fineSpriteArt(frame).canvas))).size).toBe(3);
      expect(new Set(f.sitPetRight.map(frame => signature(fineSpriteArt(frame).canvas))).size).toBe(2);
      const seated = pixels(fineSpriteArt(f.sitRight).canvas);
      for (const frame of f.sitPetRight) {
        const pet = pixels(fineSpriteArt(frame).canvas);
        for (const [key, color] of seated) if (Number(key.split(',')[1]) < 34) expect(pet.get(key)).toBe(color);
      }
    }
    expect([fronts.size, seats.size, pets.size]).toEqual([30, 30, 30]);
  });

  it('returns stable source, artwork, metadata and mirrored objects without repaint allocations', () => {
    const samples = (['owner', 'barista', 'customer'] as Role[]).map(role => character(look, role));
    const fine = samples.flatMap(allFrames).map(fineSpriteArt);
    const count = create.mock.calls.length;
    for (let i = 0; i < 20; i++) {
      (['owner', 'barista', 'customer'] as Role[]).forEach((role, j) => expect(character({ ...look }, role)).toBe(samples[j]));
      samples.flatMap(allFrames).forEach((frame, j) => expect(fineSpriteArt(frame)).toBe(fine[j]));
    }
    expect(create.mock.calls.length).toBe(count);
  });

  it('does not allocate any fine canvases until that pose is actually requested', () => {
    const count = create.mock.calls.length;
    const f = character({ skin: 3, hair: 5, hairStyle: 3, shirt: 7, pants: 2 }, 'owner');
    // Twelve authored legacy poses plus six original mirrored canvases.
    expect(create.mock.calls.length - count).toBe(18);
    fineSpriteArt(f.right[0]);
    expect(create.mock.calls.length - count).toBe(19);
    fineSpriteArt(f.right[0]);
    expect(create.mock.calls.length - count).toBe(19);
    fineSpriteArt(f.left[0]);
    expect(create.mock.calls.length - count).toBe(20);
    fineSpriteArt(f.left[0]);
    expect(create.mock.calls.length - count).toBe(20);
  });

  it('converts logical crops to backing pixels without changing the seated anchor', () => {
    const f = character(look, 'customer');
    for (const frame of [f.sitRight, f.sitLeft, ...f.sitPetRight, ...f.sitPetLeft]) {
      expect(logicalCrop(frame, 0, 0, frame.width, CHAR_H - 8)).toEqual({ x: 0, y: 0, width: 36, height: 40 });
      expect(logicalCrop(frame, -2, -1, 4, 3)).toEqual({ x: 0, y: 0, width: 4, height: 4 });
    }
  });

  it('leaves all cats and menu icon canvases at their existing sizes and density', () => {
    for (const cat of CATS) for (const value of Object.values(catFrames(cat.id))) {
      for (const frame of Array.isArray(value) ? value : [value]) {
        const art = fineSpriteArt(frame);
        expect(art.canvas).toBe(frame); expect(art.density).toBe(1);
        expect(frame.width).toBe(18); expect([14, 18]).toContain(frame.height);
        expect(fineSpriteArt(frame)).toBe(art);
      }
    }
    const cup = itemIcon('espresso', false);
    expect([cup.width, cup.height]).toEqual([12, 12]);
    expect(fineSpriteArt(cup).canvas).toBe(cup);
    expect(logicalCrop(cup, 1, 2, 4, 5)).toEqual({ x: 1, y: 2, width: 4, height: 5 });
  });

  it('rejects mismatched backing registration instead of silently moving sprite bounds', () => {
    const original = new RasterCanvas(), backing = new RasterCanvas();
    original.width = 18; original.height = 28; backing.width = 36; backing.height = 55;
    expect(() => registerFineSpriteArt(original as unknown as HTMLCanvasElement, backing as unknown as HTMLCanvasElement)).toThrow(/dimensions/);
  });

  it.runIf(!!process.env.FINE_SPRITE_RASTER)('exports optional production-raster comparison evidence', () => {
    const customer = (id: number) => character(CUSTOMER_CAST[id].look, 'customer', id);
    const samples: [string, HTMLCanvasElement][] = [
      ['owner/front', character(look, 'owner').stand],
      ['barista/step', character({ ...look, hairStyle: 2 }, 'barista').right[1]],
      ['glasses/front', customer(0).stand], ['dress/seated', customer(5).sitRight],
      ['hoodie/back', customer(6).up[1]], ['sailor/step', customer(9).right[2]],
      ['petting/a', customer(21).sitPetRight[0]], ['petting/b', customer(21).sitPetRight[1]],
    ];
    const assets = samples.map(([name, original]) => {
      const fine = fineSpriteArt(original).canvas;
      const raster = (canvas: HTMLCanvasElement) => ({ width: canvas.width, height: canvas.height, pixels: [...pixels(canvas)] });
      return { name, original: raster(original), fine: raster(fine) };
    });
    writeFileSync(process.env.FINE_SPRITE_RASTER!, JSON.stringify(assets));
  });
});
