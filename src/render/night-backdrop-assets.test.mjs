import { describe, expect, it } from 'vitest';
import { decodePng } from '../../scripts/pixel-conform.mjs';
import { FLOOR_Y, SCENE_W } from '../game/layout';
import { nightSkyMask, paintNightSky } from './night-backdrop';
import { resampleRgba, WORLD_ART_DENSITY } from './world-art-grid';

// Coordinates in the source paintings, before the renderer's art-grid resampling.
const scenes = [
  { area: 'greenhouse', clouds: [[640, 110], [600, 175]], props: [[330, 85], [1030, 270]] },
  { area: 'terrace', clouds: [[404, 95], [721, 112]], props: [[281, 16], [502, 81], [565, 264]] },
  { area: 'reading', clouds: [[677, 65], [541, 108]], props: [[331, 128], [367, 183]] },
];

describe.each([1, WORLD_ART_DENSITY])('painted night backdrops at density %i', density => {
  it.each(scenes)('repaints warm clouds and preserves flowers, lamps and furnishings in $area', ({ area, clouds, props }) => {
    const source = decodePng(`public/art/generated/cozy-world-v2/region-${area}.png`);
    const width = SCENE_W * density, height = FLOOR_Y * density;
    const data = resampleRgba(source.pixels, source.width, source.height, width, height);
    const offset = ([x, y]) => Math.floor(y / source.height * height) * width + Math.floor(x / source.width * width);
    const mask = nightSkyMask(data, width, height);

    for (const point of clouds) {
      const pixel = offset(point), [r, g, b] = data.slice(pixel * 4, pixel * 4 + 3);
      expect(r).toBeGreaterThan(225);
      expect(g).toBeGreaterThan(225);
      expect(b).toBeLessThan(r);
      expect(mask[pixel]).toBe(2);
    }
    for (const point of props) expect(mask[offset(point)]).toBe(0);

    paintNightSky(data, width, height, mask);
    for (const point of clouds) {
      const [r, g, b, a] = data.slice(offset(point) * 4, offset(point) * 4 + 4);
      expect(a).toBe(255);
      expect(r + g + b).toBeLessThan(300);
      expect(b).toBeGreaterThan(r);
    }
    for (const point of props) expect(data[offset(point) * 4 + 3]).toBe(0);
  });
});
