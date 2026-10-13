import { describe, expect, it } from 'vitest';
import { paintServiceCup, paintServiceTray, paintTableVase, paintTableTent } from './service-props-art';
import { textWidth } from './font';

type Rect = { x: number; y: number; w: number; h: number; color: string };
function marks(paint: (ctx: CanvasRenderingContext2D) => void): Rect[] {
  const result: Rect[] = [];
  const ctx = { fillStyle: '', fillRect(this: { fillStyle: string }, x: number, y: number, w: number, h: number) {
    result.push({ x, y, w, h, color: this.fillStyle });
  } } as unknown as CanvasRenderingContext2D;
  paint(ctx);
  return result;
}

describe('Warm Pixel A composable service objects', () => {
  const objects = [
    { name: 'porcelain cup and handle', w: 7, h: 7, paint: paintServiceCup },
    { name: 'brass rimmed tray', w: 22, h: 3, paint: paintServiceTray },
    { name: 'glass flower vase', w: 5, h: 14, paint: (c: CanvasRenderingContext2D) => paintTableVase(c, '#ab5543') },
    ...[1, 9, 10, 20].map(n => ({ name: `folded table tent ${n}`, w: textWidth(String(n)) + 4, h: 7, paint: (c: CanvasRenderingContext2D) => paintTableTent(c, n) })),
  ];
  for (const obj of objects) it(`paints deterministic integer detail inside ${obj.name} bounds`, () => {
    const rectangles = marks(obj.paint);
    expect(rectangles).toEqual(marks(obj.paint));
    expect(rectangles.length).toBeGreaterThanOrEqual(7);
    expect(new Set(rectangles.map(r => r.color)).size).toBeGreaterThanOrEqual(4);
    for (const { x, y, w, h } of rectangles) {
      expect([x, y, w, h].every(Number.isInteger)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(obj.w); expect(y + h).toBeLessThanOrEqual(obj.h);
    }
  });
});
