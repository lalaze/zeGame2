import { describe, expect, it, vi } from 'vitest';
import {
  FINE_COUNTER_PROP_BOUNDS as B, paintFineBreadBasket, paintFineStorageJar,
  paintFineCakeDome, paintFineCupStack, paintFineSaucerStack,
} from './fine-counter-props-art';

type Rect = { x: number; y: number; w: number; h: number; color: string };
type Painter = (ctx: CanvasRenderingContext2D, x?: number, y?: number) => void;
function marks(paint: Painter, x = 0, y = 0): Rect[] {
  const result: Rect[] = [];
  const ctx = { fillStyle: '', fillRect(this: { fillStyle: string }, rx: number, ry: number, w: number, h: number) {
    result.push({ x: rx, y: ry, w, h, color: this.fillStyle });
  } } as unknown as CanvasRenderingContext2D;
  paint(ctx, x, y);
  return result;
}
const objects = [
  { name: 'filled basket', ...B.breadBasket, paint: paintFineBreadBasket },
  { name: 'empty basket', ...B.breadBasket, paint: ((c, x, y) => paintFineBreadBasket(c, x, y, false)) as Painter },
  ...(['beans', 'tea', 'sugar'] as const).map(kind => ({ name: `${kind} jar`, ...B.storageJar[kind], paint: ((c, x, y) => paintFineStorageJar(c, x, y, kind)) as Painter })),
  { name: 'cake dome', ...B.cakeDome, paint: paintFineCakeDome },
  ...([1, 2, 3] as const).map(count => ({ name: `${count} cups`, ...B.cupStack, paint: ((c, x, y) => paintFineCupStack(c, x, y, count)) as Painter })),
  { name: 'saucers', ...B.saucerStack, paint: paintFineSaucerStack },
];

describe('fine rear-counter props', () => {
  for (const object of objects) it(`paints deterministic bounded half-pixel ${object.name}`, () => {
    const result = marks(object.paint);
    expect(result).toEqual(marks(object.paint));
    expect(result.length).toBeGreaterThan(30);
    expect(new Set(result.map(mark => mark.color)).size).toBeGreaterThanOrEqual(6);
    for (const { x, y, w, h, color } of result) {
      expect([x, y, w, h].every(value => Number.isFinite(value) && Number.isInteger(value * 2))).toBe(true);
      expect(w).toBeGreaterThan(0); expect(h).toBeGreaterThan(0);
      expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(object.w); expect(y + h).toBeLessThanOrEqual(object.h);
      expect(color).toMatch(/^#[\da-f]{6}$/);
    }
    // The objects never flatten their transparent rectangle into a background.
    const area = result.reduce((sum, rect) => sum + rect.w * rect.h, 0);
    expect(area).toBeLessThan(object.w * object.h * .85);
    expect(result.some(rect => rect.w === .5)).toBe(true);
  });

  it('translates every mark exactly without transforms or changing its bounds', () => {
    for (const object of objects) {
      const original = marks(object.paint), translated = marks(object.paint, 19.5, -3.5);
      expect(translated).toEqual(original.map(rect => ({ ...rect, x: rect.x + 19.5, y: rect.y - 3.5 })));
      expect(marks(object.paint, NaN, 0)).toEqual([]);
      expect(marks(object.paint, 0, Infinity)).toEqual([]);
    }
  });

  it('preserves empty glass space, foot gaps, handle holes and separate content choices', () => {
    const contains = (rs: Rect[], x: number, y: number) => rs.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    const dome = marks(paintFineCakeDome);
    expect(contains(dome, 9, 4.5)).toBe(false);
    expect(contains(dome, 4, 14.5)).toBe(false);
    const cup = marks((c, x, y) => paintFineCupStack(c, x, y, 1));
    expect(contains(cup, 8, 9)).toBe(false);
    const empty = marks((c, x, y) => paintFineBreadBasket(c, x, y, false));
    expect(empty).not.toEqual(marks(paintFineBreadBasket));
    expect(empty.every(rect => rect.y >= 5)).toBe(true);
    const jars = (['beans', 'tea', 'sugar'] as const).map(kind => JSON.stringify(marks((c, x, y) => paintFineStorageJar(c, x, y, kind))));
    expect(new Set(jars).size).toBe(3);
  });

  it('does not consume gameplay randomness or require canvas/image/DOM state', async () => {
    const random = vi.spyOn(Math, 'random');
    vi.resetModules();
    const fresh = await import('./fine-counter-props-art');
    expect(marks(fresh.paintFineBreadBasket)).toEqual(marks(paintFineBreadBasket));
    expect(marks(fresh.paintFineCakeDome)).toEqual(marks(paintFineCakeDome));
    expect(marks(fresh.paintFineSaucerStack)).toEqual(marks(paintFineSaucerStack));
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });
});
