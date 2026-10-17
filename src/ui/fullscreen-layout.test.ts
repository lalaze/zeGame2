import { describe, expect, it } from 'vitest';
import { CRISP_LETTERBOX, fitFullscreenRoom } from './fullscreen-layout';
import { WORLD_ART_DENSITY } from '../render/world-art-grid';

describe('fullscreen room containment', () => {
  for (const [width, height] of [[1200,900],[1920,1080],[3440,1440],[390,844],[844,390],[320,568],[1440,1000],[1512,870],[1728,1000]]) {
    for (const dpr of [1,1.25,2,3]) it(`${width}x${height} @${dpr} preserves the complete room on whole art pixels`, () => {
      const fit = fitFullscreenRoom(width, height, dpr);
      const contain = Math.min(width / 320, height / 240);
      expect(fit.cssWidth / fit.cssHeight).toBeCloseTo(4/3);
      expect(fit.cssWidth).toBeLessThanOrEqual(width + 1e-9);
      expect(fit.cssHeight).toBeLessThanOrEqual(height + 1e-9);
      // Every art pixel covers the same whole number of drawing-buffer pixels.
      expect(Number.isInteger(fit.backing / WORLD_ART_DENSITY)).toBe(true);
      expect(fit.backing).toBeGreaterThanOrEqual(WORLD_ART_DENSITY);
      expect([fit.width, fit.height]).toEqual([320 * fit.backing, 240 * fit.backing]);
      if (fit.smooth) {
        // Too far from an exact scale: keep the full contain size and let the browser smooth.
        expect(fit.cssWidth).toBeCloseTo(320 * contain);
      } else {
        // Exact: one drawing-buffer pixel per device pixel, at most CRISP_LETTERBOX under contain.
        expect(fit.cssWidth * Math.max(1, dpr)).toBeCloseTo(fit.width);
        expect(fit.cssWidth).toBeGreaterThanOrEqual(320 * contain * (1 - CRISP_LETTERBOX) - 1e-9);
      }
    });
  }

  it.each([
    [1280, 960, 1, 4, false, 1280], // exact contain
    [1440, 1000, 1, 4, false, 1280], // 4% letterbox stays crisp
    [1728, 1000, 2, 8, false, 1280], // Retina laptop, 4% letterbox
    [1512, 870, 2, 8, true, 1160], // 17% away from 6×: contain and smooth from 8×
    [390, 844, 3, 4, true, 390], // phone: contain and smooth from 4×
  ])('%ix%i @%i draws at %i× (smooth %s) and shows %i CSS px wide', (width, height, dpr, backing, smooth, cssWidth) => {
    const fit = fitFullscreenRoom(width, height, dpr);
    expect(fit).toMatchObject({ backing, smooth });
    expect(fit.cssWidth).toBeCloseTo(cssWidth);
  });
});
