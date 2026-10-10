import { CUSTOMER_CAST } from '../game/customer-cast';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { character, CHAR_H, FRONT, SIDE, HAIR, LEGS_FRONT, LEGS_SIDE, type Role } from './sprites';

// Small deterministic software canvas: validates the actual pixels written by
// the production builder, including mirrored frames, without a browser/GPU.
class PixelCanvas {
  width = 0;
  height = 0;
  pixels = new Map<string, string>();
  getContext() {
    let tx = 0;
    let sx = 1;
    const canvas = this;
    return {
      fillStyle: '',
      fillRect(x: number, y: number, w: number, h: number) {
        for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
          expect(x + dx).toBeGreaterThanOrEqual(0);
          expect(y + dy).toBeGreaterThanOrEqual(0);
          expect(x + dx).toBeLessThan(canvas.width);
          expect(y + dy).toBeLessThan(canvas.height);
          canvas.pixels.set(`${x + dx},${y + dy}`, this.fillStyle);
        }
      },
      translate(x: number) { tx += x; },
      scale(x: number) { sx *= x; },
      drawImage(source: PixelCanvas) {
        for (const [key, value] of source.pixels) {
          const [x, y] = key.split(',').map(Number);
          canvas.pixels.set(`${sx === -1 ? tx - x - 1 : tx + x},${y}`, value);
        }
      },
    };
  }
}
const pixels = (c: HTMLCanvasElement) => (c as unknown as PixelCanvas).pixels;
const signature = (c: HTMLCanvasElement) => [...pixels(c)].sort().join('|');
const look = { skin: 0, hair: 1, hairStyle: 0, shirt: 0, pants: 0 };
const roles: Role[] = ['owner', 'barista', 'server', 'cook', 'customer'];

beforeAll(() => vi.stubGlobal('document', { createElement: () => new PixelCanvas() }));
afterAll(() => vi.unstubAllGlobals());

describe('redesigned café cast', () => {
  it('keeps source grids on their 16-pixel registration', () => {
    const grids = [FRONT, SIDE, ...LEGS_FRONT, ...LEGS_SIDE, ...HAIR.flatMap(h => [h.front, h.side, h.back])];
    for (const grid of grids) for (const row of grid) expect(row).toHaveLength(16);
  });
  it('preserves every role and hairstyle frame size and resolves all palette entries', () => {
    for (const role of roles) for (let hairStyle = 0; hairStyle < 4; hairStyle++) {
      const f = character({ ...look, skin: hairStyle, hairStyle }, role);
      expect(f.stand).toBe(f.down[0]);
      for (const direction of [f.down, f.up, f.left, f.right]) {
        expect(direction).toHaveLength(3);
        for (const frame of direction) {
          expect([frame.width, frame.height]).toEqual([18, CHAR_H]);
          expect(pixels(frame).size).toBeGreaterThan(190);
          expect([...pixels(frame).values()]).not.toContain('#ff00ff');
        }
      }
      expect([f.sitLeft.width, f.sitLeft.height]).toEqual([18, 26]);
      expect([f.sitRight.width, f.sitRight.height]).toEqual([18, 26]);
    }
  });
  it('has three genuinely distinct gait poses in all four directions', () => {
    const f = character(look, 'owner');
    for (const direction of [f.down, f.up, f.left, f.right]) {
      expect(new Set(direction.map(signature)).size).toBe(3);
    }
  });
  it('mirrors side and sitting frames without moving their anchor', () => {
    const f = character(look, 'customer');
    for (const [right, left] of [...f.right.map((r, i) => [r, f.left[i]]), [f.sitRight, f.sitLeft]]) {
      for (const [key, color] of pixels(right)) {
        const [x, y] = key.split(',').map(Number);
        expect(pixels(left).get(`${right.width - x - 1},${y}`)).toBe(color);
      }
      expect(pixels(left).size).toBe(pixels(right).size);
    }
  });
  it('distinguishes all five roles and keeps cached appearances separate', () => {
    const cast = roles.map(role => character(look, role));
    expect(new Set(cast.map(f => signature(f.stand))).size).toBe(5);
    expect(character({ ...look }, 'owner')).toBe(cast[0]);
    expect(character({ ...look, shirt: 1 }, 'owner')).not.toBe(cast[0]);
  });
  it('never mutates saved look choices while producing new outfits', () => {
    const saved = Object.freeze({ ...look, hairStyle: 2, shirt: 6 });
    roles.forEach(role => character(saved, role));
    expect(saved).toEqual({ ...look, hairStyle: 2, shirt: 6 });
  });
  it('renders thirty unique designs in every direction without palette or anchor regressions', () => {
    const signatures = new Set<string>();
    for (const design of CUSTOMER_CAST) {
      const f = character(design.look, 'customer', design.id);
      signatures.add(signature(f.stand));
      for (const direction of [f.down, f.up, f.left, f.right]) {
        expect(new Set(direction.map(signature)).size).toBe(3);
        for (const frame of direction) {
          expect([frame.width, frame.height]).toEqual([18, 28]);
          expect([...pixels(frame).values()]).not.toContain('#ff00ff');
        }
      }
      expect([f.sitRight.width, f.sitRight.height]).toEqual([18, 26]);
      expect(character(design.look, 'customer', design.id)).toBe(f);
    }
    expect(signatures.size).toBe(30);
  });
  it('keys customer artwork by design and ignores customer-only IDs for staff', () => {
    expect(character(look, 'customer', 0)).not.toBe(character(look, 'customer', 1));
    expect(character(look, 'customer', -1)).toBe(character(look, 'customer'));
    expect(character(look, 'customer', 99)).toBe(character(look, 'customer'));
    expect(character(look, 'customer', 1.5)).toBe(character(look, 'customer'));
    for (const role of roles.filter(r => r !== 'customer')) {
      expect(character(look, role, 25)).toBe(character(look, role));
    }
  });

});
