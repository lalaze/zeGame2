import { describe, expect, it } from 'vitest';
import { UI_ART, paintAckBubble, paintCallBubble, paintOrderFrame, paintSoldOutCross, paintSoldOutFrame, paintThoughtFrame } from './ui-art';

type Mark = { x: number; y: number; w: number; h: number; color: string };
function painted(paint: (ctx: CanvasRenderingContext2D) => void): Mark[] {
  const marks: Mark[] = [];
  const ctx = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { marks.push({ x, y, w, h, color: this.fillStyle }); } };
  paint(ctx as unknown as CanvasRenderingContext2D);
  return marks;
}

describe('Warm Pixel A overlay asset footprints', () => {
  const cases = [
    { name: 'single order', w: 22, h: 22, paint: (ctx: CanvasRenderingContext2D) => paintOrderFrame(ctx, 20, 18) },
    { name: 'combo order', w: 36, h: 22, paint: (ctx: CanvasRenderingContext2D) => paintOrderFrame(ctx, 34, 18) },
    { name: 'sold out slip', w: 22, h: 20, paint: paintSoldOutFrame },
    { name: 'sold out stamp', w: 20, h: 18, paint: paintSoldOutCross },
    { name: 'service bell', w: 17, h: 15, paint: paintCallBubble },
    { name: 'server acknowledgement', w: 7, h: 10, paint: paintAckBubble },
    { name: 'one line thought', w: 90, h: 22, paint: (ctx: CanvasRenderingContext2D) => paintThoughtFrame(ctx, 90, 22) },
    { name: 'two line thought', w: 108, h: 36, paint: (ctx: CanvasRenderingContext2D) => paintThoughtFrame(ctx, 108, 36) },
  ];
  it.each(cases)('$name remains deterministic, on-grid and inside its existing canvas', ({ w, h, paint }) => {
    const marks = painted(paint);
    expect(marks.length).toBeGreaterThan(3);
    expect(painted(paint)).toEqual(marks);
    for (const mark of marks) {
      expect([mark.x, mark.y, mark.w, mark.h].every(Number.isInteger)).toBe(true);
      expect(mark.x).toBeGreaterThanOrEqual(0); expect(mark.y).toBeGreaterThanOrEqual(0);
      expect(mark.w).toBeGreaterThan(0); expect(mark.h).toBeGreaterThan(0);
      expect(mark.x + mark.w).toBeLessThanOrEqual(w); expect(mark.y + mark.h).toBeLessThanOrEqual(h);
      expect(Object.values(UI_ART)).toContain(mark.color);
    }
  });
  it('preserves the full quiet text field and upper-left cloud highlights', () => {
    const marks = painted(ctx => paintThoughtFrame(ctx, 90, 22));
    const at = (x: number, y: number) => marks.filter(m => x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h).at(-1)?.color;
    expect(at(45, 11)).toBe(UI_ART.cream);
    expect(at(5, 1)).toBe(UI_ART.light);
    expect(at(84, 19)).toBe(UI_ART.paperShade);
    expect(at(0, 0)).toBeUndefined();
  });
});
