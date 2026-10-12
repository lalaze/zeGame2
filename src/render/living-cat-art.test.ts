import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CATS } from '../game/pets';
import { catFrames, character, type CatFrames } from './sprites';
import { CUSTOMER_CAST } from '../game/customer-cast';
import { edge, mix } from './color';
import { residentCatFlipX } from './living-cat-pose';

// Capture production rasterization, including selective outlines and shading.
class PixelCanvas {
  width = 0;
  height = 0;
  pixels = new Map<string, string>();
  getContext() {
    const canvas = this;
    let tx = 0, sx = 1;
    return {
      fillStyle: '',
      translate(x: number) { tx += x; },
      scale(x: number) { sx *= x; },
      drawImage(source: PixelCanvas) {
        for (const [key, color] of source.pixels) {
          const [x, y] = key.split(',').map(Number);
          canvas.pixels.set(`${sx === -1 ? tx - x - 1 : tx + x},${y}`, color);
        }
      },
      fillRect(x: number, y: number, w: number, h: number) {
        for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
          expect(x + dx).toBeGreaterThanOrEqual(0);
          expect(y + dy).toBeGreaterThanOrEqual(0);
          expect(x + dx).toBeLessThan(canvas.width);
          expect(y + dy).toBeLessThan(canvas.height);
          canvas.pixels.set(`${x + dx},${y + dy}`, this.fillStyle);
        }
      },
    };
  }
}
const missingColors = ['#ff00ff', edge('#ff00ff'), mix('#ff00ff', '#fff1cf', 0.13), mix('#ff00ff', '#493951', 0.16)];
const createCanvas = vi.fn(() => new PixelCanvas());
const pixels = (frame: HTMLCanvasElement) => (frame as unknown as PixelCanvas).pixels;
const signature = (frame: HTMLCanvasElement) => [...pixels(frame)].sort().join('|');
const allFrames = (f: CatFrames) => [f.idle, f.swish, f.blink, f.happy, ...f.walk, f.sleep, ...f.groom, f.stretch, f.watch];

beforeAll(() => vi.stubGlobal('document', { createElement: createCanvas }));
afterAll(() => vi.unstubAllGlobals());

describe('living café cat artwork', () => {
  it('keeps every pose of all twelve breeds on the same small ground registration', () => {
    expect(CATS).toHaveLength(12);
    for (const cat of CATS) for (const frame of allFrames(catFrames(cat.id))) {
      expect([frame.width, frame.height]).toEqual([18, 14]);
      expect(pixels(frame).size).toBeGreaterThan(75);
      const ys = [...pixels(frame).keys()].map(key => Number(key.split(',')[1]));
      expect(Math.max(...ys)).toBe(13);
      for (const color of pixels(frame).values()) expect(missingColors).not.toContain(color);
    }
  });

  it('renders eleven distinct expressions and body poses for each breed', () => {
    for (const cat of CATS) expect(new Set(allFrames(catFrames(cat.id)).map(signature)).size).toBe(11);
  });

  it('retains twelve recognizable breed appearances in every behavior', () => {
    const breeds = CATS.map(cat => allFrames(catFrames(cat.id)));
    for (let pose = 0; pose < 11; pose++) {
      expect(new Set(breeds.map(frames => signature(frames[pose]))).size).toBe(12);
    }
  });

  it('closes only the eyes when blinking, without repainting breed face markings', () => {
    for (const cat of CATS) {
      const frames = catFrames(cat.id);
      // Interior forehead and muzzle pixels keep their exact breed palette.
      for (const key of ['3,4', '6,4', '6,6', '5,7']) {
        expect(pixels(frames.blink).get(key)).toBe(pixels(frames.idle).get(key));
      }
    }
  });

  it('reuses cached frame objects and arrays without allocating canvases on repeated draws', () => {
    const frames = CATS.map(cat => catFrames(cat.id));
    const allocated = createCanvas.mock.calls.length;
    for (let tick = 0; tick < 100; tick++) CATS.forEach((cat, i) => {
      expect(catFrames(cat.id)).toBe(frames[i]);
      expect(catFrames(cat.id).walk).toBe(frames[i].walk);
      expect(catFrames(cat.id).groom).toBe(frames[i].groom);
    });
    expect(createCanvas.mock.calls.length).toBe(allocated);
    expect(catFrames()).toBe(catFrames('ginger'));
  });
});


describe('cat and seated guest affection artwork', () => {
  it('retains all twelve breeds in taller, grounded interaction poses', () => {
    const unique = [new Set<string>(), new Set<string>(), new Set<string>()];
    for (const cat of CATS) {
      const f = catFrames(cat.id);
      const poses = [f.lookUp, ...f.nuzzle];
      expect(new Set(poses.map(signature)).size).toBe(3);
      poses.forEach((frame, i) => {
        unique[i].add(signature(frame));
        expect([frame.width, frame.height]).toEqual([18, 18]);
        const ys = [...pixels(frame).keys()].map(key => Number(key.split(',')[1]));
        expect(Math.max(...ys)).toBe(17);
        for (const color of pixels(frame).values()) expect(missingColors).not.toContain(color);
        // Original grounded paws and haunches, translated only by canvas padding.
        for (const [key, color] of pixels(f.idle)) {
          const [x, y] = key.split(',').map(Number);
          if (y >= 12 && x < 12) expect(pixels(frame).get(`${x},${y + 4}`)).toBe(color);
        }
      });
    }
    unique.forEach(poses => expect(poses.size).toBe(12));
  });

  it('preserves cast heads and seat anchors while adding a mirrored lowered hand', () => {
    const signatures = new Set<string>();
    for (const design of CUSTOMER_CAST) {
      const frames = character(design.look, 'customer', design.id);
      signatures.add(signature(frames.sitPetRight[0]));
      for (const [normal, pair] of [[frames.sitRight, frames.sitPetRight], [frames.sitLeft, frames.sitPetLeft]] as const) {
        expect(new Set(pair.map(signature)).size).toBe(2);
        for (const frame of pair) {
          expect([frame.width, frame.height]).toEqual([18, 34]);
          for (const [key, color] of pixels(normal)) {
            const y = Number(key.split(',')[1]);
            if (y < 17) expect(pixels(frame).get(key)).toBe(color);
          }
          for (const color of pixels(frame).values()) expect(missingColors).not.toContain(color);
        }
      }
      for (let i = 0; i < 2; i++) for (const [key, color] of pixels(frames.sitPetRight[i])) {
        const [x, y] = key.split(',').map(Number);
        expect(pixels(frames.sitPetLeft[i]).get(`${17 - x},${y}`)).toBe(color);
      }
      expect(character(design.look, 'customer', design.id).sitPetRight).toBe(frames.sitPetRight);
    }
    expect(signatures.size).toBe(CUSTOMER_CAST.length);
  });

  it('places the lowered hand within two pixels of the raised cat head at seat approach y + 12', () => {
    const handBottom = -33 + 31;
    const raisedHeadTop = 12 - catFrames().lookUp.height + 2 + 1;
    expect(Math.abs(handBottom - raisedHeadTop)).toBeLessThanOrEqual(2);
  });
});


describe('resident walking orientation', () => {
  it('puts the native head pixels ahead of the body in both travel directions for every breed and walk frame', () => {
    for (const cat of CATS) for (const frame of catFrames(cat.id).walk) {
      const coordinates = [...pixels(frame).keys()].map(key => key.split(',').map(Number));
      const top = Math.min(...coordinates.map(([,y]) => y));
      // The ears/head form the highest three rows; the torso/tail are lower.
      const head = coordinates.filter(([,y]) => y <= top + 2);
      const nativeHeadX = head.reduce((sum,[x]) => sum + x, 0) / head.length;
      expect(nativeHeadX).toBeLessThan((frame.width - 1) / 2);
      for (const facing of [-1, 1] as const) {
        const renderedHeadX = residentCatFlipX(true, facing) ? frame.width - 1 - nativeHeadX : nativeHeadX;
        expect((renderedHeadX - (frame.width - 1) / 2) * facing).toBeGreaterThan(0);
      }
    }
  });
  it('keeps stationary and guest-facing poses on their existing convention', () => {
    expect(residentCatFlipX(false, 1)).toBe(false);
    expect(residentCatFlipX(false, -1)).toBe(true);
  });
});
