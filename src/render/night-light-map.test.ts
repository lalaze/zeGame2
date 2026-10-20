import { describe, expect, it } from 'vitest';
import { cornerDepth, nightLightMap, poolLight } from './night-light-map';

const W = 64, H = 48;
const at = (data: Uint8ClampedArray, x: number, y: number) => [...data.slice((y * W + x) * 4, (y * W + x) * 4 + 4)];

describe('night light map', () => {
  it('is brightest under a lamp and fades to nothing at the edge of its pool', () => {
    const pool = { x: 10, y: 10, pool: 8, strength: 1 };
    expect(poolLight(10, 10, [pool])).toBeCloseTo(1);
    expect(poolLight(14, 10, [pool])).toBeGreaterThan(0);
    expect(poolLight(14, 10, [pool])).toBeLessThan(1);
    expect(poolLight(18, 10, [pool])).toBe(0);
  });

  it('never lets overlapping pools exceed full light', () => {
    const pools = [0, 1, 2].map(() => ({ x: 0, y: 0, pool: 10, strength: .9 }));
    expect(poolLight(0, 0, pools)).toBeLessThanOrEqual(1);
    expect(poolLight(0, 0, pools)).toBeGreaterThan(poolLight(0, 0, pools.slice(0, 1)));
  });

  it('leaves the middle of the room clear of the corner shade', () => {
    expect(cornerDepth(W / 2, H * .45, W, H)).toBe(0);
    expect(cornerDepth(0, 0, W, H)).toBeGreaterThan(.8);
  });

  it('shades the room cool and dark, warm and near white inside a pool', () => {
    const data = nightLightMap('main', W, H, [{ x: 32, y: 20, pool: 12, strength: 1 }]);
    const lit = at(data, 32, 20), shade = at(data, 32, 40), corner = at(data, 0, 0);
    expect(lit[0]).toBeGreaterThan(240);
    expect(lit[0]).toBeGreaterThan(lit[2]);
    expect(shade[2]).toBeGreaterThan(shade[0]);
    expect(corner[0] + corner[1] + corner[2]).toBeLessThan(shade[0] + shade[1] + shade[2]);
    for (let i = 3; i < data.length; i += 4) expect(data[i]).toBe(255);
  });

  it('keeps the glasshouse and patio lighter, since the night sky already grades them', () => {
    const sum = (area: 'main' | 'terrace') => at(nightLightMap(area, W, H, []), 32, 22).slice(0, 3).reduce((a, b) => a + b, 0);
    expect(sum('terrace')).toBeGreaterThan(sum('main'));
  });
});
