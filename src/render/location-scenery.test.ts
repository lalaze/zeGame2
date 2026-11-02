import { describe, expect, it } from 'vitest';
import { paintLocationScenery, type BranchScenery } from './location-scenery';

function recorder() {
  const rects: [number, number, number, number][] = [];
  const ctx = { fillStyle: '', fillRect: (x: number, y: number, w: number, h: number) => rects.push([x, y, w, h]) };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects };
}

describe('branch window scenery', () => {
  it.each(['seaside', 'forest', 'city', 'flowers'] as BranchScenery[])('paints %s inside the glass by day and night, leaving the top for the sky', (id) => {
    for (const dark of [0, 1]) for (const t of [0, 7.3]) {
      const { ctx, rects } = recorder();
      paintLocationScenery(ctx, 100, 50, 92, 76, dark, t, id);
      expect(rects.length).toBeGreaterThan(40);
      for (const [x, y, w, h] of rects) {
        expect(x).toBeGreaterThanOrEqual(100); expect(y).toBeGreaterThanOrEqual(50);
        expect(x + w).toBeLessThanOrEqual(192); expect(y + h).toBeLessThanOrEqual(126);
      }
      // Most of the top band stays open for the sky behind it.
      const topArea = rects.reduce((sum, [, y, w, h]) => sum + w * Math.max(0, Math.min(y + h, 50 + 76 * 0.2) - Math.max(y, 50)), 0);
      expect(topArea).toBeLessThan(92 * 76 * 0.2 * 0.35);
    }
  });

  it('ignores an empty window', () => {
    const { ctx, rects } = recorder();
    paintLocationScenery(ctx, 0, 0, 0, 10, 0, 0, 'city');
    expect(rects).toEqual([]);
  });
});
