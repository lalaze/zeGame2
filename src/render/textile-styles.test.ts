import { describe, expect, it } from 'vitest';
import { remapTextile, TEXTILE_COLORS } from './textile-styles';

describe('textile material variants', () => {
  it('preserves alpha, cream checks, wood, plants and the lower pedestal', () => {
    const source = new Uint8ClampedArray([
      205, 60, 55, 255, 150, 95, 40, 255, 50, 90, 40, 255, 240, 225, 190, 255,
      205, 60, 55, 0, 205, 60, 55, 255, 205, 60, 55, 255, 205, 60, 55, 255,
    ]);
    for (const id of Object.keys(TEXTILE_COLORS)) {
      const pixels = source.slice(); remapTextile(pixels, 1, 8, id, true);
      expect([...pixels.slice(0, 3)]).toEqual(TEXTILE_COLORS[id]);
      expect(pixels.slice(4, 20)).toEqual(source.slice(4, 20));
      expect(pixels.slice(28)).toEqual(source.slice(28));
      expect(pixels.filter((_, i) => i % 4 === 3)).toEqual(source.filter((_, i) => i % 4 === 3));
    }
  });
  it('keeps default art untouched and retains fold shading in variants', () => {
    const original = new Uint8ClampedArray([205, 60, 55, 255, 102, 30, 27, 255]);
    const classic = original.slice(); remapTextile(classic, 2, 1, 'tablecloth_classic', true);
    expect(classic).toEqual(original);
    const variant = original.slice(); remapTextile(variant, 2, 1, 'tablecloth_blue', true);
    expect(variant[0]).toBeGreaterThan(variant[4]); expect(variant[1]).toBeGreaterThan(variant[5]);
  });
});
