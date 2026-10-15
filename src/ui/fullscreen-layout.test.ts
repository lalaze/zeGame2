import { describe, expect, it } from 'vitest';
import { fitFullscreenRoom } from './fullscreen-layout';
describe('fullscreen room containment', () => {
  for (const [width, height] of [[1200,900],[1920,1080],[3440,1440],[390,844],[844,390],[320,568]]) {
    for (const dpr of [1,2,3]) it(`${width}x${height} @${dpr} preserves complete room`, () => {
      const fit = fitFullscreenRoom(width, height, dpr);
      expect(fit.cssWidth / fit.cssHeight).toBeCloseTo(4/3);
      expect(fit.cssWidth).toBeLessThanOrEqual(width);
      expect(fit.cssHeight).toBeLessThanOrEqual(height);
      expect(Math.min(width-fit.cssWidth, height-fit.cssHeight)).toBeCloseTo(0);
      expect(fit.width).toBeGreaterThan(0);
    });
  }
});
