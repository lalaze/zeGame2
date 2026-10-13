import { describe, expect, it } from 'vitest';
import { MAIN_PIXEL_PROJECTION_DEFAULTS, projectPoint, projectSprite, unprojectPoint, type PixelProjectionOptions } from './pixel-projection';

const main: PixelProjectionOptions = { enabled: true, area: 'main' };
const plain: PixelProjectionOptions = { ...main, doorways: [] };

describe('optional main-room pixel projection', () => {
  it('is identity by default and requires an explicit main-room opt in', () => {
    const point = { x: 12.5, y: 80 };
    for (const options of [{}, MAIN_PIXEL_PROJECTION_DEFAULTS, { enabled: true }, { area: 'main' }, { ...main, enabled: false }, { ...main, area: 'reading' }, { ...main, area: 'kitchen' }]) {
      expect(projectPoint(point, options)).toEqual(point);
      expect(unprojectPoint(point, options)).toEqual(point);
    }
  });

  it('converges only x, linearly with floor depth, and keeps the front identity', () => {
    expect(projectPoint({ x: 0, y: 80 }, plain).x).toBeCloseTo(16, 12);
    expect(projectPoint({ x: 0, y: (80 + 233) / 2 }, plain).x).toBeCloseTo(8, 12);
    expect(projectPoint({ x: 320, y: 80 }, plain).x).toBeCloseTo(304, 12);
    for (const y of [0, 80, 150, 233, 360]) expect(projectPoint({ x: 160, y }, plain)).toEqual({ x: 160, y });
    for (const y of [233, 240, 360]) expect(projectPoint({ x: 10.5, y }, main)).toEqual({ x: 10.5, y });
  });

  it('keeps both full door openings and the first sixteen floor pixels identity', () => {
    for (const [side, center] of [['left', 88], ['right', 138]] as const) {
      for (const y of [center - 14, center, center + 14]) {
        for (const inward of [-12, 0, 4, 12, 16]) {
          const x = side === 'left' ? inward : 320 - inward;
          expect(projectPoint({ x, y }, main)).toEqual({ x, y });
          expect(unprojectPoint({ x, y }, main)).toEqual({ x, y });
        }
      }
    }
  });

  it('joins unprojected neighboring rooms without a position jump at either portal', () => {
    for (const [boundary, y] of [[0, 88], [320, 138]]) {
      const epsilon = 0.00001;
      const left = boundary === 0 ? { x: -epsilon, y } : projectPoint({ x: boundary - epsilon, y }, main);
      const right = boundary === 0 ? projectPoint({ x: epsilon, y }, main) : { x: boundary + epsilon, y };
      expect(right.x - left.x).toBeCloseTo(epsilon * 2, 10);
      expect(left.y).toBe(right.y);
    }
  });

  it('fades portal exceptions continuously and limits them to the near-wall corridor', () => {
    for (const y of [88 - 24, 88 - 14, 88 + 14, 88 + 24, 138 - 24, 138 - 14, 138 + 14, 138 + 24]) {
      for (const x of [0, 16, 40, 80, 160, 240, 280, 304, 320]) {
        const above = projectPoint({ x, y: y - 0.00001 }, main);
        const below = projectPoint({ x, y: y + 0.00001 }, main);
        expect(Math.abs(above.x - below.x)).toBeLessThan(0.0001);
      }
    }
    for (const y of [80, 88, 110, 138, 152]) for (const x of [40, 80, 160, 240, 280]) {
      expect(projectPoint({ x, y }, main).x).toBeCloseTo(projectPoint({ x, y }, plain).x, 12);
    }
  });

  it('is strictly monotone across every knot and exactly invertible before raster rounding', () => {
    for (const height of [240, 280, 360]) {
      const options: PixelProjectionOptions = {
        ...main, floorBottom: height - 7,
        doorways: [{ side: 'left', y: 88 }, { side: 'right', y: 138 + (height - 240) * 0.1 }],
      };
      for (const y of [0, 74, 80, 88, 102, 110, 114, 124, 138, 152, 162, 174, 218, height - 7, height + 12]) {
        let previous = -Infinity;
        for (let x = -16; x <= 336; x += 0.5) {
          const point = { x, y };
          const painted = projectPoint(point, options);
          const restored = unprojectPoint(painted, options);
          expect(painted.x).toBeGreaterThan(previous);
          expect(painted.y).toBe(y);
          expect(restored.x).toBeCloseTo(x, 10);
          expect(restored.y).toBe(y);
          previous = painted.x;
        }
      }
    }
  });

  it('preserves upright height, width and attachment offsets instead of warping sprite rows', () => {
    const anchor = { x: 100, y: 174 };
    const foot = projectPoint(anchor, main);
    expect(projectSprite(anchor, { x: -9, y: -27 }, main)).toEqual({ x: foot.x - 9, y: foot.y - 27 });
    const left = projectSprite(anchor, { x: -16, y: -19 }, main);
    const right = projectSprite(anchor, { x: 16, y: -19 }, main);
    expect(right.x - left.x).toBe(32);
    expect(foot.y - left.y).toBe(19);
    expect(anchor).toEqual({ x: 100, y: 174 });
  });

  it('accepts current stretched doorway coordinates without moving the portals', () => {
    const options: PixelProjectionOptions = { ...main, floorBottom: 353, doorways: [{ side: 'left', y: 88 }, { side: 'right', y: 161 }] };
    expect(projectPoint({ x: 320, y: 161 }, options)).toEqual({ x: 320, y: 161 });
    expect(projectPoint({ x: 304, y: 161 }, options)).toEqual({ x: 304, y: 161 });
  });

  it('does not change caller data and handles invalid geometry without folding', () => {
    const point = Object.freeze({ x: 4, y: 80 });
    const options = Object.freeze({ ...main, width: 0 });
    expect(projectPoint(point, options)).toEqual(point);
    expect(projectPoint(point, { ...main, floorBottom: 80 })).toEqual(point);
    const clamped = { ...plain, backScale: -10 };
    expect(unprojectPoint(projectPoint(point, clamped), clamped).x).toBeCloseTo(point.x, 12);
  });
});
